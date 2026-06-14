import type { ResourcesConfig } from "aws-amplify";

export const awsConfig: ResourcesConfig = {
	Auth: {
		Cognito: {
			userPoolClientId: "609767nccd4a58ukf3h3rdah7j",
			userPoolId: "ap-southeast-1_uhJSMv7Ru",

			loginWith: {
				email: true,
			},
			signUpVerificationMethod: "link",
		},
	},
};
