import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const s3Client = new S3Client({
	region: process.env.AWS_REGION || "ap-southeast-1",
});
const dynamoClient = new DynamoDBClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TABLE_NAME = process.env.TABLE_NAME;

export const handler = async (event) => {
	try {
		if (!BUCKET_NAME || !TABLE_NAME) {
			return {
				statusCode: 500,
				body: JSON.stringify({
					error: "System configuration error: missing variables.",
				}),
			};
		}

		if (!event.body) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Missing request body." }),
			};
		}

		const body = JSON.parse(event.body);
		const { filename, contentType } = body;

		if (!filename || !contentType) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Validation failed." }),
			};
		}

		const uniqueId = randomUUID();
		const s3ObjectKey = `uploads/${uniqueId}-${filename}`;

		const s3Command = new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: s3ObjectKey,
			ContentType: contentType,
		});
		const uploadUrl = await getSignedUrl(s3Client, s3Command, {
			expiresIn: 900,
		});

		// Calculate TTL: Current time + 30 days (in seconds)
		const ttlEpochSeconds = Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60;

		const dynamoCommand = new PutItemCommand({
			TableName: TABLE_NAME,
			Item: {
				link_id: { S: uniqueId },
				filename: { S: filename },
				fileKey: { S: s3ObjectKey },
				contentType: { S: contentType },
				status: { S: "PENDING_UPLOAD" },
				createdAt: { S: new Date().toISOString() },
				ttl: { N: ttlEpochSeconds.toString() }, // DynamoDB drops this record automatically at this timestamp
			},
		});
		await dynamoClient.send(dynamoCommand);

		return {
			statusCode: 200,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				uploadId: uniqueId,
				uploadUrl,
				fileKey: s3ObjectKey,
			}),
		};
	} catch (error) {
		console.error("Pipeline Failure:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};
