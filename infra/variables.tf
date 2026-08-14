variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-southeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "serverless-secure-share"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "domain_name" {
  description = "Custom domain for the frontend"
  type        = string
  default     = "share.apps.nacou.dev"
}

variable "google_client_id" {
  description = "Google OAuth client ID for Cognito"
  type        = string
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret for Cognito"
  type        = string
  sensitive   = true
}

variable "github_org" {
  description = "GitHub organization for OIDC trust"
  type        = string
  default     = "SirNacou"
}

variable "github_repo" {
  description = "GitHub repository name for OIDC trust"
  type        = string
  default     = "serverless-secure-share"
}
