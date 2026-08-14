variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "metadata_table_name" {
  description = "DynamoDB metadata table name"
  type        = string
}

variable "metadata_table_arn" {
  description = "DynamoDB metadata table ARN"
  type        = string
}

variable "metadata_table_stream_arn" {
  description = "DynamoDB metadata table stream ARN"
  type        = string
}

variable "audit_log_table_name" {
  description = "DynamoDB audit-log table name"
  type        = string
}

variable "audit_log_table_arn" {
  description = "DynamoDB audit-log table ARN"
  type        = string
}

variable "bucket_name" {
  description = "S3 vault bucket name"
  type        = string
}

variable "bucket_id" {
  description = "S3 vault bucket ID (for notifications)"
  type        = string
}

variable "bucket_arn" {
  description = "S3 vault bucket ARN"
  type        = string
}

variable "audit_queue_url" {
  description = "SQS audit queue URL"
  type        = string
}

variable "audit_queue_arn" {
  description = "SQS audit queue ARN"
  type        = string
}
