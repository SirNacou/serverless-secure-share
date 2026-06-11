import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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
		// Extract link_id from the path parameters (e.g., /api/download/{id})
		const linkId = event.pathParameters?.id;

		if (!linkId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Missing file identifier." }),
			};
		}

		// 1. Fetch metadata from DynamoDB
		const dbResult = await dynamoClient.send(
			new GetItemCommand({
				TableName: TABLE_NAME,
				Key: { link_id: { S: linkId } },
			}),
		);

		if (!dbResult.Item) {
			return {
				statusCode: 404,
				body: JSON.stringify({ error: "File not found or expired." }),
			};
		}

		const fileMetadata = dbResult.Item;
		const fileStatus = fileMetadata.status?.S;
		const fileKey = fileMetadata.fileKey?.S;
		const filename = fileMetadata.filename?.S;

		// Ensure the file upload was actually completed and verified
		if (fileStatus !== "AVAILABLE" || !fileKey) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "File is not ready for download." }),
			};
		}

		// 2. Generate a secure, short-lived S3 Pre-signed GET URL (valid for 5 minutes)
		const s3Command = new GetObjectCommand({
			Bucket: BUCKET_NAME,
			Key: fileKey,
			ResponseContentDisposition: `attachment; filename="${filename}"`, // Forces browser download
		});

		const downloadUrl = await getSignedUrl(s3Client, s3Command, {
			expiresIn: 300,
		});

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "http://localhost:3000", // Maintain CORS compliance
			},
			body: JSON.stringify({ downloadUrl, filename }),
		};
	} catch (error) {
		console.error("Download Pipeline Failure:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Server Error" }),
		};
	}
};
