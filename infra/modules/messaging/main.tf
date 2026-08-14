resource "aws_sqs_queue" "audit_dlq" {
  name                       = "${var.project_name}-audit-dlq"
  message_retention_seconds = 1209600
}

resource "aws_sqs_queue" "audit_queue" {
  name                       = "${var.project_name}-audit-event-queue"
  visibility_timeout_seconds = 30
  message_retention_seconds  = 345600

  redrive_policy = jsonencode({
    deadLetterTargetArn = aws_sqs_queue.audit_dlq.arn
    maxReceiveCount     = 3
  })
}
