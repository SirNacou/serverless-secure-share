output "s3_sync_function_name" {
  description = "Name of the s3-sync Lambda function"
  value       = aws_lambda_function.s3_sync.function_name
}

output "audit_logger_function_name" {
  description = "Name of the audit-logger Lambda function"
  value       = aws_lambda_function.audit_logger.function_name
}
