terraform {
  required_version = ">= 1.7.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.60.0"
    }
  }

  backend "s3" {
    bucket         = "opentofu-state-419212279550"
    key            = "serverless-secure-share/terraform.tfstate"
    region         = "ap-south-1"
    dynamodb_table = "opentofu-locks"
    encrypt        = true
  }
}
