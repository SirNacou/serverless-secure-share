import { fetchAuthSession } from "aws-amplify/auth";
import ky from "ky";

// Establish your backend API Gateway domain target
const API_BASE_URL = import.meta.env.VITE_API_ENDPOINT;

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
		beforeError: [
			async (state) => {
				const raw = (state.error as unknown as Record<string, unknown>).data;
				let errorMessage: string | undefined;

				if (typeof raw === "string") {
					try {
						const parsed = JSON.parse(raw);
						if (parsed?.error) errorMessage = parsed.error;
					} catch {
						// not JSON — ignore
					}
				} else if (raw && typeof raw === "object" && "error" in (raw as Record<string, unknown>)) {
					const candidate = (raw as Record<string, unknown>).error;
					if (typeof candidate === "string") errorMessage = candidate;
				}

				if (errorMessage) {
					return new Error(errorMessage);
				}
				return state.error;
			},
		],
	},
});
