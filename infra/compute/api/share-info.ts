import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ShareInfoArgs {
	httpApi: aws.apigatewayv2.Api;
	tableName: pulumi.Input<string>;
}

export function createShareInfoRoute(args: ShareInfoArgs) {
	const infoRole = new aws.iam.Role("share-info-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("share-info-lambda-logs", {
		role: infoRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("share-info-dynamo-policy", {
		role: infoRole.name,
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

	const infoLambda = new aws.lambda.Function("shareInfoFunction", {
		code: new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive("./src/api"),
		}),
		runtime: "nodejs24.x",
		handler: "share-info.handler",
		role: infoRole.arn,
		environment: {
			variables: {
				TABLE_NAME: args.tableName,
			},
		},
	});

	const infoIntegration = new aws.apigatewayv2.Integration(
		"share-info-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: infoLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	// Reuse the existing route name so Pulumi updates the integration in-place
	// instead of attempting a create+delete on the same route key.
	new aws.apigatewayv2.Route("get-share-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/share/{shareId}",
		target: pulumi.interpolate`integrations/${infoIntegration.id}`,
	});

	new aws.lambda.Permission("api-gateway-share-info-invoke", {
		action: "lambda:InvokeFunction",
		function: infoLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/share/*`,
	});
}
