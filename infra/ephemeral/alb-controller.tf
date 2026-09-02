# Roadmap_Scaling.md C3 — AWS Load Balancer Controller, which turns the Ingress
# resources below into a real ALB. Hand-rolled IAM role + Pod Identity association
# (not a registry submodule) to match the pattern C1 already established for the
# Karpenter controller in eks.tf — Pod Identity needs no OIDC-provider wiring, and
# keeping both controllers on the same mechanism is one fewer thing to reason about.

data "aws_iam_policy_document" "alb_controller_assume" {
  statement {
    actions = ["sts:AssumeRole", "sts:TagSession"]
    principals {
      type        = "Service"
      identifiers = ["pods.eks.amazonaws.com"]
    }
  }
}

resource "aws_iam_role" "alb_controller" {
  name               = "${var.project}-alb-controller"
  assume_role_policy = data.aws_iam_policy_document.alb_controller_assume.json
}

# Official policy JSON (kubernetes-sigs/aws-load-balancer-controller docs/install/iam_policy.json,
# pulled live 2026-08-26 for chart v3.5.0/app v3.5.0) inlined rather than pulled from a
# registry module, for the same reason B3/C1 hand-rolled things elsewhere this session:
# one less external module version to pin and trust sight-unseen.
resource "aws_iam_role_policy" "alb_controller" {
  name = "${var.project}-alb-controller"
  role = aws_iam_role.alb_controller.id

  policy = file("${path.module}/alb-controller-iam-policy.json")
}

resource "aws_eks_pod_identity_association" "alb_controller" {
  cluster_name    = module.eks.cluster_name
  namespace       = "kube-system"
  service_account = "aws-load-balancer-controller"
  role_arn        = aws_iam_role.alb_controller.arn
}

resource "kubernetes_service_account" "alb_controller" {
  metadata {
    name      = "aws-load-balancer-controller"
    namespace = "kube-system"
    labels = {
      "app.kubernetes.io/name"      = "aws-load-balancer-controller"
      "app.kubernetes.io/component" = "controller"
    }
  }
}

resource "helm_release" "aws_load_balancer_controller" {
  namespace = "kube-system"
  name      = "aws-load-balancer-controller"
  # Originally a plain repository/chart reference (this is a plain https index, not
  # OCI, so C1's Windows OCI-login bug doesn't apply here) - but resuming this phase
  # on 2026-09-01 hit a *different* Windows-network issue reaching
  # aws.github.io/eks-charts specifically: Go's TLS client (Terraform's helm provider,
  # and the helm CLI itself) fails deterministically with "tls: bad record MAC",
  # while curl/schannel succeeds most of the time against the same host. Root cause
  # not fully isolated (looks like intermittent packet corruption or DPI interference
  # on this network that Go's stricter TLS record parser doesn't tolerate) - same
  # symptom class as C1's OCI bug, different trigger. Same fix: pull the chart once
  # via a path that isn't the failing Go TLS client (curl, which mostly succeeds) into
  # a committed `charts/aws-load-balancer-controller-3.5.0.tgz` and reference it as a
  # local chart, sidestepping the repository fetch entirely.
  chart   = "${path.module}/charts/aws-load-balancer-controller-3.5.0.tgz"
  version = "3.5.0"
  wait    = true
  timeout = 300

  values = [<<-EOT
    clusterName: ${module.eks.cluster_name}
    region: ${var.aws_region}
    vpcId: ${data.terraform_remote_state.persistent.outputs.vpc_id}
    serviceAccount:
      create: false
      name: ${kubernetes_service_account.alb_controller.metadata[0].name}
  EOT
  ]

  # aws_iam_role_policy.alb_controller listed explicitly, not just implied through
  # aws_eks_pod_identity_association.alb_controller's role_arn reference - found by a
  # broken `terraform destroy` (2026-08-26): with no direct dependency, Terraform had
  # no reason to keep the inline policy attached until *after* the controller (and
  # anything depending on it) finished tearing down, so it destroyed the policy
  # concurrently with kubernetes_ingress_v1.api/realtime. The controller lost
  # ec2:DescribeSecurityGroups mid-reconcile and could never finish removing the
  # Ingress finalizers, leaving both objects (and the destroy run) stuck for 20+
  # minutes. This depends_on makes the real requirement explicit: the controller needs
  # its permissions for as long as anything depending on it is being destroyed, so the
  # policy must outlive the helm_release itself, not just the role/association.
  depends_on = [
    module.eks,
    kubernetes_service_account.alb_controller,
    aws_eks_pod_identity_association.alb_controller,
    aws_iam_role_policy.alb_controller,
  ]
}
