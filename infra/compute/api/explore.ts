import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ExploreArgs {
	httpApi: aws.apigatewayv2.Api;
	tableName: pulumi.Input<string>;
}

export function createExploreRoute(args: ExploreArgs) {
	const lambdaRole = new aws.iam.Role("explore-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("explore-lambda-logs", {
		role: lambdaRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("explore-dynamo-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.tableName]).apply(([tableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:Query", "dynamodb:Scan"],
						Resource: [
							`arn:aws:dynamodb:*:*:table/${tableName}`,
							`arn:aws:dynamodb:*:*:table/${tableName}/index/*`,
						],
					},
				],
			}),
		),
	});

	const exploreLambda = new aws.lambda.Function("exploreSharesFunction", {
		code: new pulumi.asset.AssetArchive({
			"explore.mjs": new pulumi.asset.FileAsset("./src/api/explore.mjs"),
		}),
		runtime: "nodejs24.x",
		handler: "explore.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				TABLE_NAME: args.tableName,
			},
		},
	});

	const exploreIntegration = new aws.apigatewayv2.Integration(
		"explore-shares-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: exploreLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	new aws.apigatewayv2.Route("explore-shares-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/explore",
		target: pulumi.interpolate`integrations/${exploreIntegration.id}`,
	});

	new aws.lambda.Permission("api-gateway-explore-invoke", {
		action: "lambda:InvokeFunction",
		function: exploreLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/explore`,
	});
}