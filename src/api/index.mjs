import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "crypto";

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
					error: "System configuration error: missing environment variables.",
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
				body: JSON.stringify({
					error:
						"Validation failed: 'filename' and 'contentType' are required.",
				}),
			};
		}

		const uniqueId = randomUUID();
		const s3ObjectKey = `uploads/${uniqueId}-${filename}`;

		// 1. Generate the S3 Pre-signed URL
		const s3Command = new PutObjectCommand({
			Bucket: BUCKET_NAME,
			Key: s3ObjectKey,
			ContentType: contentType,
		});
		const uploadUrl = await getSignedUrl(s3Client, s3Command, {
			expiresIn: 900,
		});

		// 2. Persist metadata record to DynamoDB for audit tracking
		const currentEpochTime = Date.now().toString(); // DynamoDB Client expects numbers as strings inside the type descriptor
		const timestampIso = new Date().toISOString();

		const dynamoCommand = new PutItemCommand({
			TableName: TABLE_NAME,
			Item: {
				link_id: { S: uniqueId },
				timestamp: { N: currentEpochTime },
				filename: { S: filename },
				fileKey: { S: s3ObjectKey },
				contentType: { S: contentType },
				status: { S: "PENDING_UPLOAD" },
				createdAt: { S: timestampIso }, // Keep the human-readable string as a non-key attribute
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
				expiresInSeconds: 900,
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
