# Roadmap_Scaling.md B2 — one-time bootstrap for Terraform's own remote state.
#
# Chicken-and-egg: the S3 bucket + DynamoDB table that infra/persistent and
# infra/ephemeral store their state in can't themselves live in that same remote
# state (it doesn't exist yet). This module uses local state — applied once, by
# hand, then left alone. Never gets a backend block, never gets destroyed as part
# of routine ephemeral teardown.

terraform {
  required_version = ">= 1.9"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
  default_tags {
    tags = {
      Project   = "meme-platform"
      ManagedBy = "terraform"
      Stack     = "bootstrap"
    }
  }
}

variable "aws_region" {
  type    = string
  default = "us-east-1"
}

# Bucket name must be globally unique across all of AWS — suffixed with the
# account id rather than a random suffix so it's reproducible/discoverable.
data "aws_caller_identity" "current" {}

locals {
  state_bucket_name = "meme-platform-tfstate-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket" "tf_state" {
  bucket = local.state_bucket_name

  # Terraform state holds a full resource inventory, including RDS/ElastiCache
  # endpoints and (until B3 migrates to K8s Secrets) potentially other
  # sensitive attributes — this bucket is never public, ever.
  lifecycle {
    prevent_destroy = true
  }
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket                  = aws_s3_bucket.tf_state.id
  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

# No DynamoDB lock table: Terraform 1.10+'s S3 backend does native state locking via a
# lockfile object in the same bucket (`use_lockfile = true` in each stack's backend.tf),
# which is what current `terraform init` recommends over `dynamodb_table` — that
# parameter is flagged deprecated as of the Terraform version this project uses
# (confirmed via the init warning, 2026-08-25). One less resource to pay for/manage.

output "state_bucket_name" {
  value = aws_s3_bucket.tf_state.bucket
}
