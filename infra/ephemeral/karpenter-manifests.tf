# Roadmap_Scaling.md C1 — the actual scaling policy. EC2NodeClass says *how* a node
# looks (AMI, IAM role, which subnets/security groups); NodePool says *when* Karpenter
# is allowed to create one and what it costs to keep.
resource "kubectl_manifest" "karpenter_node_class" {
  yaml_body = <<-YAML
    apiVersion: karpenter.k8s.aws/v1
    kind: EC2NodeClass
    metadata:
      name: default
    spec:
      amiSelectorTerms:
        - alias: bottlerocket@latest
      role: ${var.project}-karpenter-node
      subnetSelectorTerms:
        - tags:
            karpenter.sh/discovery: ${module.eks.cluster_name}
      # Two terms, unioned: the cluster's own node SG (tag-matched, standard cluster
      # traffic) plus app_access explicitly by id — the one RDS/ElastiCache actually
      # allow ingress from. Same gap as the managed node group above; Karpenter-launched
      # nodes need it too or every pod on them times out reaching the database.
      securityGroupSelectorTerms:
        - tags:
            karpenter.sh/discovery: ${module.eks.cluster_name}
        - id: ${data.terraform_remote_state.persistent.outputs.app_access_security_group_id}
      tags:
        karpenter.sh/discovery: ${module.eks.cluster_name}
  YAML

  depends_on = [helm_release.karpenter]
}

# Spot-first (§1 locked decision + C1 IMPLEMENT): tried before the on-demand fallback
# below because NodePool `weight` is Karpenter's own tie-break for which pool it
# schedules a pending pod against first, when more than one pool could satisfy it.
resource "kubectl_manifest" "karpenter_node_pool_spot" {
  yaml_body = <<-YAML
    apiVersion: karpenter.sh/v1
    kind: NodePool
    metadata:
      name: spot
    spec:
      weight: 100
      template:
        spec:
          nodeClassRef:
            group: karpenter.k8s.aws
            kind: EC2NodeClass
            name: default
          requirements:
            - key: "karpenter.sh/capacity-type"
              operator: In
              values: ["spot"]
            # This AWS account is restricted to free-tier-eligible instance types only
            # (`aws ec2 describe-instance-types --filters Name=free-tier-eligible,Values=true`
            # confirmed live 2026-08-25) — CreateFleet 400s with InvalidParameterCombination
            # for anything else, discovered when the family+cpu-count requirements below
            # let Karpenter pick t3.xlarge for a 3-vCPU test pod. Explicit instance-type
            # values (not family/cpu ranges) is the only way to guarantee every node this
            # NodePool ever launches stays inside that restriction. Revisit once the
            # account ages out of it (matches §1.1's own "2× t3.small" plan either way).
            - key: "node.kubernetes.io/instance-type"
              operator: In
              values: ["t3.micro", "t3.small"]
      limits:
        cpu: 32
      disruption:
        consolidationPolicy: WhenEmptyOrUnderutilized
        consolidateAfter: 30s
  YAML

  depends_on = [kubectl_manifest.karpenter_node_class]
}

# Only reached when spot capacity genuinely isn't available (AWS can reclaim spot with
# 2 minutes' notice — A3's graceful shutdown + Karpenter's own draining makes that
# invisible to users, but a NodePool to fall back to is still what "spot-first" implies).
resource "kubectl_manifest" "karpenter_node_pool_on_demand" {
  yaml_body = <<-YAML
    apiVersion: karpenter.sh/v1
    kind: NodePool
    metadata:
      name: on-demand-fallback
    spec:
      weight: 1
      template:
        spec:
          nodeClassRef:
            group: karpenter.k8s.aws
            kind: EC2NodeClass
            name: default
          requirements:
            - key: "karpenter.sh/capacity-type"
              operator: In
              values: ["on-demand"]
            # Same free-tier-eligible-only restriction as the spot pool above.
            - key: "node.kubernetes.io/instance-type"
              operator: In
              values: ["t3.micro", "t3.small"]
      limits:
        cpu: 8
      disruption:
        consolidationPolicy: WhenEmptyOrUnderutilized
        consolidateAfter: 30s
  YAML

  depends_on = [kubectl_manifest.karpenter_node_class]
}
