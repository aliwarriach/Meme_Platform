# C1 (EKS) reads the persistent stack's VPC/subnets/security group via this data
# source rather than re-declaring them — e.g. `data.terraform_remote_state.persistent.outputs.vpc_id`.
data "terraform_remote_state" "persistent" {
  backend = "s3"
  config = {
    bucket = "meme-platform-tfstate-258032683838"
    key    = "persistent/terraform.tfstate"
    region = "us-east-1"
  }
}
