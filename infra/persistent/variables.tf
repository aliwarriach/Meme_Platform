variable "aws_region" {
  type    = string
  default = "us-east-1"
}

variable "project" {
  type    = string
  default = "meme-platform"
}

variable "vpc_cidr" {
  type    = string
  default = "10.0.0.0/16"
}

# §1.2 of Roadmap_Scaling.md: no NAT Gateway. Public subnets hold the (future, C1)
# EKS nodes directly — tight security groups substitute for network isolation.
variable "public_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.0.0/24", "10.0.1.0/24"]
}

# RDS/ElastiCache live here — reachable only from the node security group
# (`app_access`, security_groups.tf), never from the public internet.
variable "private_subnet_cidrs" {
  type    = list(string)
  default = ["10.0.10.0/24", "10.0.11.0/24"]
}

variable "db_name" {
  type    = string
  default = "memeplatform"
}

variable "db_username" {
  type    = string
  default = "memeplatform_admin"
}
