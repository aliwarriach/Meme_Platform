# Terraform backend config can't reference variables/outputs — these two values are
# static literals that must match infra/bootstrap's outputs exactly. Account id
# 258032683838 (this AWS account, confirmed via `aws sts get-caller-identity`).
terraform {
  backend "s3" {
    bucket       = "meme-platform-tfstate-258032683838"
    key          = "persistent/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true # native S3 state locking (Terraform 1.10+) — dynamodb_table is deprecated
    encrypt      = true
  }
}
