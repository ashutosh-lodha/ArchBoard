# Bootstrap: run once by the project owner from Cloud Shell (see infra/terraform/README.md).
# Creates what CI needs to run the main Terraform layer keylessly:
#   - the APIs the project uses
#   - a service account for the VM (write logs and metrics, nothing else)
#   - Workload Identity Federation, so GitHub Actions in ONE repository can act as a
#     least-privilege Terraform service account with no JSON key anywhere
# The state bucket itself is created by bootstrap.sh before this runs.

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
  backend "gcs" {
    prefix = "bootstrap"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

variable "project_id" {
  type        = string
  description = "GCP project id for ArchBoard."
}

variable "region" {
  type    = string
  default = "asia-south1"
}

variable "github_repository" {
  type        = string
  description = "owner/name of the only GitHub repository allowed to deploy."
  default     = "ashutosh-lodha/ArchBoard"
}

variable "state_bucket" {
  type        = string
  description = "GCS bucket holding Terraform state (created by bootstrap.sh)."
}

locals {
  services = [
    "compute.googleapis.com",
    "iam.googleapis.com",
    "iamcredentials.googleapis.com",
    "sts.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ]
  # What CI's Terraform may do: manage Compute Engine (VM, IP, firewall, snapshots) and read
  # project IAM while planning. It cannot grant itself or anyone else new roles.
  ci_roles = [
    "roles/compute.admin",
    "roles/iam.securityReviewer",
  ]
}

resource "google_project_service" "services" {
  for_each           = toset(local.services)
  service            = each.value
  disable_on_destroy = false
}

# --- VM identity ----------------------------------------------------------------------------
resource "google_service_account" "vm" {
  account_id   = "archboard-vm"
  display_name = "ArchBoard VM"
  depends_on   = [google_project_service.services]
}

resource "google_project_iam_member" "vm" {
  for_each = toset(["roles/logging.logWriter", "roles/monitoring.metricWriter"])
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.vm.email}"
}

# --- CI identity (GitHub Actions via Workload Identity Federation) -------------------------
resource "google_service_account" "ci" {
  account_id   = "github-terraform"
  display_name = "GitHub Actions: Terraform"
  depends_on   = [google_project_service.services]
}

resource "google_project_iam_member" "ci" {
  for_each = toset(local.ci_roles)
  project  = var.project_id
  role     = each.value
  member   = "serviceAccount:${google_service_account.ci.email}"
}

# CI may attach the VM service account to the instance it manages, and nothing more.
resource "google_service_account_iam_member" "ci_uses_vm_sa" {
  service_account_id = google_service_account.vm.name
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.ci.email}"
}

# CI may read and write Terraform state.
resource "google_storage_bucket_iam_member" "ci_state" {
  bucket = var.state_bucket
  role   = "roles/storage.objectUser"
  member = "serviceAccount:${google_service_account.ci.email}"
}

resource "google_iam_workload_identity_pool" "github" {
  workload_identity_pool_id = "github"
  display_name              = "GitHub Actions"
  depends_on                = [google_project_service.services]
}

resource "google_iam_workload_identity_pool_provider" "github" {
  workload_identity_pool_id          = google_iam_workload_identity_pool.github.workload_identity_pool_id
  workload_identity_pool_provider_id = "github-oidc"
  display_name                       = "GitHub OIDC"
  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.repository" = "assertion.repository"
    "attribute.ref"        = "assertion.ref"
  }
  # Tokens from any other repository are rejected outright.
  attribute_condition = "assertion.repository == \"${var.github_repository}\""
  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }
}

resource "google_service_account_iam_member" "ci_wif" {
  service_account_id = google_service_account.ci.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github.name}/attribute.repository/${var.github_repository}"
}

output "vm_service_account" {
  value = google_service_account.vm.email
}

output "ci_service_account" {
  value = google_service_account.ci.email
}

output "workload_identity_provider" {
  value = google_iam_workload_identity_pool_provider.github.name
}
