import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ListArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	tableName: pulumi.Input<string>;
}

export function createListRoute(args: ListArgs) {
	const lambdaRole = new aws.iam.Role("list-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("list-lambda-logs", {
		role: lambdaRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("list-dynamo-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.tableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:Query"],
						Resource: [
							`arn:aws:dynamodb:*:*:table/${tableName}`,
							`arn:aws:dynamodb:*:*:table/${tableName}/index/*`,
						],
					},
				],
			}),
		),
	});

	const listLambda = new aws.lambda.Function("listSharesFunction", {
		code: new pulumi.asset.AssetArchive({
			"list.mjs": new pulumi.asset.FileAsset("./src/api/list.mjs"),
		}),
		runtime: "nodejs24.x",
		handler: "list.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				TABLE_NAME: args.tableName,
			},
		},
	});

	const listIntegration = new aws.apigatewayv2.Integration(
		"list-shares-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: listLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	new aws.apigatewayv2.Route("list-shares-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/shares",
		target: pulumi.interpolate`integrations/${listIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	new aws.lambda.Permission("api-gateway-list-invoke", {
		action: "lambda:InvokeFunction",
		function: listLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/shares`,
	});
}
