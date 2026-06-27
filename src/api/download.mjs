import { DynamoDBClient, GetItemCommand, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";
import { DeleteObjectCommand, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
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

function emitAudit(linkId, actor, action, status, meta = {}) {
	if (!AUDIT_QUEUE_URL) {
		console.warn("emitAudit skipped: AUDIT_QUEUE_URL not set");
		return;
	}
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
					share_name: meta.share_name,
					asset_type: meta.asset_type,
					visibility: meta.visibility,
					owner_username: meta.owner_username,
				}),
			}),
		)
		.catch((err) => console.error("SQS SendMessage failed:", err));
}

function markConsumed(linkId, fileKey) {
	const updates = {
		TableName: TABLE_NAME,
		Key: { link_id: { S: linkId } },
		UpdateExpression: "SET #statusAttr = :newStatus",
		ExpressionAttributeNames: { "#statusAttr": "status" },
		ExpressionAttributeValues: { ":newStatus": { S: "CONSUMED" } },
	};
	dynamoClient.send(new UpdateItemCommand(updates)).catch((err) =>
		console.warn("Failed to mark share as CONSUMED:", err),
	);

	if (fileKey) {
		s3Client.send(new DeleteObjectCommand({
			Bucket: BUCKET_NAME,
			Key: fileKey,
		})).catch((err) =>
			console.warn("Failed to delete S3 object on limit hit:", err),
		);
	}
}

export const handler = async (event) => {
	try {
		const linkId = event.pathParameters?.shareId;

		if (!linkId) {
			return {
				statusCode: 400,
				headers: { "Content-Type": "application/json" },
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
			emitAudit(linkId, actor, "METADATA_LOAD", "EXPIRED", {
				share_name: "Unknown",
				asset_type: "UNKNOWN",
				visibility: "unknown",
				owner_username: "unknown",
			});
			return {
				statusCode: 404,
				headers: { "Content-Type": "application/json" },
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
			emitAudit(linkId, actor, "METADATA_LOAD", "EXPIRED", {
				share_name: item.share_name?.S || "Untitled Share",
				asset_type: item.asset_type?.S || "UNKNOWN",
				visibility: item.visibility?.S || "unknown",
				owner_username: item.owner_username?.S || "unknown",
			});
			return {
				statusCode: 404,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Resource has expired." }),
			};
		}

		if (visibility === "private") {
if (!currentUsername) {
			emitAudit(linkId, actor, "METADATA_LOAD", "UNAUTHORIZED_403", {
				share_name: item.share_name?.S || "Untitled Share",
				asset_type: item.asset_type?.S || "UNKNOWN",
				visibility: item.visibility?.S || "unknown",
				owner_username: item.owner_username?.S || "unknown",
			});
			return {
					statusCode: 403,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						error: "Access Denied: Private asset authorization header missing.",
					}),
				};
			}

			const isOwner = ownerUsername === currentUsername;
			const isAllowed = allowedUsers.includes(currentUsername);

if (!isOwner && !isAllowed) {
			emitAudit(linkId, actor, "METADATA_LOAD", "UNAUTHORIZED_403", {
				share_name: item.share_name?.S || "Untitled Share",
				asset_type: item.asset_type?.S || "UNKNOWN",
				visibility: item.visibility?.S || "unknown",
				owner_username: item.owner_username?.S || "unknown",
			});
			return {
					statusCode: 403,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						error:
							"Access Denied: User identity not authorized to read this share.",
					}),
				};
			}
		}

		const maxDownloads = item.max_downloads?.N ? parseInt(item.max_downloads.N, 10) : null;
		const currentDownloadCount = item.download_count?.N ? parseInt(item.download_count.N, 10) : 0;

		// Pre-check: share already exhausted
		if (maxDownloads !== null && currentDownloadCount >= maxDownloads) {
			emitAudit(linkId, actor, "METADATA_LOAD", "EXPIRED", {
				share_name: item.share_name?.S || "Untitled Share",
				asset_type: item.asset_type?.S || "UNKNOWN",
				visibility: item.visibility?.S || "unknown",
				owner_username: item.owner_username?.S || "unknown",
			});
			return {
				statusCode: 410,
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ error: "Share has reached its download limit." }),
			};
		}

		const responseBody = {
			link_id: linkId,
			share_name: item.share_name?.S || "Untitled Share",
			asset_type: assetType,
			visibility: visibility,
		};

		// For FILE type, generate pre-signed URL BEFORE incrementing the counter
		// so the download that triggers the limit still succeeds
		if (assetType === "FILE") {
			const fileStatus = item.status?.S;
			const fileKey = item.fileKey?.S;
			const filename = item.filename?.S;

if (fileStatus !== "AVAILABLE" || !fileKey) {
			emitAudit(linkId, actor, "DOWNLOAD_EXECUTION", "EXPIRED", {
				share_name: item.share_name?.S || "Untitled Share",
				asset_type: item.asset_type?.S || "UNKNOWN",
				visibility: item.visibility?.S || "unknown",
				owner_username: item.owner_username?.S || "unknown",
			});
			return {
					statusCode: 400,
					headers: { "Content-Type": "application/json" },
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

		// Atomically increment the download counter under the limit
		try {
			await dynamoClient.send(
				new UpdateItemCommand({
					TableName: TABLE_NAME,
					Key: { link_id: { S: linkId } },
					UpdateExpression: "ADD #count :inc",
					ConditionExpression:
						"attribute_not_exists(#max) OR #count < #max",
					ExpressionAttributeNames: {
						"#count": "download_count",
						"#max": "max_downloads",
					},
					ExpressionAttributeValues: {
						":inc": { N: "1" },
					},
				}),
			);
		} catch (updateError) {
			if (updateError.name === "ConditionalCheckFailedException") {
				emitAudit(linkId, actor, "DOWNLOAD_EXECUTION", "EXPIRED", {
					share_name: item.share_name?.S || "Untitled Share",
					asset_type: item.asset_type?.S || "UNKNOWN",
					visibility: item.visibility?.S || "unknown",
					owner_username: item.owner_username?.S || "unknown",
				});
				return {
					statusCode: 410,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						error: "Share has reached its download limit.",
					}),
				};
			}
			throw updateError;
		}

		// If limit was just reached, mark as consumed and clean up S3 for FILE type
		const newCount = currentDownloadCount + 1;
		if (maxDownloads !== null && newCount >= maxDownloads) {
			const fileKey = item.fileKey?.S;
			markConsumed(linkId, fileKey);
		}

		if (assetType === "TEXT") {
			responseBody.payload_text = item.payload_text?.S || "";
		}

		const action =
			assetType === "FILE" ? "DOWNLOAD_EXECUTION" : "METADATA_LOAD";
		emitAudit(linkId, actor, action, "SUCCESS", {
			share_name: item.share_name?.S || "Untitled Share",
			asset_type: item.asset_type?.S || "UNKNOWN",
			visibility: item.visibility?.S || "unknown",
			owner_username: item.owner_username?.S || "unknown",
		});

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
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				error: "Internal operational exception encountered.",
			}),
		};
	}
};
