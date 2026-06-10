import * as aws from "@pulumi/aws";

export function createStorage() {
    // 1. Declare the base S3 bucket cleanly without inline configurations
    const vaultBucket = new aws.s3.Bucket("secure-vault-bucket");

    // 2. Separate Standalone CORS Configuration
    const bucketCors = new aws.s3.BucketCorsConfiguration("vaultBucketCors", {
        bucket: vaultBucket.id,
        corsRules: [{
            allowedHeaders: ["*"],
            allowedMethods: ["PUT", "POST"],
            allowedOrigins: ["*"],
            maxAgeSeconds: 3000,
        }],
    });

    // 3. Separate Standalone Lifecycle Configuration
    const bucketLifecycle = new aws.s3.BucketLifecycleConfiguration("vaultBucketLifecycle", {
        bucket: vaultBucket.id,
        rules: [{
            id: "expire-old-files",
            status: "Enabled",
            expiration: {
                days: 30,
            },
        }],
    });

    // 4. Strict Security Public Access Block
    const bucketPublicAccessBlock = new aws.s3.BucketPublicAccessBlock("vaultBucketPublicAccessBlock", {
        bucket: vaultBucket.id,
        blockPublicAcls: true,
        blockPublicPolicy: true,
        ignorePublicAcls: true,
        restrictPublicBuckets: true,
    });

    return { bucket: vaultBucket };
}