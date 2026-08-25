# One repo, one image — A6's "one image, three commands" decision. The api/realtime/
# worker Deployments (C2) all pull the same tag and differ only in their container
# command.
resource "aws_ecr_repository" "api" {
  name                 = "${var.project}/api"
  image_tag_mutability = "MUTABLE" # no CI/CD tagging convention (git SHA, etc.) exists yet — revisit once one does

  image_scanning_configuration {
    scan_on_push = true
  }

  tags = { Name = "${var.project}-ecr-api" }
}

# Untagged images (superseded digests from IMMUTABLE re-pushes under a new tag,
# or failed CI pushes) cost storage indefinitely with no automatic cleanup otherwise.
resource "aws_ecr_lifecycle_policy" "api" {
  repository = aws_ecr_repository.api.name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 14 days"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countUnit   = "days"
          countNumber = 14
        }
        action = { type = "expire" }
      }
    ]
  })
}
