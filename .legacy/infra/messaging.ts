import * as aws from "@pulumi/aws";
import * as pulumi from "@pulumi/pulumi";

export function createMessaging() {
	const deadLetterQueue = new aws.sqs.Queue("audit-dlq", {
		messageRetentionSeconds: 1209600,
	});

	const auditQueue = new aws.sqs.Queue("audit-event-queue", {
		visibilityTimeoutSeconds: 30,
		messageRetentionSeconds: 345600,
		redrivePolicy: pulumi
		.all([deadLetterQueue.arn])
		.apply(([arn]) =>
			JSON.stringify({
				deadLetterTargetArn: arn,
				maxReceiveCount: 3,
			}),
		),
	});

	return {
		auditQueue,
		auditQueueUrl: auditQueue.id,
		deadLetterQueue,
	};
}
