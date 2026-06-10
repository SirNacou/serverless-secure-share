import { createAuth } from "./infra/auth";
import { createCompute } from "./infra/compute";
import { createDatabase } from "./infra/database";
import { createStorage } from "./infra/storage";

const storage = createStorage();
const database = createDatabase();
const auth = createAuth();

// Inject both storage, database, and identity provider components
const compute = createCompute({
    bucketId: storage.bucket.id,
    tableName: database.auditTable.name,
    userPoolId: auth.userPool.id,          // Injected
    userPoolClientId: auth.userPoolClient.id, // Injected
});

export const s3BucketName = storage.bucket.id;
export const dynamoTableName = database.auditTable.name;
export const cognitoPoolId = auth.userPool.id;
export const cognitoClientId = auth.userPoolClient.id;
export const publicApiEndpoint = compute.apiUrl;