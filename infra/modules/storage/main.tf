resource "aws_s3_bucket" "vault" {
  bucket = "${var.project_name}-vault-${var.environment}"
}

resource "aws_s3_bucket_cors_configuration" "vault" {
  bucket = aws_s3_bucket.vault.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["PUT", "POST", "GET"]
    allowed_origins = ["http://localhost:3000", "*"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "vault" {
  bucket = aws_s3_bucket.vault.id

  rule {
    id     = "expire-old-files"
    status = "Enabled"

    filter {}

    expiration {
      days = 30
    }
  }
}

resource "aws_s3_bucket_public_access_block" "vault" {
  bucket = aws_s3_bucket.vault.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}
