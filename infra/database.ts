import * as aws from "@pulumi/aws";

export function createDatabase() {
    const auditTable = new aws.dynamodb.Table("AuditLogTable", {
        attributes: [
            { name: "link_id", type: "S" },
            { name: "timestamp", type: "N" }
        ],
        hashKey: "link_id",
        rangeKey: "timestamp",
        billingMode: "PAY_PER_REQUEST",
    });

    // Aurora DSQL infrastructure definition will look clean appended here later

    return { auditTable };
}