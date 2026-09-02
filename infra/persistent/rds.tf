resource "aws_db_subnet_group" "main" {
  name       = "${var.project}-db-subnets"
  subnet_ids = aws_subnet.private[*].id
  tags       = { Name = "${var.project}-db-subnets" }
}

resource "aws_db_instance" "postgres" {
  identifier     = "${var.project}-postgres"
  engine         = "postgres"
  engine_version = "16.14" # newest 16.x available in us-east-1 as of 2026-08-25 (`aws rds describe-db-engine-versions`)

  # Free-tier sized (B1 Findings: RDS free tier confirmed eligible for 12 months from
  # account creation 2026-08-24).
  instance_class    = "db.t4g.micro"
  allocated_storage = 20
  storage_type      = "gp2"
  storage_encrypted = true

  db_name  = var.db_name
  username = var.db_username
  # AWS-managed master password (RDS generates it and stores it in Secrets Manager) —
  # never a Terraform-supplied plaintext password sitting in state or a .tfvars file.
  # B3 reads it via `aws_db_instance.postgres.master_user_secret[0].secret_arn` to
  # populate the K8s Secret.
  manage_master_user_password = true

  # §1.2: single AZ (Multi-AZ deferred — doubles DB cost, this project doesn't have a
  # revenue-driven uptime requirement yet). Automated backups substitute.
  # backup_retention_period capped at 1: this AWS account is still under free-tier
  # promotional restrictions (`FreeTierRestrictionError` rejected the originally-planned
  # 7 on a live apply, 2026-08-25) — revisit once the account ages out of that tier.
  multi_az                = false
  backup_retention_period = 1
  backup_window           = "07:00-08:00" # UTC, low-traffic window for a project with no real users yet

  vpc_security_group_ids = [aws_security_group.rds.id]
  db_subnet_group_name   = aws_db_subnet_group.main.name
  publicly_accessible    = false

  # This is the persistent stack — it holds real data and must never be an accidental
  # casualty of an `infra/ephemeral` destroy habit. `deletion_protection` is the rail
  # against a wrong-directory `terraform destroy`; `skip_final_snapshot = false` is the
  # rail against a deliberate-but-mistaken one.
  deletion_protection       = true
  skip_final_snapshot       = false
  final_snapshot_identifier = "${var.project}-postgres-final"

  tags = { Name = "${var.project}-postgres" }
}
