import { DynamoDBClient, GetItemCommand, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID, randomBytes } from "node:crypto";
import { basename } from "node:path";
import { SQSClient, SendMessageCommand } from "@aws-sdk/client-sqs";

const s3Client = new S3Client({
	region: process.env.AWS_REGION,
	requestChecksumCalculation: "WHEN_REQUIRED",
	responseChecksumValidation: "WHEN_REQUIRED",
});
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });
const sqsClient = new SQSClient({ region: "ap-southeast-1" });

async function emitAudit(linkId, ownerUsername, shareName, assetType, visibility, status, createdAt, ttl) {
	if (!process.env.AUDIT_QUEUE_URL) {
		return;
	}
	try {
		const auditMessage = {
			log_id: randomUUID(),
			link_id: linkId,
			share_name: shareName,
			asset_type: assetType,
			visibility: visibility,
			owner_username: ownerUsername,
			actor: ownerUsername,
			timestamp: Date.now(),
			action: "SHARE_CREATED",
			status: status,
		};
		if (createdAt != null) auditMessage.created_at = createdAt;
		if (ttl != null) auditMessage.share_ttl = ttl;
		
		await sqsClient.send(
			new SendMessageCommand({
				QueueUrl: process.env.AUDIT_QUEUE_URL,
				MessageBody: JSON.stringify(auditMessage),
			}),
		);
	} catch (err) {
		console.error("SQS SendMessage failed:", err);
	}
}

function generateShortId() {
	const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
	const bytes = randomBytes(8);
	let id = "";
	for (let i = 0; i < bytes.length; i++) {
		id += chars[bytes[i] % chars.length];
	}
	return id;
}

function validateCustomId(id) {
	if (id.length < 4 || id.length > 64) return false;
	if (!/^[a-zA-Z0-9][a-zA-Z0-9_-]{2,62}[a-zA-Z0-9]$/.test(id)) return false;
	if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return false;
	return true;
}

export const handler = async (event) => {
	try {
		// 1. Extract Cognito Identity from JWT Authorizer Context
		const ownerUsername = event.requestContext.authorizer.jwt.claims.username;

		// 2. Parse Frontend Configuration Data
		const body = JSON.parse(event.body);
		const {
			name,
			payloadType,
			filename,
			contentType,
			textContent,
			visibility,
			targetUsers,
			lifespanHours,
			maxDownloads,
			customId,
		} = body;

		let linkId;
		if (customId) {
			if (!validateCustomId(customId)) {
				return {
					statusCode: 400,
					headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
					body: JSON.stringify({ error: "Invalid custom ID: must be 4-64 characters, using only A-Z, a-z, 0-9, hyphens, and underscores." }),
				};
			}
			const existing = await dynamoClient.send(
				new GetItemCommand({
					TableName: process.env.TABLE_NAME,
					Key: { link_id: { S: customId } },
				}),
			);
			if (existing.Item) {
				const item = existing.Item;
				const now = Math.floor(Date.now() / 1000);
				const ttl = item.ttl?.N ? parseInt(item.ttl.N, 10) : null;
				const status = item.status?.S;
				if (ttl && ttl > now && (status === "AVAILABLE" || status === "PENDING_UPLOAD")) {
					return {
						statusCode: 409,
						headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
						body: JSON.stringify({ error: "This custom ID is already in use by an active share." }),
					};
				}
			}
			linkId = customId;
		} else {
			linkId = generateShortId();
		}

		// Fallback string if frontend validation fails or skips the name input value
		const safeShareName = name?.trim() || "Untitled Share";

		// 3. Compute TTL (Current Epoch time in seconds + Lifespan Window)
		const ttlTimestamp =
			Math.floor(Date.now() / 1000) + parseInt(lifespanHours, 10) * 3600;

		// Map allowed users array into DynamoDB String Set format
		const allowedUsersAttribute =
			targetUsers && targetUsers.length > 0
				? { SS: targetUsers }
				: { NULL: true };

		// Build max_downloads attribute: omit entirely for "No Limit" so the
		// download handler's attribute_not_exists condition passes correctly
		const maxDownloadsAttr =
			maxDownloads && parseInt(maxDownloads, 10) > 0
				? { max_downloads: { N: maxDownloads } }
				: {};

		// 4. BRANCH LOGIC: TEXT VS FILE
		if (payloadType === "text") {
			// Direct write for text payloads—no S3 roundtrip needed
await dynamoClient.send(
			new PutItemCommand({
				TableName: process.env.TABLE_NAME,
				Item: {
					link_id: { S: linkId },
					share_name: { S: safeShareName },
					owner_username: { S: ownerUsername },
					asset_type: { S: "TEXT" },
					payload_text: { S: textContent },
					visibility: { S: visibility },
					allowed_users: allowedUsersAttribute,
					status: { S: "AVAILABLE" },
					created_at: { N: Math.floor(Date.now() / 1000).toString() },
					ttl: { N: ttlTimestamp.toString() },
					...maxDownloadsAttr,
					download_count: { N: "0" },
				},
			}));

		const createdAt = Math.floor(Date.now() / 1000);
		await emitAudit(linkId, ownerUsername, safeShareName, "TEXT", visibility, "AVAILABLE", createdAt, ttlTimestamp);

		return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ uploadId: linkId, directText: true }),
			};
		} else {
			// Standard Pre-signed URL loop for physical files
			const safeFilename = basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_");
			const s3ObjectKey = `uploads/${linkId}/${safeFilename}`;

await dynamoClient.send(
			new PutItemCommand({
				TableName: process.env.TABLE_NAME,
				Item: {
					link_id: { S: linkId },
					share_name: { S: safeShareName },
					owner_username: { S: ownerUsername },
					asset_type: { S: "FILE" },
					fileKey: { S: s3ObjectKey },
					filename: { S: safeFilename },
					visibility: { S: visibility },
					allowed_users: allowedUsersAttribute,
					status: { S: "PENDING_UPLOAD" },
					created_at: { N: Math.floor(Date.now() / 1000).toString() },
					ttl: { N: ttlTimestamp.toString() },
					...maxDownloadsAttr,
					download_count: { N: "0" },
				},
			}));

			const createdAt = Math.floor(Date.now() / 1000);
			emitAudit(linkId, ownerUsername, safeShareName, "FILE", visibility, "PENDING_UPLOAD", createdAt, ttlTimestamp);

		const s3Command = new PutObjectCommand({
				Bucket: process.env.BUCKET_NAME,
				Key: s3ObjectKey,
				ContentType: contentType,
			});
			const uploadUrl = await getSignedUrl(s3Client, s3Command, {
				expiresIn: 900,
			});

			return {
				statusCode: 200,
				headers: {
					"Content-Type": "application/json",
					"Access-Control-Allow-Origin": "*",
				},
				body: JSON.stringify({ uploadId: linkId, uploadUrl }),
			};
		}
	} catch (error) {
		console.error(error);
		return {
			statusCode: 500,
			body: JSON.stringify({ error: "Internal Configuration Failure" }),
		};
	}
};
