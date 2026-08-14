variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "domain_name" {
  description = "Custom domain for CORS"
  type        = string
}

variable "user_pool_id" {
  description = "Cognito User Pool ID for JWT authorizer"
  type        = string
}

variable "user_pool_client_id" {
  description = "Cognito User Pool Client ID for JWT authorizer"
  type        = string
}
