import * as aws from "@pulumi/aws";

const ORG = "SirNacou";
const REPO = "serverless-secure-share";

export function createCiRole() {
	const githubProvider = new aws.iam.OpenIdConnectProvider("github-actions", {
		url: "https://token.actions.githubusercontent.com",
		clientIdLists: ["sts.amazonaws.com"],
		thumbprintLists: ["6938fd4d98bab03faadb97b34396831e3780aea1"],
	});

	const deployRole = new aws.iam.Role("github-actions-role", {
		name: "github-actions-pulumi-deploy",
		assumeRolePolicy: {
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Principal: { Federated: githubProvider.arn },
					Action: "sts:AssumeRoleWithWebIdentity",
					Condition: {
						StringEquals: {
							"token.actions.githubusercontent.com:aud": "sts.amazonaws.com",
						},
						StringLike: {
							"token.actions.githubusercontent.com:sub": `repo:${ORG}/${REPO}:*`,
						},
					},
				},
			],
		},
	});

	const deployPolicy = new aws.iam.Policy("pulumi-deploy-policy", {
		name: "pulumi-serverless-deploy",
		policy: {
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Action: [
						"s3:*",
						"lambda:*",
						"apigateway:*",
						"cloudfront:*",
						"cognito-idp:*",
						"dynamodb:*",
						"sqs:*",
						"acm:*",
						"iam:*",
						"logs:*",
						"ec2:Describe*",
					],
					Resource: "*",
				},
			],
		},
	});

	new aws.iam.RolePolicyAttachment("pulumi-deploy-policy-attachment", {
		role: deployRole.name,
		policyArn: deployPolicy.arn,
	});

	return { ciRoleArn: deployRole.arn };
}
