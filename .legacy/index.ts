import { createAuth } from "./infra/auth";
import { createCiRole } from "./infra/ci";
import { createDownloadRoute } from "./infra/compute/api/download";
import { createListRoute } from "./infra/compute/api/list";
import { createShareInfoRoute } from "./infra/compute/api/share-info";
import { createApiGateway } from "./infra/compute/api/gateway";
import { createUploadRoute } from "./infra/compute/api/upload";
import { createActivityRoute } from "./infra/compute/api/activity";
import { createExploreRoute } from "./infra/compute/api/explore";
import { createProfileRoute } from "./infra/compute/api/profile";
import { createWorkerCompute } from "./infra/compute/workers";
import { createAuditWorker } from "./infra/compute/audit";
import { createDatabase } from "./infra/database";
import { createFrontendHosting } from "./infra/frontend";
import { createMessaging } from "./infra/messaging";
import { createStorage } from "./infra/storage";

// 0. CI/CD Bootstrap
const ci = createCiRole();

// 1. Storage, Identity, and Messaging Layers
const storage = createStorage();
const database = createDatabase();
const auth = createAuth();
const messaging = createMessaging();

// 2. Instantiate Base Router Ingress
const gatewaySystem = createApiGateway({
	userPoolId: auth.userPool.id,
	userPoolClientId: auth.userPoolClient.id,
});

// 2.5. Frontend Hosting (S3 + CloudFront)
const frontendSystem = createFrontendHosting();

// 3. Mount Isolated Handlers onto Gateway Instance
createUploadRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	bucketId: storage.bucket.id,
	tableName: database.metadataTable.name,
	auditQueueUrl: messaging.auditQueueUrl,
	auditQueueArn: messaging.auditQueue.arn,
});

createDownloadRoute({
	httpApi: gatewaySystem.httpApi,
	bucketId: storage.bucket.id,
	tableName: database.metadataTable.name,
	auditQueueUrl: messaging.auditQueueUrl,
	auditQueueArn: messaging.auditQueue.arn,
});

createListRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	tableName: database.metadataTable.name,
});

createShareInfoRoute({
	httpApi: gatewaySystem.httpApi,
	tableName: database.metadataTable.name,
});

createExploreRoute({
	httpApi: gatewaySystem.httpApi,
	tableName: database.metadataTable.name,
	profileTableName: database.userProfilesTable.name,
});

createActivityRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	auditTableName: database.auditTable.name,
});

createProfileRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	profileTableName: database.userProfilesTable.name,
	displayNamesTableName: database.displayNamesTable.name,
});

// 4. Asynchronous Background Core Loop
createWorkerCompute({
	bucket: storage.bucket,
	tableName: database.metadataTable.name,
	tableStreamArn: database.metadataTable.streamArn,
});

// 5. Audit Log Processor
createAuditWorker({
	auditQueue: messaging.auditQueue,
	auditTableName: database.auditTable.name,
});

// Outputs
export const ciRoleArn = ci.ciRoleArn;
export const cognitoPoolId = auth.userPool.id;
export const cognitoClientId = auth.userPoolClient.id;
export const cognitoDomain = auth.cognitoDomain;
export const googleOAuthCallbackUrl = auth.googleCallbackUrl;
export const publicApiEndpoint = gatewaySystem.httpApi.apiEndpoint;
export const frontendBucketName = frontendSystem.bucket.bucket;
export const frontendDistributionId = frontendSystem.distribution.id;
export const frontendDomain = frontendSystem.distributionDomain;
