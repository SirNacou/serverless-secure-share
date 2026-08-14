variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "environment" {
  description = "Environment name"
  type        = string
}

variable "domain_name" {
  description = "Custom domain for the frontend"
  type        = string
}

variable "aws_region" {
  description = "AWS region (for provider alias passthrough)"
  type        = string
}

variable "cloudflare_zone_id" {
  description = "Cloudflare zone ID for DNS validation CNAME record"
  type        = string
}
