import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface WorkerComputeArgs {
    bucket: aws.s3.Bucket;
    tableName: pulumi.Input<string>;
    tableStreamArn: pulumi.Input<string>; // <-- ADD THIS INPUT
}

export function createWorkerCompute(args: WorkerComputeArgs) {
    const workerRole = new aws.iam.Role("s3-worker-role", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        }),
    });

    new aws.iam.RolePolicyAttachment("worker-logs", {
        role: workerRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });

    // Combined DynamoDB permissions (Updates + Stream Reading)
    new aws.iam.RolePolicy("worker-dynamo-policy", {
        role: workerRole.name,
        policy: pulumi.all([args.tableName, args.tableStreamArn]).apply(([tableName, tableStreamArn]) =>
            JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["dynamodb:UpdateItem"],
                        Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
                    },
                    {
                        Effect: "Allow",
                        Action: [
                            "dynamodb:GetRecords",
                            "dynamodb:GetShardIterator",
                            "dynamodb:DescribeStream",
                            "dynamodb:ListStreams"
                        ],
                        Resource: [tableStreamArn],
                    },
                ],
            }),
        ),
    });

    // FIX: Add permissions allowing the worker to delete objects from the specific bucket
    new aws.iam.RolePolicy("worker-s3-policy", {
        role: workerRole.name,
        policy: args.bucket.id.apply((bucketName) =>
            JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["s3:DeleteObject"],
                        Resource: [`arn:aws:aws:s3:::${bucketName}/uploads/*`],
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
            variables: { 
                TABLE_NAME: args.tableName,
                BUCKET_NAME: args.bucket.id // <-- Pass bucket name to handler
            },
        },
    });

    // Trigger Layer A: S3 Upload Completion Hook
    args.bucket.onObjectCreated("newUploadNotificationEvent", s3SyncLambda, {
        filterPrefix: "uploads/",
    });

    // Trigger Layer B: DynamoDB Stream Deletion Hook
    new aws.lambda.EventSourceMapping("dynamoTtlStreamMapping", {
        eventSourceArn: args.tableStreamArn,
        functionName: s3SyncLambda.arn,
        startingPosition: "LATEST",
        batchSize: 10,
    });
}