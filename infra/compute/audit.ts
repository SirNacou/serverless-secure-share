import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface AuditWorkerArgs {
	auditQueue: aws.sqs.Queue;
	auditTableName: pulumi.Input<string>;
}

export function createAuditWorker(args: AuditWorkerArgs) {
	const auditRole = new aws.iam.Role("audit-worker-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("audit-worker-logs", {
		role: auditRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("audit-worker-dynamo-policy", {
		role: auditRole.name,
		policy: pulumi.all([args.auditTableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:PutItem"],
						Resource: [
							`arn:aws:dynamodb:*:*:table/${tableName}`,
							`arn:aws:dynamodb:*:*:table/${tableName}/index/*`,
						],
					},
				],
			}),
		),
	});

	new aws.iam.RolePolicy("audit-worker-sqs-policy", {
		role: auditRole.name,
		policy: pulumi.all([args.auditQueue.arn]).apply(([queueArn]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: [
							"sqs:ReceiveMessage",
							"sqs:DeleteMessage",
							"sqs:GetQueueAttributes",
						],
						Resource: [queueArn],
					},
				],
			}),
		),
	});

	const auditLoggerLambda = new aws.lambda.Function("auditLoggerFunction", {
		code: new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive("./src/workers"),
		}),
		runtime: "nodejs24.x",
		handler: "audit-logger.handler",
		role: auditRole.arn,
		environment: {
			variables: {
				AUDIT_TABLE_NAME: args.auditTableName,
			},
		},
	});

	new aws.lambda.EventSourceMapping("auditSqsMapping", {
		eventSourceArn: args.auditQueue.arn,
		functionName: auditLoggerLambda.arn,
		batchSize: 10,
		maximumBatchingWindowInSeconds: 5,
	});
}
