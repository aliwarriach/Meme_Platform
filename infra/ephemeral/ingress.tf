# Roadmap_Scaling.md C3 — one shared ALB (`group.name`) split across two Ingress
# resources so the realtime backend can carry its own target-group attributes
# (sticky sessions) without applying them to the api backend too — an ALB-level
# annotation applies per target group, not per path, so "different settings per
# backend" needs separate Ingress objects even though they render to one load
# balancer. Public subnets are already tagged kubernetes.io/role/elb=1
# (infra/persistent/vpc.tf, from B2) so the controller auto-discovers them - no
# explicit `subnets` annotation needed.
#
# The realtime route is `/meme-sending/ws` (backend/app/routers/meme_sending.py),
# not a bare `/ws` - the roadmap's "route /ws to the realtime service" is shorthand
# for "the websocket path", not the literal route. api and realtime run the exact
# same image/app (A6), so a wrong path here wouldn't 404 - it'd silently route real
# WS traffic to api's catch-all instead, defeating the reason C4 scales realtime on
# connection count separately from api's CPU-based HPA. Kept path-scoped to exactly
# `/meme-sending/ws` rather than the whole `/meme-sending` prefix so the sibling REST
# routes (`/meme-sending/send`, `/meme-sending/ws-ticket` - ordinary short HTTP
# requests) still scale with api, not with realtime.
#
# Cloudflare (free TLS, DDoS protection, edge caching, WebSocket proxying) is the
# other half of this phase's IMPLEMENT step and is NOT done here - it needs an
# account/domain only the project owner has. These two Ingresses are the ALB half;
# point Cloudflare's DNS at the ALB hostname (`kubectl get ingress` ADDRESS column)
# to finish C3.

resource "kubernetes_ingress_v1" "api" {
  metadata {
    name      = "api"
    namespace = "default"
    annotations = {
      "kubernetes.io/ingress.class"                = "alb"
      "alb.ingress.kubernetes.io/scheme"           = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"      = "ip"
      "alb.ingress.kubernetes.io/listen-ports"     = jsonencode([{ HTTP = 80 }])
      "alb.ingress.kubernetes.io/group.name"       = "${var.project}-alb"
      "alb.ingress.kubernetes.io/group.order"      = "20"
      "alb.ingress.kubernetes.io/healthcheck-path" = "/health/ready"
    }
  }

  spec {
    ingress_class_name = "alb"

    rule {
      http {
        path {
          path      = "/"
          path_type = "Prefix"
          backend {
            service {
              name = "api"
              port { number = 80 }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.aws_load_balancer_controller]
}

resource "kubernetes_ingress_v1" "realtime" {
  metadata {
    name      = "realtime"
    namespace = "default"
    annotations = {
      "kubernetes.io/ingress.class"            = "alb"
      "alb.ingress.kubernetes.io/scheme"       = "internet-facing"
      "alb.ingress.kubernetes.io/target-type"  = "ip"
      "alb.ingress.kubernetes.io/listen-ports" = jsonencode([{ HTTP = 80 }])
      "alb.ingress.kubernetes.io/group.name"   = "${var.project}-alb"
      # Lower group.order = higher priority - /ws must be matched before api's
      # catch-all "/" rule, since both share the same ALB/listener.
      "alb.ingress.kubernetes.io/group.order"      = "10"
      "alb.ingress.kubernetes.io/healthcheck-path" = "/health/ready"
      # Sticky sessions (C3 IMPLEMENT) - a dropped WS reconnect must land back on a
      # pod that still has its connection state; lb_cookie is the ALB's own affinity
      # cookie, set on the HTTP upgrade request before the socket switches protocols.
      "alb.ingress.kubernetes.io/target-group-attributes" = "stickiness.enabled=true,stickiness.type=lb_cookie,stickiness.lb_cookie.duration_seconds=86400"
    }
  }

  spec {
    ingress_class_name = "alb"

    rule {
      http {
        path {
          path      = "/meme-sending/ws"
          path_type = "Prefix"
          backend {
            service {
              name = "realtime"
              port { number = 80 }
            }
          }
        }
      }
    }
  }

  depends_on = [helm_release.aws_load_balancer_controller]
}
