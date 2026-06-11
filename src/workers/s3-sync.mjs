import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";

const dynamoClient = new DynamoDBClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
	try {
		for (const record of event.Records) {
			const fileKey = decodeURIComponent(
				record.s3.object.key.replace(/\+/g, " "),
			);

			// Extract UUID from pattern: uploads/{UUID}-{filename}
			const match = fileKey.match(/uploads\/([a-f0-9-]+)-/);
			if (!match) continue;

			const uploadId = match[1];

			const command = new UpdateItemCommand({
				TableName: TABLE_NAME,
				Key: { link_id: { S: uploadId } },
				UpdateExpression: "SET #statusAttr = :newStatus",
				ExpressionAttributeNames: { "#statusAttr": "status" },
				ExpressionAttributeValues: { ":newStatus": { S: "AVAILABLE" } },
			});

			await dynamoClient.send(command);
			console.log(
				`Synchronized status to AVAILABLE for file asset: ${uploadId}`,
			);
		}
	} catch (error) {
		console.error("S3 Synchronization Worker Failure:", error);
	}
};
