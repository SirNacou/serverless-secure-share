import * as aws from "@pulumi/aws";

export function createAuth() {
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

    const userPoolClient = new aws.cognito.UserPoolClient("app-user-pool-client", {
        name: "secure-share-web-client",
        userPoolId: userPool.id,
        explicitAuthFlows: ["ALLOW_USER_SRP_AUTH", "ALLOW_REFRESH_TOKEN_AUTH"],
    });

    return { userPool, userPoolClient };
}