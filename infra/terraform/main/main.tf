# ArchBoard production infrastructure, applied by GitHub Actions (.github/workflows/infra.yml).
#
#   archboard-ip       static external IPv4 (the DNS A records point here)
#   archboard-vm       e2-small, Ubuntu 24.04 LTS, 20 GB balanced disk, Shielded VM
#                      nginx + certbot on the host; API and Postgres in Docker (infra/vm/startup.sh)
#   firewall           80/443 from anywhere; 22 for the deploy user (SSH keys only)
#   snapshot schedule  daily disk snapshots, kept for 7 days

terraform {
  required_version = ">= 1.5"
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 8.10"
    }
  }
  backend "gcs" {
    prefix = "main"
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
  zone    = var.zone
}

locals {
  name = "archboard"
  tag  = "archboard-web"
}

resource "google_compute_address" "ip" {
  name         = "${local.name}-ip"
  region       = var.region
  address_type = "EXTERNAL"
  network_tier = "PREMIUM"
  description  = "Static IP for archboard.ashutoshdev.online"
}

resource "google_compute_firewall" "web" {
  name          = "${local.name}-allow-web"
  network       = "default"
  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.tag]
  allow {
    protocol = "tcp"
    ports    = ["80", "443"]
  }
}

# GitHub-hosted runners have no fixed IPs, so SSH is reachable; the image disables password
# login and the only authorised key is the deploy key.
resource "google_compute_firewall" "ssh" {
  name          = "${local.name}-allow-ssh"
  network       = "default"
  direction     = "INGRESS"
  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.tag]
  allow {
    protocol = "tcp"
    ports    = ["22"]
  }
}

resource "google_compute_resource_policy" "daily_snapshots" {
  name   = "${local.name}-daily-snapshots"
  region = var.region
  snapshot_schedule_policy {
    schedule {
      daily_schedule {
        days_in_cycle = 1
        start_time    = "21:00" # UTC, i.e. 02:30 in India
      }
    }
    retention_policy {
      max_retention_days    = 7
      on_source_disk_delete = "KEEP_AUTO_SNAPSHOTS"
    }
    snapshot_properties {
      storage_locations = [var.region]
    }
  }
}

resource "google_compute_instance" "vm" {
  name                      = "${local.name}-vm"
  machine_type              = var.machine_type
  zone                      = var.zone
  tags                      = [local.tag]
  allow_stopping_for_update = true
  deletion_protection       = true

  boot_disk {
    auto_delete = false
    initialize_params {
      image = "ubuntu-os-cloud/ubuntu-2404-lts-amd64"
      size  = var.disk_gb
      type  = "pd-balanced"
    }
  }

  network_interface {
    network = "default"
    access_config {
      nat_ip       = google_compute_address.ip.address
      network_tier = "PREMIUM"
    }
  }

  metadata = {
    startup-script  = file("${path.module}/../../vm/startup.sh")
    nginx-site      = file("${path.module}/../../nginx/archboard.conf")
    nginx-bootstrap = file("${path.module}/../../nginx/bootstrap.conf")
    nginx-headers   = file("${path.module}/../../nginx/security-headers.conf")
  }

  service_account {
    email = var.vm_service_account
    scopes = [
      "https://www.googleapis.com/auth/logging.write",
      "https://www.googleapis.com/auth/monitoring.write",
    ]
  }

  shielded_instance_config {
    enable_secure_boot          = true
    enable_vtpm                 = true
    enable_integrity_monitoring = true
  }

  scheduling {
    automatic_restart   = true
    on_host_maintenance = "MIGRATE"
    preemptible         = false
  }

  labels = {
    app = local.name
    env = "production"
  }

  lifecycle {
    # A newer Ubuntu image must never recreate the VM (and wipe the database).
    ignore_changes = [boot_disk[0].initialize_params[0].image]
  }
}

resource "google_compute_disk_resource_policy_attachment" "snapshots" {
  name = google_compute_resource_policy.daily_snapshots.name
  disk = google_compute_instance.vm.name
  zone = var.zone
}
