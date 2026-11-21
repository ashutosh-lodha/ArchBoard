#!/usr/bin/env bash
# One-time setup, run by the project owner in Google Cloud Shell from a clone of the repository:
#   bash infra/terraform/bootstrap.sh <project-id>
# 1. creates a versioned, private GCS bucket for Terraform state
# 2. applies the bootstrap layer (APIs, service accounts, GitHub Workload Identity Federation)
# 3. applies the main layer once (static IP, firewall, VM, snapshots); CI owns it from then on
# 4. prints the GitHub repository variables to set
set -euo pipefail

PROJECT="${1:?usage: bootstrap.sh <project-id>}"
REGION=asia-south1
BUCKET="${PROJECT}-tfstate"
HERE="$(cd "$(dirname "$0")" && pwd)"

# Cloud Shell doesn't always ship Terraform: install the pinned version, checksum-verified.
TF_VERSION=1.14.8
if ! command -v terraform >/dev/null 2>&1 || ! terraform version | grep -q "v$TF_VERSION"; then
  BIN="$HOME/.local/bin"
  TMP="$(mktemp -d)"
  mkdir -p "$BIN"
  base="https://releases.hashicorp.com/terraform/$TF_VERSION"
  curl -fsSLo "$TMP/terraform_${TF_VERSION}_linux_amd64.zip" "$base/terraform_${TF_VERSION}_linux_amd64.zip"
  curl -fsSLo "$TMP/SHA256SUMS" "$base/terraform_${TF_VERSION}_SHA256SUMS"
  (cd "$TMP" && grep "linux_amd64.zip" SHA256SUMS | sha256sum -c -)
  unzip -o -q "$TMP/terraform_${TF_VERSION}_linux_amd64.zip" -d "$BIN"
  export PATH="$BIN:$PATH"
fi
terraform version | head -n 1

gcloud config set project "$PROJECT" >/dev/null
gcloud services enable storage.googleapis.com compute.googleapis.com iam.googleapis.com \
  cloudresourcemanager.googleapis.com

if ! gcloud storage buckets describe "gs://$BUCKET" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://$BUCKET" --location="$REGION" \
    --uniform-bucket-level-access --public-access-prevention
fi
gcloud storage buckets update "gs://$BUCKET" --versioning >/dev/null

echo "== bootstrap layer"
terraform -chdir="$HERE/bootstrap" init -input=false -reconfigure -backend-config="bucket=$BUCKET"
terraform -chdir="$HERE/bootstrap" apply -input=false -auto-approve \
  -var "project_id=$PROJECT" -var "state_bucket=$BUCKET"
VM_SA="$(terraform -chdir="$HERE/bootstrap" output -raw vm_service_account)"
CI_SA="$(terraform -chdir="$HERE/bootstrap" output -raw ci_service_account)"
WIF="$(terraform -chdir="$HERE/bootstrap" output -raw workload_identity_provider)"

echo "== main layer"
terraform -chdir="$HERE/main" init -input=false -reconfigure -backend-config="bucket=$BUCKET"
terraform -chdir="$HERE/main" apply -input=false -auto-approve \
  -var "project_id=$PROJECT" -var "vm_service_account=$VM_SA"
IP="$(terraform -chdir="$HERE/main" output -raw static_ip)"

cat <<EOF

Done. Static IP: $IP
Point DNS A records for archboard and www.archboard at $IP, then set these GitHub variables:
  gh variable set GCP_PROJECT_ID --body "$PROJECT"
  gh variable set GCP_WIF_PROVIDER --body "$WIF"
  gh variable set GCP_TF_SERVICE_ACCOUNT --body "$CI_SA"
  gh variable set GCP_VM_SERVICE_ACCOUNT --body "$VM_SA"
  gh variable set TF_STATE_BUCKET --body "$BUCKET"
  gh variable set VM_HOST --body "$IP"
EOF
