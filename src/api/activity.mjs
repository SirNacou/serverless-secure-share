import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const AUDIT_TABLE_NAME = process.env.AUDIT_TABLE_NAME;

function unmarshallItem(item) {
	const entry = {};
	for (const [key, value] of Object.entries(item)) {
		if (value.S !== undefined) entry[key] = value.S;
		else if (value.N !== undefined) entry[key] = Number(value.N);
		else if (value.SS !== undefined) entry[key] = value.SS;
		else if (value.BOOL !== undefined) entry[key] = value.BOOL;
		else if (value.NULL !== undefined) entry[key] = null;
	}
	return entry;
}

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
		const authHeader = event.headers?.authorization || event.headers?.Authorization;
		const decodedToken = decodeCognitoToken(authHeader);
		const ownerUsername = decodedToken?.username;

		if (!ownerUsername) {
			return {
				statusCode: 401,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Unauthorized" }),
			};
		}

		const result = await dynamoClient.send(
			new QueryCommand({
				TableName: AUDIT_TABLE_NAME,
				IndexName: "by_owner",
				KeyConditionExpression: "owner_username = :owner",
				ExpressionAttributeValues: {
					":owner": { S: ownerUsername },
				},
				ScanIndexForward: false,
			}),
		);

		const events = (result.Items || []).map(unmarshallItem);

		const latestByLink = new Map();
		for (const event of events) {
			const existing = latestByLink.get(event.link_id);
			if (!existing || event.timestamp > existing.timestamp) {
				latestByLink.set(event.link_id, event);
			}
		}

		const shares = Array.from(latestByLink.values());

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ shares, count: shares.length }),
		};
	} catch (error) {
		console.error("Activity query error:", error);
		return {
			statusCode: 500,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ error: "Internal server error" }),
		};
	}
};