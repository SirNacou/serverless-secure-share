import { env } from "#/env";
import { fetchAuthSession } from "aws-amplify/auth";
import ky from "ky";

// Establish your backend API Gateway domain target
const API_BASE_URL = env.VITE_API_ENDPOINT;

export const api = ky.create({
	baseUrl: API_BASE_URL,
	timeout: 30000, // 30-second boundary limit
	hooks: {
		beforeRequest: [
			async ({ request }) => {
				try {
					// Fetch the active authorization session from Amplify cache
					const session = await fetchAuthSession();
					const token = session.tokens?.accessToken?.toString();

					if (token) {
						request.headers.set("Authorization", `Bearer ${token}`);
					}
				} catch (error) {
					// Session missing or expired; handle downstream or let API gateway drop it
					console.warn(
						"Failed to append secure Cognito context session:",
						error,
					);
				}
			},
		],
	},
});
