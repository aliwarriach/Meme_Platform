output "vpc_id" {
  value = aws_vpc.main.id
}

output "public_subnet_ids" {
  value = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  value = aws_subnet.private[*].id
}

output "app_access_security_group_id" {
  description = "Attach to the C1 EKS node group so nodes can reach RDS/ElastiCache"
  value       = aws_security_group.app_access.id
}

output "rds_endpoint" {
  value = aws_db_instance.postgres.endpoint
}

output "rds_master_user_secret_arn" {
  description = "Secrets Manager ARN holding the AWS-generated master password — B3 reads this to populate the K8s Secret"
  value       = aws_db_instance.postgres.master_user_secret[0].secret_arn
}

output "redis_endpoint" {
  value = aws_elasticache_cluster.redis.cache_nodes[0].address
}

output "ecr_repository_url" {
  value = aws_ecr_repository.api.repository_url
}
