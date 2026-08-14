# ── ACM Certificate (must be in us-east-1 for CloudFront) ──────────
resource "aws_acm_certificate" "frontend" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = [var.domain_name]
  validation_method         = "DNS"
}

# ── Cloudflare DNS Validation CNAME ───────────────────────────────
# Managed outside tofu — created manually during initial cert provisioning.
# The Cloudflare v5 provider normalises names with trailing dots which
# causes a perpetual diff the API rejects as "record already exists".

# ── Wait for certificate validation ────────────────────────────────
resource "aws_acm_certificate_validation" "frontend" {
  provider = aws.us_east_1

  certificate_arn = aws_acm_certificate.frontend.arn
}

# ── Frontend S3 Bucket ────────────────────────────────────────────
resource "aws_s3_bucket" "frontend" {
  bucket        = "${var.project_name}-frontend-${var.environment}"
  force_destroy = true
}

resource "aws_s3_bucket_public_access_block" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# ── Origin Access Control ─────────────────────────────────────────
resource "aws_cloudfront_origin_access_control" "frontend" {
  name                              = "${var.project_name}-frontend-oac"
  description                       = "OAC for frontend S3 bucket"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

# ── Bucket Policy for CloudFront OAC ──────────────────────────────
resource "aws_s3_bucket_policy" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.frontend.arn}/*"
        Condition = {
          StringLike = {
            "AWS:SourceArn" = "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/*"
          }
        }
      }
    ]
  })
}

# ── CloudFront Distribution ───────────────────────────────────────
resource "aws_cloudfront_distribution" "frontend" {
  enabled             = true
  default_root_object = "index.html"
  aliases             = [var.domain_name]
  price_class         = "PriceClass_100"

  origin {
    domain_name              = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id                = aws_s3_bucket.frontend.id
    origin_access_control_id = aws_cloudfront_origin_access_control.frontend.id
  }

  default_cache_behavior {
    target_origin_id       = aws_s3_bucket.frontend.id
    viewer_protocol_policy = "redirect-to-https"
    allowed_methods        = ["GET", "HEAD", "OPTIONS"]
    cached_methods         = ["GET", "HEAD", "OPTIONS"]
    default_ttl            = 0

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }
  }

  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.frontend.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }
}

data "aws_caller_identity" "current" {}

# ── Cloudflare DNS CNAME for CloudFront ───────────────────────────
# Managed outside tofu — created manually to avoid Cloudflare v5
# trailing-dot perpetual diff issue.
