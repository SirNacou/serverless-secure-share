import { createAuth } from "./infra/auth";
import { createDownloadRoute } from "./infra/compute/api/download";
// Import the split API subsystem functions
import { createApiGateway } from "./infra/compute/api/gateway";
import { createUploadRoute } from "./infra/compute/api/upload";
import { createWorkerCompute } from "./infra/compute/workers";
import { createDatabase } from "./infra/database";
import { createStorage } from "./infra/storage";

// 1. Storage and Identity Layers
const storage = createStorage();
const database = createDatabase();
const auth = createAuth();

// 2. Instantiate Base Router Ingress
const gatewaySystem = createApiGateway({
	userPoolId: auth.userPool.id,
	userPoolClientId: auth.userPoolClient.id,
});

// 3. Mount Isolated Handlers onto Gateway Instance
createUploadRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	bucketId: storage.bucket.id,
	tableName: database.auditTable.name,
});

createDownloadRoute({
	httpApi: gatewaySystem.httpApi,
	apiAuthorizer: gatewaySystem.apiAuthorizer,
	bucketId: storage.bucket.id,
	tableName: database.auditTable.name,
});

// 4. Asynchronous Background Core Loop
createWorkerCompute({
	bucket: storage.bucket,
	tableName: database.auditTable.name,
});

// Outputs
export const cognitoPoolId = auth.userPool.id;
export const cognitoClientId = auth.userPoolClient.id;
export const publicApiEndpoint = gatewaySystem.httpApi.apiEndpoint;
