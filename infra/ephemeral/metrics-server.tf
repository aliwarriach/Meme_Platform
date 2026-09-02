# Roadmap_Scaling.md C4 — EKS, unlike GKE, does not bundle metrics-server. Without it
# the resource-metrics API has no source and api's HorizontalPodAutoscaler (hpa-api.yaml)
# just sits at `cpu: <unknown>/65%` forever, never scaling anything - the CPU-based HPA
# the roadmap asks for is a no-op without this. Bottlerocket nodes' kubelet already
# serves the standard secure kubelet-metrics endpoint, so no extra node-side config is
# needed beyond the chart's own defaults.
resource "helm_release" "metrics_server" {
  namespace  = "kube-system"
  name       = "metrics-server"
  repository = "https://kubernetes-sigs.github.io/metrics-server"
  chart      = "metrics-server"
  version    = "3.14.0"
  wait       = true
  timeout    = 300

  depends_on = [module.eks]
}
