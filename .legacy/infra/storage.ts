import * as aws from "@pulumi/aws";

export function createStorage() {
	const vaultBucket = new aws.s3.Bucket("secure-vault-bucket");

	new aws.s3.BucketCorsConfiguration("vaultBucketCors", {
		bucket: vaultBucket.id,
		corsRules: [
			{
				allowedHeaders: ["*"],
				allowedMethods: ["PUT", "POST", "GET"],
				allowedOrigins: ["http://localhost:3000", "*"],
				exposeHeaders: ["ETag"],
				maxAgeSeconds: 3000,
			},
		],
	});

	new aws.s3.BucketLifecycleConfiguration("vaultBucketLifecycle", {
		bucket: vaultBucket.id,
		rules: [
			{
				id: "expire-old-files",
				status: "Enabled",
				expiration: {
					days: 30,
				},
			},
		],
	});

	new aws.s3.BucketPublicAccessBlock("vaultBucketPublicAccessBlock", {
		bucket: vaultBucket.id,
		blockPublicAcls: true,
		blockPublicPolicy: true,
		ignorePublicAcls: true,
		restrictPublicBuckets: true,
	});

	return { bucket: vaultBucket };
}
