variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "aws_region" {
  description = "AWS region"
  type        = string
}

variable "api_id" {
  description = "API Gateway HTTP API ID"
  type        = string
}

variable "api_execution_arn" {
  description = "API Gateway HTTP API execution ARN"
  type        = string
}

variable "authorizer_id" {
  description = "API Gateway JWT Authorizer ID"
  type        = string
}

variable "metadata_table_name" {
  description = "DynamoDB metadata table name"
  type        = string
}

variable "user_profiles_table_name" {
  description = "DynamoDB user-profiles table name"
  type        = string
}

variable "display_names_table_name" {
  description = "DynamoDB display-names table name"
  type        = string
}

variable "audit_log_table_name" {
  description = "DynamoDB audit-log table name"
  type        = string
}

variable "bucket_name" {
  description = "S3 vault bucket name"
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

variable "user_pool_id" {
  description = "Cognito User Pool ID"
  type        = string
}

variable "user_pool_client_id" {
  description = "Cognito User Pool Client ID"
  type        = string
}
