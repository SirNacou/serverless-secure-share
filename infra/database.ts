import * as aws from "@pulumi/aws";

export function createDatabase() {
	const metadataTable = new aws.dynamodb.Table("share-metadata", {
		attributes: [
			{ name: "link_id", type: "S" },
			{ name: "owner_username", type: "S" },
		],
		hashKey: "link_id",
		billingMode: "PAY_PER_REQUEST",
		ttl: {
			attributeName: "ttl",
			enabled: true,
		},
		streamEnabled: true,
		streamViewType: "OLD_IMAGE",
		globalSecondaryIndexes: [
			{
				name: "by_owner",
				keySchemas: [{ attributeName: "owner_username", keyType: "HASH" }],
				projectionType: "ALL",
			},
		],
	});

	const auditTable = new aws.dynamodb.Table("audit-log", {
		attributes: [
			{ name: "log_id", type: "S" },
			{ name: "link_id", type: "S" },
			{ name: "timestamp", type: "N" },
		],
		hashKey: "log_id",
		billingMode: "PAY_PER_REQUEST",
		ttl: {
			attributeName: "ttl",
			enabled: true,
		},
		globalSecondaryIndexes: [
			{
				name: "by_link_id",
				keySchemas: [
					{ attributeName: "link_id", keyType: "HASH" },
					{ attributeName: "timestamp", keyType: "RANGE" },
				],
				projectionType: "ALL",
			},
		],
	});

	return { metadataTable, auditTable };
}
