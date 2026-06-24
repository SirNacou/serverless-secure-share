import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface DownloadArgs {
    httpApi: aws.apigatewayv2.Api;
    bucketId: pulumi.Input<string>;
    tableName: pulumi.Input<string>;
    auditQueueUrl: pulumi.Input<string>;
    auditQueueArn: pulumi.Input<string>;
}

export function createDownloadRoute(args: DownloadArgs) {
    const downloadRole = new aws.iam.Role("download-lambda-role", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        }),
    });

    new aws.iam.RolePolicyAttachment("download-logs", {
        role: downloadRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });

    new aws.iam.RolePolicy("download-dynamo-policy", {
        role: downloadRole.name,
        policy: pulumi.all([args.tableName]).apply(([tableName]) =>
            JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["dynamodb:GetItem", "dynamodb:UpdateItem"],
                        Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
                    },
                ],
            }),
        ),
    });

    new aws.iam.RolePolicy("download-s3-policy", {
        role: downloadRole.name,
        policy: pulumi.all([args.bucketId]).apply(([bucketId]) =>
            JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["s3:GetObject", "s3:DeleteObject"],
                        Resource: [`arn:aws:s3:::${bucketId}/*`],
                    },
                ],
            }),
        ),
    });

    new aws.iam.RolePolicy("download-sqs-policy", {
        role: downloadRole.name,
        policy: pulumi.all([args.auditQueueArn]).apply(([queueArn]) =>
            JSON.stringify({
                Version: "2012-10-17",
                Statement: [
                    {
                        Effect: "Allow",
                        Action: ["sqs:SendMessage"],
                        Resource: [queueArn],
                    },
                ],
            }),
        ),
    });

    const downloadUrlLambda = new aws.lambda.Function("downloadUrlFunction", {
        code: new pulumi.asset.AssetArchive({
            ".": new pulumi.asset.FileArchive("./src/api"),
        }),
        runtime: "nodejs24.x",
        handler: "download.handler",
        role: downloadRole.arn,
        environment: {
            variables: {
                BUCKET_NAME: args.bucketId,
                TABLE_NAME: args.tableName,
                AUDIT_QUEUE_URL: args.auditQueueUrl,
            },
        },
    });

    // Mount integration using the execution invokeArn mapping token parameter
    const downloadIntegration = new aws.apigatewayv2.Integration("download-integration", {
        apiId: args.httpApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: downloadUrlLambda.invokeArn, // FIX: Resolves BadRequestException URI issue
        payloadFormatVersion: "2.0",
    });

    // Public Sharing route definition block
    new aws.apigatewayv2.Route("get-share-route", {
        apiId: args.httpApi.id,
        routeKey: "GET /api/share/{shareId}",
        target: pulumi.interpolate`integrations/${downloadIntegration.id}`,
        // Dropping authorizationType config fields keeps this path completely public
    });

    new aws.lambda.Permission("api-gateway-download-invoke", {
        action: "lambda:InvokeFunction",
        function: downloadUrlLambda.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/share/*`,
    });
}