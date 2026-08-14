# ── ACM Certificate (must be in us-east-1 for CloudFront) ──────────
resource "aws_acm_certificate" "frontend" {
  provider = aws.us_east_1

  domain_name               = var.domain_name
  subject_alternative_names = [var.domain_name]
  validation_method         = "DNS"
}

# ── Cloudflare DNS Validation CNAME ───────────────────────────────
resource "cloudflare_record" "acm_validation" {
  zone_id = var.cloudflare_zone_id
  name    = tolist(aws_acm_certificate.frontend.domain_validation_options)[0].resource_record_name
  type    = "CNAME"
  content = tolist(aws_acm_certificate.frontend.domain_validation_options)[0].resource_record_value
  ttl     = 1
  proxied = false
}

# ── Wait for certificate validation ────────────────────────────────
resource "aws_acm_certificate_validation" "frontend" {
  provider = aws.us_east_1

  certificate_arn         = aws_acm_certificate.frontend.arn
  validation_record_fqdns = [cloudflare_record.acm_validation.hostname]
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
resource "cloudflare_record" "frontend" {
  zone_id = var.cloudflare_zone_id
  name    = "share.apps"
  type    = "CNAME"
  content = aws_cloudfront_distribution.frontend.domain_name
  ttl     = 1
  proxied = false
}
