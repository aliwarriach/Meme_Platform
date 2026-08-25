# Roadmap_Scaling.md B3 step 3. The RDS master password is never handled by this
# process or stored in a .tfvars file — `manage_master_user_password = true`
# (infra/persistent/rds.tf) means AWS itself generated it into Secrets Manager, and this
# data source is Terraform reading it back out, straight into the K8s Secret.
data "aws_secretsmanager_secret_version" "rds_master" {
  secret_id = data.terraform_remote_state.persistent.outputs.rds_master_user_secret_arn
}

locals {
  rds_password = jsondecode(data.aws_secretsmanager_secret_version.rds_master.secret_string)["password"]
  rds_host     = split(":", data.terraform_remote_state.persistent.outputs.rds_endpoint)[0]
  redis_host   = data.terraform_remote_state.persistent.outputs.redis_endpoint
}

resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "app-secrets"
    namespace = "default"
  }

  data = {
    DATABASE_URL             = "postgresql+asyncpg://memeplatform_admin:${local.rds_password}@${local.rds_host}:5432/memeplatform"
    REDIS_URL                = "redis://${local.redis_host}:6379/0"
    JWT_SECRET               = var.jwt_secret
    CLOUDINARY_CLOUD_NAME    = var.cloudinary_cloud_name
    CLOUDINARY_API_KEY       = var.cloudinary_api_key
    CLOUDINARY_API_SECRET    = var.cloudinary_api_secret
    GROQ_API_KEY             = var.groq_api_key
    GROQ_MODEL               = var.groq_model
    GOOGLE_SIGNIN_CLIENT_IDS = var.google_signin_client_ids
  }

  type = "Opaque"
}
