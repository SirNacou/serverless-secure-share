import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface DownloadArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	bucketId: pulumi.Input<string>;
	tableName: pulumi.Input<string>;
}

export function createDownloadRoute(args: DownloadArgs) {
	const downloadRole = new aws.iam.Role("download-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("download-logs", {
		role: downloadRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	// Enforce Read-Only database scope
	new aws.iam.RolePolicy("download-dynamo-policy", {
		role: downloadRole.name,
		policy: pulumi.all([args.tableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:GetItem"],
						Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
					},
				],
			}),
		),
	});

	// Enforce Read-Only bucket scope
	new aws.iam.RolePolicy("download-s3-policy", {
		role: downloadRole.name,
		policy: pulumi.all([args.bucketId]).apply(([bucketId]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["s3:GetObject"],
						Resource: [`arn:aws:s3:::${bucketId}/*`],
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
			},
		},
	});

	const downloadIntegration = new aws.apigatewayv2.Integration(
		"download-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: downloadUrlLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	new aws.apigatewayv2.Route("download-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/download/{id}",
		target: pulumi.interpolate`integrations/${downloadIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	new aws.lambda.Permission("api-gateway-download-invoke", {
		action: "lambda:InvokeFunction",
		function: downloadUrlLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*`,
	});
}
