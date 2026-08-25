# Roadmap_Scaling.md C1 — EKS + Karpenter on spot.
#
# `subnet_ids` here places the control plane's ENIs in the private subnets (they only
# need to reach node kubelets over intra-VPC routing, which always works via the VPC's
# implicit local route — no internet access required for that). The `karpenter` managed
# node group is explicitly overridden onto the PUBLIC subnets instead: those nodes need
# outbound internet to pull the Karpenter/CoreDNS/VPC-CNI images, and this architecture
# has no NAT Gateway (§1.2) — public subnets + tight security groups is the substitute,
# same reasoning as every future Karpenter-provisioned node (EC2NodeClass, below).
module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 21.0"

  name               = "${var.project}-eks"
  kubernetes_version = "1.33"

  enable_cluster_creator_admin_permissions = true
  endpoint_public_access                   = true

  addons = {
    coredns                = {}
    eks-pod-identity-agent = { before_compute = true }
    kube-proxy             = {}
    vpc-cni                = { before_compute = true }
  }

  vpc_id     = data.terraform_remote_state.persistent.outputs.vpc_id
  subnet_ids = data.terraform_remote_state.persistent.outputs.private_subnet_ids

  # One small always-on managed node group exists only to host the Karpenter controller
  # itself — Karpenter can't provision the node it runs on. Everything else (the app's
  # actual pods) is provisioned by Karpenter via the NodePool/EC2NodeClass below.
  eks_managed_node_groups = {
    karpenter = {
      ami_type       = "BOTTLEROCKET_x86_64"
      instance_types = ["t3.small"]
      subnet_ids     = data.terraform_remote_state.persistent.outputs.public_subnet_ids

      # Additional SG beyond the module's own auto-created node SG — this is what
      # actually lets pods on this node reach RDS/ElastiCache (their SGs only allow
      # ingress from app_access, persistent/security_groups.tf). Discovered missing
      # 2026-08-25 when the Alembic migration Job timed out connecting to RDS from a pod
      # scheduled on this node group — declaring the SG in persistent wasn't enough, it
      # also has to be actually attached here.
      vpc_security_group_ids = [data.terraform_remote_state.persistent.outputs.app_access_security_group_id]

      min_size     = 1
      max_size     = 2
      desired_size = 1

      labels = { "karpenter.sh/controller" = "true" }
    }
  }

  node_security_group_tags = {
    "karpenter.sh/discovery" = "${var.project}-eks"
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
    Stack     = "ephemeral"
  }
}

# Karpenter-provisioned nodes also land in the public subnets (tagged for discovery
# below) — same no-NAT reasoning as the controller's own node group above.
resource "aws_ec2_tag" "karpenter_discovery_public_subnets" {
  for_each    = toset(data.terraform_remote_state.persistent.outputs.public_subnet_ids)
  resource_id = each.value
  key         = "karpenter.sh/discovery"
  value       = "${var.project}-eks"
}

module "karpenter" {
  source  = "terraform-aws-modules/eks/aws//modules/karpenter"
  version = "~> 21.0"

  cluster_name = module.eks.cluster_name

  # The controller policy this module generates exceeds AWS's 6144-byte managed-policy
  # limit for this instance-type/region combination (a known issue —
  # terraform-aws-modules/terraform-aws-eks#3512/#3692 — not something to trim by hand,
  # since the policy content itself is correct). Inline policies get a larger 10,240-byte
  # limit, which fits.
  enable_inline_policy = true

  # Pod Identity, not IRSA — the module's current recommended mechanism for granting the
  # Karpenter controller pod its AWS permissions (EC2 fleet management, pricing lookups,
  # SQS interruption queue). Functionally the same purpose the roadmap's "IRSA for
  # pod-level AWS permissions" line calls for; IRSA itself is still what workload pods
  # would use if the app needed direct AWS API access (it doesn't yet).
  create_pod_identity_association = true

  node_iam_role_use_name_prefix = false
  node_iam_role_name            = "${var.project}-karpenter-node"
  node_iam_role_additional_policies = {
    AmazonSSMManagedInstanceCore = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }

  tags = {
    Project   = var.project
    ManagedBy = "terraform"
    Stack     = "ephemeral"
  }
}

# Karpenter ships only as an OCI Helm chart (public.ecr.aws) — no traditional
# repo/index.yaml alternative exists. The `helm_release` resource's own OCI login (via
# `repository`/`repository_username`/`repository_password`, the documented pattern)
# fails on this machine with "OCI Registry Login Failed ... The stub received bad
# data." — a Windows-specific bug in the Terraform Helm provider's OCI credential
# storage (same family of issue as docker/for-win#13591), unrelated to the AWS
# credentials themselves; `aws_ecrpublic_authorization_token` and the login attempt
# both succeed right up to that storage step. The `helm` CLI's own OCI client doesn't
# hit it, so the chart is pulled once via `helm pull oci://public.ecr.aws/karpenter/karpenter
# --version 1.6.0` into `charts/karpenter-1.6.0.tgz` (committed — small, deterministic,
# pinned to the same version) and referenced as a local chart instead, which sidesteps
# the provider's OCI-login path entirely.
resource "helm_release" "karpenter" {
  namespace = "kube-system"
  name      = "karpenter"
  chart     = "${path.module}/charts/karpenter-1.6.0.tgz"
  wait      = true
  timeout   = 600

  values = [<<-EOT
    nodeSelector:
      karpenter.sh/controller: 'true'
    settings:
      clusterName: ${module.eks.cluster_name}
      clusterEndpoint: ${module.eks.cluster_endpoint}
      interruptionQueue: ${module.karpenter.queue_name}
    webhook:
      enabled: false
  EOT
  ]

  depends_on = [module.eks, module.karpenter]
}
