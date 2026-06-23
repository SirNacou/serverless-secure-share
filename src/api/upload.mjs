import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import { DynamoDBClient, PutItemCommand } from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { randomUUID } from "node:crypto";
import { basename } from "node:path";

const s3Client = new S3Client({ region: process.env.AWS_REGION });
const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION });

export const handler = async (event) => {
    try {
        // 1. Extract Cognito Identity from JWT Authorizer Context
        const ownerUsername = event.requestContext.authorizer.jwt.claims.username;
        
        // 2. Parse Frontend Configuration Data
        const body = JSON.parse(event.body);
        const { payloadType, filename, contentType, textContent, visibility, targetUsers, lifespanHours } = body;

        const linkId = randomUUID();
        
        // 3. Compute TTL (Current Epoch time in seconds + Lifespan Window)
        const ttlTimestamp = Math.floor(Date.now() / 1000) + (parseInt(lifespanHours) * 3600);

        // Map allowed users array into DynamoDB String Set format
        const allowedUsersAttribute = targetUsers && targetUsers.length > 0 
            ? { SS: targetUsers } 
            : { NULL: true };

        // 4. BRANCH LOGIC: TEXT VS FILE
        if (payloadType === "text") {
            // Direct write for text payloads—no S3 roundtrip needed
            await dynamoClient.send(new PutItemCommand({
                TableName: process.env.TABLE_NAME,
                Item: {
                    "link_id": { S: linkId },
                    "owner_username": { S: ownerUsername },
                    "asset_type": { S: "TEXT" },
                    "payload_text": { S: textContent },
                    "visibility": { S: visibility },
                    "allowed_users": allowedUsersAttribute,
                    "status": { S: "AVAILABLE" }, // Instantly ready
                    "ttl": { N: ttlTimestamp.toString() }
                }
            }));

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ uploadId: linkId, directText: true })
            };
        } else {
            // Standard Pre-signed URL loop for physical files
            const safeFilename = basename(filename).replace(/[^a-zA-Z0-9.-]/g, "_");
            const s3ObjectKey = `uploads/${linkId}-${safeFilename}`;

            await dynamoClient.send(new PutItemCommand({
                TableName: process.env.TABLE_NAME,
                Item: {
                    "link_id": { S: linkId },
                    "owner_username": { S: ownerUsername },
                    "asset_type": { S: "FILE" },
                    "fileKey": { S: s3ObjectKey },
                    "filename": { S: safeFilename },
                    "visibility": { S: visibility },
                    "allowed_users": allowedUsersAttribute,
                    "status": { S: "PENDING_UPLOAD" }, // Waiting on S3 bucket notification
                    "ttl": { N: ttlTimestamp.toString() }
                }
            }));

            const s3Command = new PutObjectCommand({
                Bucket: process.env.BUCKET_NAME,
                Key: s3ObjectKey,
                ContentType: contentType
            });
            const uploadUrl = await getSignedUrl(s3Client, s3Command, { expiresIn: 300 });

            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
                body: JSON.stringify({ uploadId: linkId, uploadUrl })
            };
        }
    } catch (error) {
        console.error(error);
        return { statusCode: 500, body: JSON.stringify({ error: "Internal Configuration Failure" }) };
    }
};