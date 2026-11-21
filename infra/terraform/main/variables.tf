variable "project_id" {
  type        = string
  description = "GCP project id for ArchBoard."
}

variable "region" {
  type    = string
  default = "asia-south1" # Mumbai: closest to the expected visitors
}

variable "zone" {
  type    = string
  default = "asia-south1-a"
}

variable "machine_type" {
  type        = string
  description = "e2-small (2 vCPU burst, 2 GB): nginx, the API and Postgres, with headroom."
  default     = "e2-small"
}

variable "disk_gb" {
  type    = number
  default = 20
}

variable "vm_service_account" {
  type        = string
  description = "Service account the VM runs as (an output of the bootstrap layer)."
}
