# Same bucket as infra/persistent, different state key — two independent state files,
# the structural decision B2 exists for (§ B2 IMPLEMENT step 1). Destroying this stack
# must never be able to touch persistent's state.
terraform {
  backend "s3" {
    bucket       = "meme-platform-tfstate-258032683838"
    key          = "ephemeral/terraform.tfstate"
    region       = "us-east-1"
    use_lockfile = true # native S3 state locking (Terraform 1.10+) — dynamodb_table is deprecated
    encrypt      = true
  }
}
