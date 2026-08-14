output "metadata_table_name" {
  description = "Name of the share-metadata DynamoDB table"
  value       = aws_dynamodb_table.share_metadata.name
}

output "metadata_table_arn" {
  description = "ARN of the share-metadata DynamoDB table"
  value       = aws_dynamodb_table.share_metadata.arn
}

output "metadata_table_stream_arn" {
  description = "ARN of the share-metadata DynamoDB stream"
  value       = aws_dynamodb_table.share_metadata.stream_arn
}

output "user_profiles_table_name" {
  description = "Name of the user-profiles DynamoDB table"
  value       = aws_dynamodb_table.user_profiles.name
}

output "display_names_table_name" {
  description = "Name of the display-names DynamoDB table"
  value       = aws_dynamodb_table.display_names.name
}

output "audit_log_table_name" {
  description = "Name of the audit-log DynamoDB table"
  value       = aws_dynamodb_table.audit_log.name
}

output "audit_log_table_arn" {
  description = "ARN of the audit-log DynamoDB table"
  value       = aws_dynamodb_table.audit_log.arn
}
