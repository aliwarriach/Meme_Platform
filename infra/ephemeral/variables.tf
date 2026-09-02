variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "meme-platform"
}

# Roadmap_Scaling.md B3 step 3 — moved from backend/.env into a K8s Secret sourced from
# Terraform. `database_url`/`redis_url` are derived here from the persistent stack's real
# endpoints; these four have no AWS-native secret store yet (unlike the RDS master
# password, which comes from Secrets Manager via secrets.tf) — supplied via a gitignored
# `*.tfvars` file (same pattern as everything else in `.gitignore`'s Terraform section),
# never hardcoded here. A future phase could promote these into Secrets Manager/SSM too;
# out of scope for "purely a delivery-mechanism change."
variable "jwt_secret" {
  type      = string
  sensitive = true
}

variable "cloudinary_cloud_name" {
  type = string
}

variable "cloudinary_api_key" {
  type = string
}

variable "cloudinary_api_secret" {
  type      = string
  sensitive = true
}

variable "groq_api_key" {
  type      = string
  sensitive = true
}

variable "groq_model" {
  type    = string
  default = "openai/gpt-oss-20b"
}

variable "google_signin_client_ids" {
  type    = string
  default = ""
}
