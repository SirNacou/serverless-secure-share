import * as aws from "@pulumi/aws";

export function createDatabase() {
	const auditTable = new aws.dynamodb.Table("audit-log-table", {
		attributes: [
			{ name: "link_id", type: "S" }, // Sole primary key
		],
		hashKey: "link_id",
		billingMode: "PAY_PER_REQUEST",
		// Enable TTL automatically on the 'ttl' attribute name
		ttl: {
			attributeName: "ttl",
			enabled: true,
		},
		streamEnabled: true,
		streamViewType: "OLD_IMAGE"
	});

	return { auditTable };
}
