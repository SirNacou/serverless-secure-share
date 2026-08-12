import { BatchGetItemCommand, DynamoDBClient, QueryCommand, ScanCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });

const TABLE_NAME = process.env.TABLE_NAME;
const PROFILE_TABLE_NAME = process.env.PROFILE_TABLE_NAME;

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

function computeStatus(item) {
	const now = Math.floor(Date.now() / 1000);
	if (item.ttl != null && item.ttl <= now) {
		return "EXPIRED";
	}
	if (item.max_downloads != null && item.download_count >= item.max_downloads) {
		return "CONSUMED";
	}
	return item.status;
}

function matchesSearch(entry, query) {
	if (!query) return true;
	const q = query.toLowerCase();
	return (
		(entry.share_name && entry.share_name.toLowerCase().includes(q)) ||
		(entry.link_id && entry.link_id.toLowerCase().includes(q))
	);
}

export const handler = async (event) => {
	try {
		const authHeader = event.headers?.authorization || event.headers?.Authorization;
		const decodedToken = decodeCognitoToken(authHeader);
		const currentUsername = decodedToken?.username;

		const q = event.queryStringParameters?.q?.trim() || "";

		const seen = new Map();

		// 1. Always query public shares via by_visibility GSI
		const publicResult = await dynamoClient.send(
			new QueryCommand({
				TableName: TABLE_NAME,
				IndexName: "by_visibility",
				KeyConditionExpression: "visibility = :public",
				ExpressionAttributeValues: {
					":public": { S: "public" },
				},
				ScanIndexForward: false,
			}),
		);

		for (const item of publicResult.Items || []) {
			const entry = unmarshallItem(item);
			entry.status = computeStatus(entry);
			if (entry.status !== "EXPIRED" && matchesSearch(entry, q)) {
				seen.set(entry.link_id, entry);
			}
		}

		if (currentUsername) {
			// 2. Query own shares via by_owner GSI
			const ownerResult = await dynamoClient.send(
				new QueryCommand({
					TableName: TABLE_NAME,
					IndexName: "by_owner",
					KeyConditionExpression: "owner_username = :username",
					ExpressionAttributeValues: {
						":username": { S: currentUsername },
					},
				}),
			);

			for (const item of ownerResult.Items || []) {
				const entry = unmarshallItem(item);
				entry.status = computeStatus(entry);
				if (entry.status !== "EXPIRED" && matchesSearch(entry, q)) {
					seen.set(entry.link_id, entry);
				}
			}

			// 3. Scan for private shares shared with current user
			const sharedResult = await dynamoClient.send(
				new ScanCommand({
					TableName: TABLE_NAME,
					FilterExpression: "visibility = :private AND contains(allowed_users, :username)",
					ExpressionAttributeValues: {
						":private": { S: "private" },
						":username": { S: currentUsername },
					},
				}),
			);

			for (const item of sharedResult.Items || []) {
				const entry = unmarshallItem(item);
				entry.status = computeStatus(entry);
				if (entry.status !== "EXPIRED" && matchesSearch(entry, q)) {
					seen.set(entry.link_id, entry);
				}
			}
		}

		const shares = Array.from(seen.values()).sort((a, b) => {
			const aTime = a.created_at || 0;
			const bTime = b.created_at || 0;
			return bTime - aTime;
		});

		// Resolve display names and emails from user-profiles table
		const uniqueOwners = [...new Set(shares.map((s) => s.owner_username).filter(Boolean))];
		if (uniqueOwners.length > 0 && PROFILE_TABLE_NAME) {
			const profileResult = await dynamoClient.send(
				new BatchGetItemCommand({
					RequestItems: {
						[PROFILE_TABLE_NAME]: {
							Keys: uniqueOwners.map((username) => ({ username: { S: username } })),
							ProjectionExpression: "username, display_name",
							ConsistentRead: true,
						},
					},
				}),
			);

			const displayNameMap = {};
			for (const item of profileResult.Responses?.[PROFILE_TABLE_NAME] || []) {
				if (item.username?.S && item.display_name?.S) {
					displayNameMap[item.username.S] = item.display_name.S;
				}
			}

			for (const share of shares) {
				if (share.owner_username && displayNameMap[share.owner_username]) {
					share.owner_display_name = displayNameMap[share.owner_username];
				}
			}
		}

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ shares, count: shares.length }),
		};
	} catch (error) {
		console.error("Explore error:", error);
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
