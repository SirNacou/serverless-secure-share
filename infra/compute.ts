import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

interface ComputeArgs {
    bucketId: pulumi.Input<string>;
    tableName: pulumi.Input<string>;
    userPoolId: pulumi.Input<string>;       // Accept Cognito User Pool ID
    userPoolClientId: pulumi.Input<string>; // Accept Cognito Client ID
}

export function createCompute(args: ComputeArgs) {
    const lambdaRole = new aws.iam.Role("api-lambda-role", {
        assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
            Service: "lambda.amazonaws.com",
        }),
    });

    new aws.iam.RolePolicyAttachment("lambda-logs", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole",
    });

    new aws.iam.RolePolicyAttachment("lambda-s3-access", {
        role: lambdaRole.name,
        policyArn: "arn:aws:iam::aws:policy/AmazonS3FullAccess", 
    });

    const dynamoPolicy = new aws.iam.RolePolicy("lambda-dynamo-policy", {
        role: lambdaRole.name,
        policy: pulumi.all([args.tableName]).apply(([tableName]) => JSON.stringify({
            Version: "2012-10-17",
            Statement: [{
                Effect: "Allow",
                Action: ["dynamodb:PutItem"],
                Resource: [`arn:aws:dynamodb:*:*:table/${tableName}`],
            }],
        })),
    });

    const generateUrlLambda = new aws.lambda.Function("generateUrlFunction", {
        code: new pulumi.asset.AssetArchive({
            "index.mjs": new pulumi.asset.FileAsset("./src/api/index.mjs"),
        }),
        runtime: "nodejs24.x",
        handler: "index.handler", 
        role: lambdaRole.arn,
        environment: {
            variables: {
                BUCKET_NAME: args.bucketId,
                TABLE_NAME: args.tableName,
            },
        },
    });

    // 1. Establish the API Gateway V2 Engine
    const httpApi = new aws.apigatewayv2.Api("http-api", {
        protocolType: "HTTP",
    });

    // 2. Define the Cognito JWT Edge Authorizer
    const apiAuthorizer = new aws.apigatewayv2.Authorizer("api-authorizer", {
        apiId: httpApi.id,
        authorizerType: "JWT",
        identitySources: ["$request.header.Authorization"],
        jwtConfiguration: {
            // Evaluates issuer against the precise regional Cognito endpoint
            issuer: pulumi.interpolate`https://cognito-idp.${aws.getRegionOutput().name}.amazonaws.com/${args.userPoolId}`,
            audiences: [args.userPoolClientId],
        },
    });

    const lambdaIntegration = new aws.apigatewayv2.Integration("lambda-integration", {
        apiId: httpApi.id,
        integrationType: "AWS_PROXY",
        integrationUri: generateUrlLambda.arn,
        payloadFormatVersion: "2.0",
    });

    // 3. Attach the Authorizer to your Route Block
    new aws.apigatewayv2.Route("upload-route", {
        apiId: httpApi.id,
        routeKey: "POST /api/upload",
        target: pulumi.interpolate`integrations/${lambdaIntegration.id}`,
        authorizationType: "JWT",             // Enforce JWT validation
        authorizerId: apiAuthorizer.id,        // Bind the Cognito authorizer
    });

    new aws.apigatewayv2.Stage("api-stage", {
        apiId: httpApi.id,
        name: "$default",
        autoDeploy: true,
    });

    new aws.lambda.Permission("api-gateway-invoke", {
        action: "lambda:InvokeFunction",
        function: generateUrlLambda.name,
        principal: "apigateway.amazonaws.com",
        sourceArn: pulumi.interpolate`${httpApi.executionArn}/*/*`,
    });

    return { apiUrl: httpApi.apiEndpoint };
}