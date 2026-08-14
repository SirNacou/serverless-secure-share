output "audit_queue_url" {
  description = "URL of the audit event SQS queue"
  value       = aws_sqs_queue.audit_queue.id
}

output "audit_queue_arn" {
  description = "ARN of the audit event SQS queue"
  value       = aws_sqs_queue.audit_queue.arn
}
