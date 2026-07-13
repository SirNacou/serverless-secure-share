import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ProfileArgs {
	httpApi: aws.apigatewayv2.Api;
	apiAuthorizer: aws.apigatewayv2.Authorizer;
	profileTableName: pulumi.Input<string>;
}

export function createProfileRoute(args: ProfileArgs) {
	const lambdaRole = new aws.iam.Role("profile-lambda-role", {
		assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
			Service: "lambda.amazonaws.com",
		}),
	});

	new aws.iam.RolePolicyAttachment("profile-lambda-logs", {
		role: lambdaRole.name,
		policyArn:
			"arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
	});

	new aws.iam.RolePolicy("profile-dynamo-policy", {
		role: lambdaRole.name,
		policy: pulumi.all([args.profileTableName]).apply(([profileTableName]) =>
			JSON.stringify({
				Version: "2012-10-17",
				Statement: [
					{
						Effect: "Allow",
						Action: ["dynamodb:GetItem", "dynamodb:PutItem"],
						Resource: [`arn:aws:dynamodb:*:*:table/${profileTableName}`],
					},
				],
			}),
		),
	});

	const profileLambda = new aws.lambda.Function("profileFunction", {
		code: new pulumi.asset.AssetArchive({
			"profile.mjs": new pulumi.asset.FileAsset("./src/api/profile.mjs"),
		}),
		runtime: "nodejs24.x",
		handler: "profile.handler",
		role: lambdaRole.arn,
		environment: {
			variables: {
				PROFILE_TABLE_NAME: args.profileTableName,
			},
		},
	});

	const lambdaIntegration = new aws.apigatewayv2.Integration(
		"profile-integration",
		{
			apiId: args.httpApi.id,
			integrationType: "AWS_PROXY",
			integrationUri: profileLambda.arn,
			payloadFormatVersion: "2.0",
		},
	);

	// GET /api/profile - fetch user's profile
	new aws.apigatewayv2.Route("get-profile-route", {
		apiId: args.httpApi.id,
		routeKey: "GET /api/profile",
		target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	// PUT /api/profile - update user's profile
	new aws.apigatewayv2.Route("put-profile-route", {
		apiId: args.httpApi.id,
		routeKey: "PUT /api/profile",
		target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
		authorizationType: "JWT",
		authorizerId: args.apiAuthorizer.id,
	});

	new aws.lambda.Permission("api-gateway-profile-invoke", {
		action: "lambda:InvokeFunction",
		function: profileLambda.name,
		principal: "apigateway.amazonaws.com",
		sourceArn: pulumi.interpolate`${args.httpApi.executionArn}/*/*/api/profile`,
	});
}
