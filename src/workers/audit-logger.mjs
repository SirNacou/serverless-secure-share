import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});

const AUDIT_TABLE_NAME = process.env.AUDIT_TABLE_NAME;

export const handler = async (event) => {
	const failedMessages = [];

	for (const record of event.Records) {
		try {
			const body = JSON.parse(record.body);
			const ttl = Math.floor(Date.now() / 1000) + 7776000; // 90-day retention

			await dynamoClient.send(
				new PutItemCommand({
					TableName: AUDIT_TABLE_NAME,
					ConditionExpression: "attribute_not_exists(log_id)",
					Item: {
						log_id: { S: body.log_id },
						link_id: { S: body.link_id },
						actor: { S: body.actor },
						timestamp: { N: String(body.timestamp) },
						action: { S: body.action },
						status: { S: body.status },
						ttl: { N: String(ttl) },
					},
				}),
			);
		} catch (err) {
			if (err.name === "ConditionalCheckFailedException") continue;
			console.error("Audit log write failed:", err);
			failedMessages.push(record.messageId);
		}
	}

	if (failedMessages.length > 0) {
		throw new Error(
			`Batch processing completed with ${failedMessages.length} failures`,
		);
	}
};
