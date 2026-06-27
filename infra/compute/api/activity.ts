import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ActivityArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	auditTableName: pulumi.Input<string>;
}

export function createActivityRoute(args: ActivityArgs) {
	const lambdaRole = new aws.iam.Role("activity-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("activity-lambda-logs", {
		role: lambdaRole.name,
		policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("activity-dynamo-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.auditTableName]).apply(([tableName]) =>
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

	const activityLambda = new aws.lambda.Function("activityFunction", {
		code: new pulumi.asset.AssetArchive({
			".": new pulumi.asset.FileArchive("./src/api"),
		}),
		runtime: "nodejs24.x",
		handler: "activity.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				AUDIT_TABLE_NAME: args.auditTableName,
			},
		},
	});

	const activityIntegration = new aws.apigatewayv2.Integration("activity-integration", {
		apiId: args.httpApi.id,
		integrationType: "AWS_PROXY",
		integrationUri: activityLambda.invokeArn,
		payloadFormatVersion: "2.0",
	});

	new aws.apigatewayv2.Route("activity-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/activity",
		target: pulumi.interpolate`integrations/${activityIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	new aws.lambda.Permission("api-gateway-activity-invoke", {
		action: "lambda:InvokeFunction",
		function: activityLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/activity`,
	});
}