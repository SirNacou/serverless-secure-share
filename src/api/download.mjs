import { DynamoDBClient, GetItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";

const s3Client = new S3Client({
	region: process.env.AWS_REGION || "ap-southeast-1",
});
const dynamoClient = new DynamoDBClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});
const sqsClient = new SQSClient({
	region: process.env.AWS_REGION || "ap-southeast-1",
});

const BUCKET_NAME = process.env.BUCKET_NAME;
const TABLE_NAME = process.env.TABLE_NAME;
const AUDIT_QUEUE_URL = process.env.AUDIT_QUEUE_URL;

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

function emitAudit(linkId, actor, action, status) {
	if (!AUDIT_QUEUE_URL) return;
	sqsClient
		.send(
			new SendMessageCommand({
				QueueUrl: AUDIT_QUEUE_URL,
				MessageBody: JSON.stringify({
					log_id: randomUUID(),
					link_id: linkId,
					actor,
					timestamp: Date.now(),
					action,
					status,
				}),
			}),
		)
		.catch((err) => console.warn("Audit emit failed (non-blocking):", err));
}

export const handler = async (event) => {
	try {
		const linkId = event.pathParameters?.shareId;

		if (!linkId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Missing link identifier." }),
			};
		}

		const authHeader =
			event.headers?.authorization || event.headers?.Authorization;
		const decodedToken = decodeCognitoToken(authHeader);
		const currentUsername = decodedToken?.username;
		const actor = currentUsername || "GUEST";

		const dbResult = await dynamoClient.send(
			new GetItemCommand({
				TableName: TABLE_NAME,
				Key: { link_id: { S: linkId } },
			}),
		);

		if (!dbResult.Item) {
			emitAudit(linkId, actor, "METADATA_LOAD", "EXPIRED");
			return {
				statusCode: 404,
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
			emitAudit(linkId, actor, "METADATA_LOAD", "EXPIRED");
			return {
				statusCode: 404,
				body: JSON.stringify({ error: "Resource has expired." }),
			};
		}

		if (visibility === "private") {
			if (!currentUsername) {
				emitAudit(linkId, actor, "METADATA_LOAD", "UNAUTHORIZED_403");
				return {
					statusCode: 403,
					body: JSON.stringify({
						error: "Access Denied: Private asset authorization header missing.",
					}),
				};
			}

			const isOwner = ownerUsername === currentUsername;
			const isAllowed = allowedUsers.includes(currentUsername);

			if (!isOwner && !isAllowed) {
				emitAudit(linkId, actor, "METADATA_LOAD", "UNAUTHORIZED_403");
				return {
					statusCode: 403,
					body: JSON.stringify({
						error:
							"Access Denied: User identity not authorized to read this share.",
					}),
				};
			}
		}

		const responseBody = {
			link_id: linkId,
			share_name: item.share_name?.S || "Untitled Share",
			asset_type: assetType,
			visibility: visibility,
		};

		if (assetType === "TEXT") {
			responseBody.payload_text = item.payload_text?.S || "";
		} else if (assetType === "FILE") {
			const fileStatus = item.status?.S;
			const fileKey = item.fileKey?.S;
			const filename = item.filename?.S;

			if (fileStatus !== "AVAILABLE" || !fileKey) {
				emitAudit(linkId, actor, "DOWNLOAD_EXECUTION", "EXPIRED");
				return {
					statusCode: 400,
					body: JSON.stringify({
						error: "File state sync unconfirmed by pipeline.",
					}),
				};
			}

			const s3Command = new GetObjectCommand({
				Bucket: BUCKET_NAME,
				Key: fileKey,
				ResponseContentDisposition: `attachment; filename="${filename}"`,
			});

			responseBody.filename = filename;
			responseBody.downloadUrl = await getSignedUrl(s3Client, s3Command, {
				expiresIn: 300,
			});
		}

		const action =
			assetType === "FILE" ? "DOWNLOAD_EXECUTION" : "METADATA_LOAD";
		emitAudit(linkId, actor, action, "SUCCESS");

		return {
			statusCode: 200,
			headers: {
				"Content-Type": "application/json",
				"Access-Control-Allow-Origin": "http://localhost:3000",
			},
			body: JSON.stringify(responseBody),
		};
	} catch (error) {
		console.error("Unified Delivery Pipeline Crash:", error);
		return {
			statusCode: 500,
			body: JSON.stringify({
				error: "Internal operational exception encountered.",
			}),
		};
	}
};
