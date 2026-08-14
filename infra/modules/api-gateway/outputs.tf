output "api_id" {
  description = "API Gateway HTTP API ID"
  value       = aws_apigatewayv2_api.main.id
}

output "api_endpoint" {
  description = "API Gateway HTTP API endpoint"
  value       = aws_apigatewayv2_api.main.api_endpoint
}

output "api_execution_arn" {
  description = "API Gateway HTTP API execution ARN"
  value       = aws_apigatewayv2_api.main.execution_arn
}

output "authorizer_id" {
  description = "API Gateway JWT Authorizer ID"
  value       = aws_apigatewayv2_authorizer.jwt.id
}
