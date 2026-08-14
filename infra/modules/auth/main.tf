resource "aws_cognito_user_pool" "main" {
  name = "${var.project_name}-pool"

  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }
}

resource "aws_cognito_user_pool_domain" "main" {
  domain       = "${var.project_name}-${var.environment}"
  user_pool_id = aws_cognito_user_pool.main.id
}

resource "aws_cognito_identity_provider" "google" {
  user_pool_id = aws_cognito_user_pool.main.id
  provider_name = "Google"
  provider_type = "Google"

  provider_details = {
    client_id        = var.google_client_id
    client_secret    = var.google_client_secret
    authorize_scopes = "email profile"
  }

  attribute_mapping = {
    email = "email"
  }
}

resource "aws_cognito_user_pool_client" "main" {
  name = "${var.project_name}-web-client"

  user_pool_id = aws_cognito_user_pool.main.id

  explicit_auth_flows = [
    "ALLOW_USER_SRP_AUTH",
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH",
  ]

  callback_urls = [
    "http://localhost:3000/auth/callback",
    "https://${var.domain_name}/auth/callback",
  ]

  logout_urls = [
    "http://localhost:3000",
    "https://${var.domain_name}",
  ]

  supported_identity_providers = [
    "COGNITO",
    aws_cognito_identity_provider.google.provider_name,
  ]

  allowed_oauth_flows_user_pool_client = true
  allowed_oauth_flows                  = ["code"]
  allowed_oauth_scopes                 = ["email", "openid", "profile"]
}
