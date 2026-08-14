import type { ResourcesConfig } from "aws-amplify";

const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;
const cognitoUserPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;
const cognitoClientId = import.meta.env.VITE_COGNITO_CLIENT_ID;

export const awsConfig: ResourcesConfig = {
	Auth: {
		Cognito: {
			userPoolClientId: cognitoClientId,
			userPoolId: cognitoUserPoolId,

			loginWith: {
				email: true,
				oauth: {
					domain: cognitoDomain,
					scopes: ["email", "openid", "profile"],
					redirectSignIn: [
						"http://localhost:3000/auth/callback",
						"https://share.apps.nacou.dev/auth/callback",
					],
					redirectSignOut: [
						"http://localhost:3000",
						"https://share.apps.nacou.dev",
					],
					responseType: "code",
				},
			},
			signUpVerificationMethod: "code",
		},
	},
};
