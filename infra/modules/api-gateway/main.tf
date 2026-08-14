resource "aws_apigatewayv2_api" "main" {
  name          = "${var.project_name}-http-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["http://localhost:3000", "https://${var.domain_name}"]
    allow_methods = ["POST", "GET", "PUT", "OPTIONS"]
    allow_headers = ["content-type", "authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_authorizer" "jwt" {
  api_id           = aws_apigatewayv2_api.main.id
  authorizer_type  = "JWT"
  name             = "${var.project_name}-jwt-authorizer"
  identity_sources = ["$request.header.Authorization"]

  jwt_configuration {
    issuer   = "https://cognito-idp.${data.aws_region.current.region}.amazonaws.com/${var.user_pool_id}"
    audience = [var.user_pool_client_id]
  }
}

resource "aws_apigatewayv2_stage" "default" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = "$default"
  auto_deploy = true

  default_route_settings {
    throttling_burst_limit = 20
    throttling_rate_limit  = 10
  }
}

data "aws_region" "current" {}
