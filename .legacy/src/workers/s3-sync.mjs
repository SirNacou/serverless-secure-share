import { DynamoDBClient, UpdateItemCommand } from "@aws-sdk/client-dynamodb";
import { S3Client, DeleteObjectCommand } from "@aws-sdk/client-s3";

const dynamoClient = new DynamoDBClient({ region: process.env.AWS_REGION || "ap-southeast-1" });
const s3Client = new S3Client({ region: process.env.AWS_REGION || "ap-southeast-1" });

const TABLE_NAME = process.env.TABLE_NAME;
const BUCKET_NAME = process.env.BUCKET_NAME;

export const handler = async (event) => {
    try {
        for (const record of event.Records) {
            
            // BRANCH 1: Handle S3 Object Created Event (S3 Notification)
            if (record.s3) {
                const fileKey = decodeURIComponent(record.s3.object.key.replace(/\+/g, " "));
                const match = fileKey.match(/uploads\/([^/]+)\//);
                if (!match) continue;

                const uploadId = match[1];

                await dynamoClient.send(new UpdateItemCommand({
                    TableName: TABLE_NAME,
                    Key: { link_id: { S: uploadId } },
                    UpdateExpression: "SET #statusAttr = :newStatus",
                    ExpressionAttributeNames: { "#statusAttr": "status" },
                    ExpressionAttributeValues: { ":newStatus": { S: "AVAILABLE" } },
                }));
                console.log(`Synchronized status to AVAILABLE for file asset: ${uploadId}`);
            }

            // BRANCH 2: Handle TTL Expiration Event (DynamoDB Stream)
            else if (record.dynamodb) {
                if (record.eventName === "REMOVE") {
                    const oldImage = record.dynamodb.OldImage;
                    const assetType = oldImage?.asset_type?.S;
                    const fileKey = oldImage?.fileKey?.S;

                    if (assetType === "FILE" && fileKey) {
                        console.log(`DynamoDB TTL Triggered: Purging orphaned S3 binary: ${fileKey}`);
                        
                        await s3Client.send(new DeleteObjectCommand({
                            Bucket: BUCKET_NAME,
                            Key: fileKey,
                        }));
                        console.log(`Successfully purged S3 binary: ${fileKey}`);
                    }
                }
            }
        }
    } catch (error) {
        console.error("Worker Execution Failure:", error);
    }
};