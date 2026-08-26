# Roadmap_Scaling.md C3 — PgBouncer as the database's shock absorber (~$11-15/mo
# cheaper than RDS Proxy for the same job). Transaction-pooling config is the same
# shape A7 already proved locally (deploy/pgbouncer.ini) — real credentials/endpoint
# substituted in here via Terraform interpolation instead of docker-compose env vars,
# same pattern secrets.tf already uses for DATABASE_URL.

resource "kubernetes_secret" "pgbouncer_config" {
  metadata {
    name      = "pgbouncer-config"
    namespace = "default"
  }

  data = {
    "pgbouncer.ini" = <<-INI
      [databases]
      memeplatform = host=${local.rds_host} port=5432 dbname=memeplatform user=memeplatform_admin password=${local.rds_password}

      [pgbouncer]
      listen_addr = 0.0.0.0
      listen_port = 6432
      auth_type = plain
      auth_file = /etc/pgbouncer/userlist.txt
      admin_users = memeplatform_admin

      pool_mode = transaction
      # Sized for values-loadtest.yaml's ceiling (70 api + 10 realtime = 80 pods) x
      # (db_pool_size=5 + db_max_overflow=5, A2's per-pod config) = 800; 1000 leaves
      # headroom. default_pool_size (backend connections PgBouncer itself opens to
      # RDS) stays at A7's proven 20 - well under db.t4g.micro's max_connections.
      max_client_conn = 1000
      default_pool_size = 20

      logfile = /dev/stdout
      pidfile = /tmp/pgbouncer.pid
    INI

    "userlist.txt" = "\"memeplatform_admin\" \"${local.rds_password}\""
  }

  type = "Opaque"
}

resource "kubernetes_deployment" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = "default"
    labels    = { app = "pgbouncer" }
  }

  spec {
    replicas = 1

    selector {
      match_labels = { app = "pgbouncer" }
    }

    template {
      metadata {
        labels = { app = "pgbouncer" }
      }

      spec {
        container {
          name = "pgbouncer"
          # Same image A7's docker-compose.scale.yml proved locally.
          image = "edoburu/pgbouncer:latest"

          port {
            container_port = 6432
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/pgbouncer/pgbouncer.ini"
            sub_path   = "pgbouncer.ini"
            read_only  = true
          }

          volume_mount {
            name       = "config"
            mount_path = "/etc/pgbouncer/userlist.txt"
            sub_path   = "userlist.txt"
            read_only  = true
          }

          resources {
            requests = {
              cpu    = "100m"
              memory = "128Mi"
            }
            limits = {
              cpu    = "250m"
              memory = "256Mi"
            }
          }
        }

        volume {
          name = "config"
          secret {
            secret_name = kubernetes_secret.pgbouncer_config.metadata[0].name
          }
        }
      }
    }
  }
}

resource "kubernetes_service" "pgbouncer" {
  metadata {
    name      = "pgbouncer"
    namespace = "default"
  }

  spec {
    selector = { app = "pgbouncer" }

    port {
      name        = "pgbouncer"
      port        = 6432
      target_port = 6432
    }
  }
}
