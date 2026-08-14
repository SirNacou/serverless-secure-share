import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface UploadArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	bucketId: pulumi.Input<string>;
	tableName: pulumi.Input<string>;
	auditQueueUrl: pulumi.Input<string>;
	auditQueueArn: pulumi.Input<string>;
}

export function createUploadRoute(args: UploadArgs) {
	const lambdaRole = new aws.iam.Role("api-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicy("upload-api-policy", {
		role: lambdaRole.name,
		policy: pulumi
			.all([args.tableName, args.bucketId, args.auditQueueArn])
				.apply(([tableName, bucketId, auditQueueArn]) =>
					JSON.stringify({
						Version: "2012-10-17",
						Statement: [
							{
								Sid: "DynamoDBAccess",
								Effect: "Allow",
								Action: ["dynamodb:GetItem", "dynamodb:PutItem"],
								Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
							},
							{
								Sid: "S3RestrictedWriteAccess",
								Effect: "Allow",
								Action: ["s3:PutObject"],
								Resource: [`arn:aws:s3:::${bucketId}/uploads/*`],
							},
							{
								Sid: "AuditSQSWriteAccess",
								Effect: "Allow",
								Action: ["sqs:SendMessage"],
								Resource: [auditQueueArn],
							},
						],
					}),
				),
	});

	new aws.iam.RolePolicyAttachment("upload-lambda-logs", {
		role: lambdaRole.name,
		policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	const generateUrlLambda = new aws.lambda.Function("generateUrlFunction", {
		code: new pulumi.asset.AssetArchive({
			"upload.mjs": new pulumi.asset.FileAsset("./src/api/upload.mjs"),
		}),
		runtime: "nodejs24.x",
		handler: "upload.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				BUCKET_NAME: args.bucketId,
				TABLE_NAME: args.tableName,
				AUDIT_QUEUE_URL: args.auditQueueUrl,
			},
		},
	});

	const lambdaIntegration = new aws.apigatewayv2.Integration(
		"lambda-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: generateUrlLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	new aws.apigatewayv2.Route("upload-route", {
		apiId: args.httpApi.id,
		routeKey: "POST /api/upload",
		target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	new aws.lambda.Permission("api-gateway-invoke", {
		action: "lambda:InvokeFunction",
		function: generateUrlLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*`,
	});
}
