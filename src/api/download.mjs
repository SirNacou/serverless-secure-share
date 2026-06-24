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

/**
 * Manual lightweight decoding loop for standard JWT payloads.
 * Prevents needing bulky node_modules packaging inside simple Lambda layers.
 */
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

export const handler = async (event) => {
	try {
		// Adjust parameter token reading to match front-end path convention: /api/share/{shareId}
		const linkId = event.pathParameters?.shareId;

		if (!linkId) {
			return {
				statusCode: 400,
				body: JSON.stringify({ error: "Missing link identifier." }),
			};
		}

		// 1. Fetch metadata record from DynamoDB
		const dbResult = await dynamoClient.send(
			new GetItemCommand({
				TableName: TABLE_NAME,
				Key: { link_id: { S: linkId } },
			}),
		);

		if (!dbResult.Item) {
			return {
				statusCode: 404,
				body: JSON.stringify({ error: "Resource not found or expired." }),
			};
		}

		const item = dbResult.Item;
		const assetType = item.asset_type?.S; // "FILE" or "TEXT"
		const visibility = item.visibility?.S; // "public" or "private"
		const ownerUsername = item.owner_username?.S;
		const allowedUsers = item.allowed_users?.SS || [];
		const ttl = item.ttl?.N ? parseInt(item.ttl.N, 10) : null;

		// Force rigorous application-level validation against un-purged expired records
		if (ttl && Math.floor(Date.now() / 1000) > ttl) {
			return {
				statusCode: 404,
				body: JSON.stringify({ error: "Resource has expired." }),
			};
		}

		// 2. RUN APPLICATION-LEVEL AUTHENTICATION CHECK FOR PRIVATE LIFECYCLES
		if (visibility === "private") {
			const authHeader =
				event.headers?.authorization || event.headers?.Authorization;
			const decodedToken = decodeCognitoToken(authHeader);
			const currentUsername = decodedToken?.username;

			if (!currentUsername) {
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
				return {
					statusCode: 403,
					body: JSON.stringify({
						error:
							"Access Denied: User identity not authorized to read this share.",
					}),
				};
			}
		}

		// 3. COMPILE RESPONSE STRUCTURE BY ASSET SCHEMATIC TYPE
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

			// Enforce upload confirmation guardrails for physical files
			if (fileStatus !== "AVAILABLE" || !fileKey) {
				return {
					statusCode: 400,
					body: JSON.stringify({
						error: "File state sync unconfirmed by pipeline.",
					}),
				};
			}

			// Generate temporary secure binary access channel
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
