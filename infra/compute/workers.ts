import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface WorkerComputeArgs {
	bucket: aws.s3.Bucket;
	tableName: pulumi.Input<string>;
}

export function createWorkerCompute(args: WorkerComputeArgs) {
	const workerRole = new aws.iam.Role("s3-worker-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("worker-logs", {
		role: workerRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("worker-dynamo-policy", {
		role: workerRole.name,
		policy: pulumi.all([args.tableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:UpdateItem"],
						Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
					},
				],
			}),
		),
	});

	const s3SyncLambda = new aws.lambda.Function("s3SyncWorker", {
		code: new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive("./src/workers"),
		}),
		runtime: "nodejs24.x",
		handler: "s3-sync.handler",
		role: workerRole.arn,
		environment: {
			variables: { TABLE_NAME: args.tableName },
		},
	});

	// Wire up S3 background event trigger hook directly
	args.bucket.onObjectCreated("newUploadNotificationEvent", s3SyncLambda, {
		filterPrefix: "uploads/",
	});
}
