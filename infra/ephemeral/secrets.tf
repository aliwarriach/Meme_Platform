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

# Roadmap_Scaling.md C4 — shared secret between the app's own
# GET /internal/metrics/ws-connections (backend/app/routers/internal_metrics.py) and
# KEDA's realtime TriggerAuthentication (deploy/helm/templates/scaledobject-realtime.yaml)
# so that endpoint isn't a bare unauthenticated internal signal reachable through the
# ALB's api catch-all route like anything else.
resource "random_password" "internal_metrics_token" {
  length  = 43
  special = false
}

resource "kubernetes_secret" "app_secrets" {
  metadata {
    name      = "app-secrets"
    namespace = "default"
  }

  data = {
    # Roadmap_Scaling.md C3 — through PgBouncer (pgbouncer.tf), not straight at RDS
    # anymore. DB_USE_PGBOUNCER gates A2's asyncpg statement_cache_size=0 workaround
    # (app/db/session.py) transaction-pooling mode requires, same as A7 locally.
    DATABASE_URL             = "postgresql+asyncpg://memeplatform_admin:${local.rds_password}@pgbouncer:6432/memeplatform"
    DB_USE_PGBOUNCER         = "true"
    REDIS_URL                = "redis://${local.redis_host}:6379/0"
    JWT_SECRET               = var.jwt_secret
    CLOUDINARY_CLOUD_NAME    = var.cloudinary_cloud_name
    CLOUDINARY_API_KEY       = var.cloudinary_api_key
    CLOUDINARY_API_SECRET    = var.cloudinary_api_secret
    GROQ_API_KEY             = var.groq_api_key
    GROQ_MODEL               = var.groq_model
    GOOGLE_SIGNIN_CLIENT_IDS = var.google_signin_client_ids
    INTERNAL_METRICS_TOKEN   = random_password.internal_metrics_token.result
  }

  type = "Opaque"
}
