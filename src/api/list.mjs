import { DynamoDBClient, QueryCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

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
		const username =
			event.requestContext.authorizer.jwt.claims.username;

		if (!username) {
			return {
				statusCode: 401,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ error: "Unauthorized" }),
			};
		}

		const result = await dynamoClient.send(
			new QueryCommand({
				TableName: process.env.TABLE_NAME,
				IndexName: "by_owner",
				KeyConditionExpression: "owner_username = :username",
				ExpressionAttributeValues: {
					":username": { S: username },
				},
			}),
		);

		const shares = (result.Items || []).map(unmarshallItem);

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "*",
			},
			body: JSON.stringify({ shares, count: shares.length }),
		};
	} catch (error) {
		console.error("List shares error:", error);
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
