import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createAuth() {
    const config = new pulumi.Config("github");

    const userPool = new aws.cognito.UserPool("app-user-pool", {
        name: "serverless-secure-share-pool",
        autoVerifiedAttributes: ["email"],
        passwordPolicy: {
            minimumLength: 8,
            requireLowercase: true,
            requireNumbers: true,
            requireSymbols: true,
            requireUppercase: true,
        },
    });

    const domain = new aws.cognito.UserPoolDomain("app-domain", {
        domain: pulumi.interpolate`secure-share-${pulumi.getStack()}`,
        userPoolId: userPool.id,
    });

    const region = aws.getRegionOutput().name;
    const cognitoDomain = pulumi.interpolate`${domain.domain}.auth.${region}.amazoncognito.com`;

    const githubClientId = config.requireSecret("clientId");
    const githubClientSecret = config.requireSecret("clientSecret");

    const githubIdp = new aws.cognito.IdentityProvider("github", {
        userPoolId: userPool.id,
        providerName: "GitHub",
        providerType: "OIDC",
        providerDetails: {
            client_id: githubClientId,
            client_secret: githubClientSecret,
            authorize_scopes: "user:email",
            authorize_url: "https://github.com/login/oauth/authorize",
            token_url: "https://github.com/login/oauth/access_token",
            attributes_url: "https://api.github.com/user",
            attributes_url_add_attributes: "false",
            attributes_request_method: "GET",
            oidc_issuer: "https://github.com",
        },
        attributeMapping: {
            email: "email",
        },
    });

    const userPoolClient = new aws.cognito.UserPoolClient("app-user-pool-client", {
        name: "secure-share-web-client",
        userPoolId: userPool.id,
        explicitAuthFlows: [
            "ALLOW_USER_SRP_AUTH", 
            "ALLOW_USER_PASSWORD_AUTH", 
            "ALLOW_REFRESH_TOKEN_AUTH",
        ],
        callbackUrls: [
            "http://localhost:3000/auth/callback",
            "https://share.apps.nacou.dev/auth/callback",
        ],
        logoutUrls: [
            "http://localhost:3000",
            "https://share.apps.nacou.dev",
        ],
        supportedIdentityProviders: [
            "COGNITO",
            githubIdp.providerName,
        ],
        allowedOauthFlowsUserPoolClient: true,
        allowedOauthFlows: ["code"],
        allowedOauthScopes: ["email", "openid", "profile"],
    });

    const githubCallbackUrl = pulumi.interpolate`https://${cognitoDomain}/oauth2/idpresponse`;

    return { userPool, userPoolClient, domain, cognitoDomain, githubCallbackUrl };
}