import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface UploadArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	bucketId: pulumi.Input<string>;
	tableName: pulumi.Input<string>;
}

export function createUploadRoute(args: UploadArgs) {
	const lambdaRole = new aws.iam.Role("api-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("lambda-logs", {
		role: lambdaRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	// Enforce Write-Only database scope
	new aws.iam.RolePolicy("lambda-dynamo-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.tableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:PutItem"],
						Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
					},
				],
			}),
		),
	});

	// Enforce Write-Only bucket scope
	new aws.iam.RolePolicy("lambda-s3-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.bucketId]).apply(([bucketId]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["s3:PutObject"],
						Resource: [`arn:aws:s3:::${bucketId}/*`],
					},
				],
			}),
		),
	});

	const generateUrlLambda = new aws.lambda.Function("generateUrlFunction", {
		code: new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive("./src/api"),
		}),
		runtime: "nodejs24.x",
		handler: "upload.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				BUCKET_NAME: args.bucketId,
				TABLE_NAME: args.tableName,
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
