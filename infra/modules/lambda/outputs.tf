output "function_names" {
  description = "Map of handler name to Lambda function name"
  value       = { for k, v in aws_lambda_function.api : k => v.function_name }
}

output "function_arns" {
  description = "Map of handler name to Lambda function ARN"
  value       = { for k, v in aws_lambda_function.api : k => v.arn }
}
