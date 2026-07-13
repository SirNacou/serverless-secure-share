import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const PROFILE_TABLE_NAME = process.env.PROFILE_TABLE_NAME;

function corsHeaders() {
	return {
		"Content-Type": "application/json",
		"Access-Control-Allow-Origin": "*",
	};
}

function errorResponse(statusCode, message) {
	return {
		statusCode,
		headers: corsHeaders(),
		body: JSON.stringify({ error: message }),
	};
}

function successResponse(body) {
	return {
		statusCode: 200,
		headers: corsHeaders(),
		body: JSON.stringify(body),
	};
}

function validateDisplayName(name) {
	if (typeof name !== "string") return "Display name must be a string";
	const trimmed = name.trim();
	if (trimmed.length < 1) return "Display name cannot be empty";
	if (trimmed.length > 50) return "Display name must be 50 characters or less";
	return null;
}

export const handler = async (event) => {
	try {
		const username = event.requestContext?.authorizer?.jwt?.claims?.username;

		if (!username) {
			return errorResponse(401, "Unauthorized");
		}

		const method = event.requestContext?.http?.method;

		if (method === "GET") {
			const result = await dynamoClient.send(
				new GetItemCommand({
					TableName: PROFILE_TABLE_NAME,
					Key: {
						username: { S: username },
					},
				}),
			);

			const displayName = result.Item?.display_name?.S || null;

			return successResponse({ username, display_name: displayName });
		}

		if (method === "PUT") {
			const body = JSON.parse(event.body || "{}");
			const displayName = body.display_name;

			const validationError = validateDisplayName(displayName);
			if (validationError) {
				return errorResponse(400, validationError);
			}

			const trimmed = displayName.trim();

			await dynamoClient.send(
				new PutItemCommand({
					TableName: PROFILE_TABLE_NAME,
					Item: {
						username: { S: username },
						display_name: { S: trimmed },
						updated_at: { N: Math.floor(Date.now() / 1000).toString() },
					},
				}),
			);

			return successResponse({ username, display_name: trimmed });
		}

		return errorResponse(405, "Method not allowed");
	} catch (error) {
		console.error("Profile error:", error);
		return errorResponse(500, "Internal server error");
	}
};
