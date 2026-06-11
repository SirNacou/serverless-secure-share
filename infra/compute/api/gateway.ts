import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface GatewayArgs {
	userPoolId: pulumi.Input<string>;
	userPoolClientId: pulumi.Input<string>;
}

export function createApiGateway(args: GatewayArgs) {
	const httpApi = new aws.apigatewayv2.Api("http-api", {
		protocolType: "HTTP",
		corsConfiguration: {
			allowOrigins: ["http://localhost:3000"],
			allowMethods: ["POST", "GET", "OPTIONS"], // Added GET globally
			allowHeaders: ["content-type", "authorization"],
			maxAge: 300,
		},
	});

	const apiAuthorizer = new aws.apigatewayv2.Authorizer("api-authorizer", {
		apiId: httpApi.id,
		authorizerType: "JWT",
		identitySources: ["$request.header.Authorization"],
		jwtConfiguration: {
			issuer: pulumi.interpolate`https://cognito-idp.${aws.getRegionOutput().name}.amazonaws.com/${args.userPoolId}`,
			audiences: [args.userPoolClientId],
		},
	});

	new aws.apigatewayv2.Stage("api-stage", {
		apiId: httpApi.id,
		name: "$default",
		autoDeploy: true,
	});

	return { httpApi, apiAuthorizer };
}
