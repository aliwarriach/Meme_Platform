# Roadmap_Scaling.md C4 — KEDA, the event-driven autoscaler for realtime (custom
# connection-count metric, added once C4's image rebuild goes through - see
# deploy/helm's scaledobject-worker.yaml for why worker goes first) and worker (arq
# queue depth, redis scaler, no new image needed). Plain https Helm repo like the ALB
# controller - no OCI login involved.

resource "helm_release" "keda" {
  namespace        = "keda"
  create_namespace = true
  name             = "keda"
  repository       = "https://kedacore.github.io/charts"
  chart            = "keda"
  version          = "2.20.2"
  wait             = true
  timeout          = 300

  depends_on = [module.eks]
}
