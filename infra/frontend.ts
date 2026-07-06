import * as aws from "@pulumi/aws";
import * as cloudflare from "@pulumi/cloudflare";
import * as command from "@pulumi/command";
import * as pulumi from "@pulumi/pulumi";
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

function hashDir(dir: string): string {
  const hash = createHash("sha256");
  function walk(dirPath: string) {
    for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
      const fullPath = join(dirPath, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
      } else if (entry.isFile()) {
        hash.update(readFileSync(fullPath));
      }
    }
  }
  walk(dir);
  return hash.digest("hex");
}

interface FrontendArgs {
	apiEndpoint: pulumi.Input<string>;
}

export function createFrontendHosting(args: FrontendArgs) {
	// Create a separate AWS provider for us-east-1 (required for ACM certificates used with CloudFront)
	const usEast1Provider = new aws.Provider("us-east-1", {
		region: "us-east-1",
	});

	// ACM Certificate for share.apps.nacou.dev (must be in us-east-1 for CloudFront)
	const certificate = new aws.acm.Certificate(
		"frontend-certificate",
		{
			domainName: "share.apps.nacou.dev",
			validationMethod: "DNS",
			subjectAlternativeNames: ["share.apps.nacou.dev"],
		},
		{ provider: usEast1Provider },
	);

	// DNS validation records for ACM certificate
	const validationRecords = certificate.domainValidationOptions.apply((dvo) => {
		return dvo.map((option) => ({
			name: option.resourceRecordName,
			value: option.resourceRecordValue,
			type: option.resourceRecordType,
			ttl: 300,
		}));
	});

	// Cloudflare DNS validation records
	const cloudflareValidationRecords = validationRecords.apply((records) => {
		return records.map((record, index) => {
			return new cloudflare.DnsRecord(`cert-validation-${index}`, {
				zoneId: "a01e2f3659cec1b9910a300f5c01518e",
				name: record.name,
				content: record.value,
				type: record.type,
				ttl: record.ttl,
			});
		});
	});

	// Wait for certificate validation
	const certificateValidation = new aws.acm.CertificateValidation(
		"frontend-certificate-validation",
		{
			certificateArn: certificate.arn,
			validationRecordFqdns: cloudflareValidationRecords.apply((records) =>
				records.map((r) => r.name),
			),
		},
		{ provider: usEast1Provider },
	);

	// S3 bucket for frontend hosting
	const bucket = new aws.s3.Bucket("frontend-bucket", {
		forceDestroy: true,
	});

	// Block all public access to the bucket
	new aws.s3.BucketPublicAccessBlock("frontend-public-access-block", {
		bucket: bucket.id,
		blockPublicAcls: true,
		blockPublicPolicy: true,
		ignorePublicAcls: true,
		restrictPublicBuckets: true,
	});

	// Origin Access Control for CloudFront
	const oac = new aws.cloudfront.OriginAccessControl("frontend-oac", {
		description: "OAC for frontend S3 bucket",
		originAccessControlOriginType: "s3",
		signingBehavior: "always",
		signingProtocol: "sigv4",
	});

	// Bucket policy to allow CloudFront OAC
	const callerIdentity = aws.getCallerIdentity();
	const _ = new aws.s3.BucketPolicy("frontend-bucket-policy", {
		bucket: bucket.id,
		policy: pulumi.jsonStringify({
			Version: "2012-10-17",
			Statement: [
				{
					Effect: "Allow",
					Principal: {
						Service: "cloudfront.amazonaws.com",
					},
					Action: "s3:GetObject",
					Resource: pulumi.interpolate`${bucket.arn}/*`,
					Condition: {
						StringLike: {
							"AWS:SourceArn": pulumi.interpolate`arn:aws:cloudfront::${callerIdentity.then((c) => c.accountId)}:distribution/*`,
						},
					},
				},
			],
		}),
	});

	// CloudFront distribution
	const distribution = new aws.cloudfront.Distribution(
		"frontend-distribution",
		{
			enabled: true,
			defaultRootObject: "index.html",
			origins: [
				{
					originId: bucket.id,
					domainName: bucket.bucketRegionalDomainName,
					originAccessControlId: oac.id,
				},
			],
			defaultCacheBehavior: {
				targetOriginId: bucket.id,
				viewerProtocolPolicy: "redirect-to-https",
				allowedMethods: ["GET", "HEAD", "OPTIONS"],
				cachedMethods: ["GET", "HEAD", "OPTIONS"],
				defaultTtl: 0,
				forwardedValues: {
					queryString: false,
					cookies: {
						forward: "none",
					},
				},
			},
			customErrorResponses: [
				{
					errorCode: 403,
					responseCode: 200,
					responsePagePath: "/index.html",
				},
				{
					errorCode: 404,
					responseCode: 200,
					responsePagePath: "/index.html",
				},
			],
			priceClass: "PriceClass_100",
			aliases: ["share.apps.nacou.dev"],
			viewerCertificate: {
				acmCertificateArn: certificateValidation.certificateArn,
				sslSupportMethod: "sni-only",
				minimumProtocolVersion: "TLSv1.2_2021",
			},
			restrictions: {
				geoRestriction: {
					restrictionType: "none",
				},
			},
		},
	);

	// Build frontend, sync to S3, and invalidate CloudFront
	new command.local.Command("frontend-sync", {
		create: pulumi.interpolate`
			cd ${"./src/frontend"} &&
			bun install &&
			VITE_API_ENDPOINT=${args.apiEndpoint} bun run build &&
			aws s3 sync dist/ s3://${bucket.bucket}/ --delete &&
			aws cloudfront create-invalidation --distribution-id ${distribution.id} --paths /*
		`,
		triggers: [distribution.id, hashDir("./src/frontend/src")],
	});

	// Cloudflare CNAME record for the custom domain
	const cloudflareCname = new cloudflare.DnsRecord("frontend-cname", {
		zoneId: "a01e2f3659cec1b9910a300f5c01518e",
		name: "share.apps.nacou.dev",
		content: distribution.domainName,
		type: "CNAME",
		ttl: 1,
		proxied: false,
	});

	return {
		bucket,
		distribution,
		distributionDomain: distribution.domainName,
		cloudflareCname,
	};
}