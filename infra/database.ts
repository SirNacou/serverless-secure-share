import * as aws from "@pulumi/aws";

export function createDatabase() {
	const metadataTable = new aws.dynamodb.Table("share-metadata", {
		attributes: [
			{ name: "link_id", type: "S" },
			{ name: "owner_username", type: "S" },
			{ name: "visibility", type: "S" },
			{ name: "created_at", type: "N" },
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
			{
				name: "by_visibility",
				keySchemas: [
					{ attributeName: "visibility", keyType: "HASH" },
					{ attributeName: "created_at", keyType: "RANGE" },
				],
				projectionType: "ALL",
			},
		],
	});

	const userProfilesTable = new aws.dynamodb.Table("user-profiles", {
		attributes: [
			{ name: "username", type: "S" },
		],
		hashKey: "username",
		billingMode: "PAY_PER_REQUEST",
	});

	const displayNamesTable = new aws.dynamodb.Table("display-names", {
		attributes: [
			{ name: "display_name", type: "S" },
		],
		hashKey: "display_name",
		billingMode: "PAY_PER_REQUEST",
	});

	const auditTable = new aws.dynamodb.Table("audit-log", {
		attributes: [
			{ name: "log_id", type: "S" },
			{ name: "link_id", type: "S" },
			{ name: "timestamp", type: "N" },
			{ name: "owner_username", type: "S" },
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
			{
				name: "by_owner",
				keySchemas: [
					{ attributeName: "owner_username", keyType: "HASH" },
					{ attributeName: "timestamp", keyType: "RANGE" },
				],
				projectionType: "ALL",
			},
		],
	});

	return { metadataTable, auditTable, userProfilesTable, displayNamesTable };
}
