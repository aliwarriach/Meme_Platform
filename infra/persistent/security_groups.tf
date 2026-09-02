# Attached to EKS nodes in C1 (via the node group's `vpc_security_group_ids`). Carries
# no ingress rules of its own — it exists so RDS/ElastiCache can name it as their one
# allowed source, decoupling "who's allowed to reach the database" from "what EKS
# node-group config C1 happens to choose."
resource "aws_security_group" "app_access" {
  name        = "${var.project}-app-access"
  description = "Attached to compute that needs to reach RDS/ElastiCache (EKS nodes, C1)"
  vpc_id      = aws_vpc.main.id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-app-access" }
}

resource "aws_security_group" "rds" {
  name        = "${var.project}-rds"
  description = "Postgres - ingress only from app_access"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Postgres from app_access"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.app_access.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-rds" }
}

resource "aws_security_group" "redis" {
  name        = "${var.project}-redis"
  description = "ElastiCache Redis - ingress only from app_access"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "Redis from app_access"
    from_port       = 6379
    to_port         = 6379
    protocol        = "tcp"
    security_groups = [aws_security_group.app_access.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "${var.project}-redis" }
}
