import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});

const TABLE_NAME = process.env.TABLE_NAME;

function decodeCognitoToken(authHeader) {
	if (!authHeader) return null;
	try {
		const token = authHeader.replace("Bearer ", "");
		const base64Url = token.split(".")[1];
		const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
		const jsonPayload = Buffer.from(base64, "base64").toString("utf8");
		return JSON.parse(jsonPayload);
	} catch (e) {
		console.warn("JWT parsing exception caught:", e);
		return null;
	}
}

export const handler = async (event) => {
	try {
		const linkId = event.pathParameters?.shareId;

		if (!linkId) {
			return {
				statusCode: 400,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Missing link identifier." }),
			};
		}

		const authHeader =
			event.headers?.authorization || event.headers?.Authorization;
		const decodedToken = decodeCognitoToken(authHeader);
		const currentUsername = decodedToken?.username;

		const dbResult = await dynamoClient.send(
			new GetItemCommand({
				TableName: TABLE_NAME,
				Key: { link_id: { S: linkId } },
			}),
		);

		if (!dbResult.Item) {
			return {
				statusCode: 404,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Resource not found or expired." }),
			};
		}

		const item = dbResult.Item;
		const assetType = item.asset_type?.S;
		const visibility = item.visibility?.S;
		const ownerUsername = item.owner_username?.S;
		const allowedUsers = item.allowed_users?.SS || [];
		const ttl = item.ttl?.N ? parseInt(item.ttl.N, 10) : null;

		if (ttl && Math.floor(Date.now() / 1000) > ttl) {
			return {
				statusCode: 404,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Resource has expired." }),
			};
		}

		if (visibility === "private") {
			if (!currentUsername) {
				return {
					statusCode: 403,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						error: "Access Denied: Private asset authorization header missing.",
					}),
				};
			}

			const isOwner = ownerUsername === currentUsername;
			const isAllowed = allowedUsers.includes(currentUsername);

			if (!isOwner && !isAllowed) {
				return {
					statusCode: 403,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						error: "Access Denied: User identity not authorized to read this share.",
					}),
				};
			}
		}

		const responseBody = {
			link_id: linkId,
			share_name: item.share_name?.S || "Untitled Share",
			asset_type: assetType,
			visibility: visibility,
			status: item.status?.S,
			download_count: item.download_count?.N ? parseInt(item.download_count.N, 10) : 0,
			max_downloads: item.max_downloads?.N ? parseInt(item.max_downloads.N, 10) : null,
		};

		if (assetType === "FILE") {
			responseBody.filename = item.filename?.S;
		}

		if (assetType === "TEXT") {
			responseBody.payload_text = item.payload_text?.S || "";
		}

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify(responseBody),
		};
	} catch (error) {
		console.error("Share info error:", error);
		return {
			statusCode: 500,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				error: "Internal operational exception encountered.",
			}),
		};
	}
};
