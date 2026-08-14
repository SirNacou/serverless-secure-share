provider "aws" {
  region = var.aws_region
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

data "aws_caller_identity" "current" {}
data "aws_region" "current" {}

# ── 1. Database ───────────────────────────────────────────────────
module "database" {
  source = "./modules/database"

  project_name = var.project_name
}

# ── 2. Storage ────────────────────────────────────────────────────
module "storage" {
  source = "./modules/storage"

  project_name = var.project_name
  environment  = var.environment
}

# ── 3. Messaging ──────────────────────────────────────────────────
module "messaging" {
  source = "./modules/messaging"

  project_name = var.project_name
}

# ── 4. Auth ───────────────────────────────────────────────────────
module "auth" {
  source = "./modules/auth"

  project_name       = var.project_name
  environment        = var.environment
  domain_name        = var.domain_name
  google_client_id     = var.google_client_id
  google_client_secret = var.google_client_secret
}

# ── 5. API Gateway ────────────────────────────────────────────────
module "api_gateway" {
  source = "./modules/api-gateway"

  project_name       = var.project_name
  domain_name        = var.domain_name
  user_pool_id       = module.auth.user_pool_id
  user_pool_client_id = module.auth.user_pool_client_id
}

# ── 6. API Lambda Functions ───────────────────────────────────────
module "lambda" {
  source = "./modules/lambda"

  project_name             = var.project_name
  aws_region               = var.aws_region
  api_id                   = module.api_gateway.api_id
  api_execution_arn        = module.api_gateway.api_execution_arn
  authorizer_id            = module.api_gateway.authorizer_id
  metadata_table_name      = module.database.metadata_table_name
  user_profiles_table_name = module.database.user_profiles_table_name
  display_names_table_name = module.database.display_names_table_name
  audit_log_table_name     = module.database.audit_log_table_name
  bucket_name              = module.storage.bucket_name
  bucket_arn               = module.storage.bucket_arn
  audit_queue_url          = module.messaging.audit_queue_url
  audit_queue_arn          = module.messaging.audit_queue_arn
  user_pool_id             = module.auth.user_pool_id
  user_pool_client_id      = module.auth.user_pool_client_id
}

# ── 7. Worker Lambdas ─────────────────────────────────────────────
module "workers" {
  source = "./modules/workers"

  project_name               = var.project_name
  metadata_table_name        = module.database.metadata_table_name
  metadata_table_arn         = module.database.metadata_table_arn
  metadata_table_stream_arn  = module.database.metadata_table_stream_arn
  audit_log_table_name       = module.database.audit_log_table_name
  audit_log_table_arn        = module.database.audit_log_table_arn
  bucket_name                = module.storage.bucket_name
  bucket_id                  = module.storage.bucket_name
  bucket_arn                 = module.storage.bucket_arn
  audit_queue_url            = module.messaging.audit_queue_url
  audit_queue_arn            = module.messaging.audit_queue_arn
}

# ── 8. Frontend Hosting ───────────────────────────────────────────
module "frontend" {
  source = "./modules/frontend"

  project_name = var.project_name
  environment  = var.environment
  domain_name  = var.domain_name
  aws_region   = var.aws_region

  providers = {
    aws.us_east_1 = aws.us_east_1
  }
}

# ── 9. CI/CD ──────────────────────────────────────────────────────
module "ci" {
  source = "./modules/ci"

  project_name = var.project_name
  github_org   = var.github_org
  github_repo  = var.github_repo
}
