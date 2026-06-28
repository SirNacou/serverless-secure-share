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

export const handler = async (event) => {
	try {
		const ownerUsername = event.requestContext?.authorizer?.jwt?.claims?.username;

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
		const createdEventsByLink = new Map();
		for (const auditEvent of events) {
			const existing = latestByLink.get(auditEvent.link_id);
			if (!existing || auditEvent.timestamp > existing.timestamp) {
				latestByLink.set(auditEvent.link_id, auditEvent);
			}
			if (auditEvent.action === "SHARE_CREATED") {
				const existingCreated = createdEventsByLink.get(auditEvent.link_id);
				if (!existingCreated || auditEvent.timestamp < existingCreated.timestamp) {
					createdEventsByLink.set(auditEvent.link_id, auditEvent);
				}
			}
		}

		const shares = Array.from(latestByLink.values()).map((item) => {
			const createdEvent = createdEventsByLink.get(item.link_id);
			const result = {
				...item,
				created_at: createdEvent?.created_at || (createdEvent ? Math.floor(createdEvent.timestamp / 1000) : null),
				share_ttl: createdEvent?.share_ttl || null,
			};
			console.log("[activity] enriched share:", JSON.stringify({
				link_id: result.link_id,
				has_created_at: result.created_at != null,
				has_share_ttl: result.share_ttl != null,
				created_event_exists: createdEvent != null,
				created_event_raw: createdEvent ? { timestamp: createdEvent.timestamp, has_share_ttl: createdEvent.share_ttl != null, has_created_at: createdEvent.created_at != null } : null,
			}));
			return result;
		});

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
