output "bucket_name" {
  description = "Name of the vault S3 bucket"
  value       = aws_s3_bucket.vault.id
}

output "bucket_arn" {
  description = "ARN of the vault S3 bucket"
  value       = aws_s3_bucket.vault.arn
}
