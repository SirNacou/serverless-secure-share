output "api_endpoint" {
  description = "API Gateway HTTP API endpoint"
  value       = module.api_gateway.api_endpoint
}

output "cognito_pool_id" {
  description = "Cognito User Pool ID"
  value       = module.auth.user_pool_id
}

output "cognito_client_id" {
  description = "Cognito User Pool Client ID"
  value       = module.auth.user_pool_client_id
}

output "cognito_domain" {
  description = "Cognito hosted UI domain"
  value       = module.auth.cognito_domain
}

output "frontend_distribution_id" {
  description = "CloudFront distribution ID"
  value       = module.frontend.distribution_id
}

output "frontend_domain" {
  description = "Frontend CloudFront domain"
  value       = module.frontend.distribution_domain
}

output "deploy_role_arn" {
  description = "GitHub Actions deploy role ARN"
  value       = module.ci.deploy_role_arn
}
