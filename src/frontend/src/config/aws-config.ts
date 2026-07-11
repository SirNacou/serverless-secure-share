import type { ResourcesConfig } from "aws-amplify";

const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN;

export const awsConfig: ResourcesConfig = {
	Auth: {
		Cognito: {
			userPoolClientId: "609767nccd4a58ukf3h3rdah7j",
			userPoolId: "ap-southeast-1_uhJSMv7Ru",

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
