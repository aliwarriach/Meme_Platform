resource "aws_elasticache_subnet_group" "main" {
  name       = "${var.project}-cache-subnets"
  subnet_ids = aws_subnet.private[*].id
}

resource "aws_elasticache_cluster" "redis" {
  cluster_id      = "${var.project}-redis"
  engine          = "redis"
  engine_version  = "7.1"
  node_type       = "cache.t4g.micro" # free-tier sized, B1 Findings confirmed eligible
  num_cache_nodes = 1
  port            = 6379

  subnet_group_name  = aws_elasticache_subnet_group.main.name
  security_group_ids = [aws_security_group.redis.id]

  # Single node, no automatic failover — matches the RDS single-AZ decision (§1.2).
  # Redis here also carries the arq job queue and WS pub/sub/presence (redis-arq-infra.md),
  # not just cache — a node loss drops in-flight jobs and live socket presence, but
  # Postgres stays the system of record (leaderboards/scores are worker-recomputed,
  # sessions are stateless JWT — §2.1), so this is an acceptable risk at this scale.
  apply_immediately = true

  tags = { Name = "${var.project}-redis" }
}
