import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createAuth() {
    const config = new pulumi.Config("google");

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

    const googleClientId = config.requireSecret("clientId");
    const googleClientSecret = config.requireSecret("clientSecret");

    const googleIdp = new aws.cognito.IdentityProvider("google", {
        userPoolId: userPool.id,
        providerName: "Google",
        providerType: "Google",
        providerDetails: {
            client_id: googleClientId,
            client_secret: googleClientSecret,
            authorize_scopes: "email profile",
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
            googleIdp.providerName,
        ],
        allowedOauthFlowsUserPoolClient: true,
        allowedOauthFlows: ["code"],
        allowedOauthScopes: ["email", "openid", "profile"],
    });

    const googleCallbackUrl = pulumi.interpolate`https://${cognitoDomain}/oauth2/idpresponse`;

    return { userPool, userPoolClient, domain, cognitoDomain, googleCallbackUrl };
}