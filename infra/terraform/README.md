# Infrastructure as code

All of ArchBoard's Google Cloud resources are defined here, in project `archboard-*`
(separate from every other project, so it has its own billing view and blast radius).

| Layer        | Who applies it                                                                             | What it manages                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| `bootstrap/` | The project owner, **once**, from Cloud Shell                                              | Project APIs, the VM's service account, a least-privilege Terraform service account for CI, and Workload Identity Federation for GitHub Actions |
| `main/`      | **GitHub Actions** (`.github/workflows/infra.yml`): plan on pull requests, apply on `main` | Static IP `archboard-ip`, firewall (80/443, 22), VM `archboard-vm` (e2-small, Ubuntu 24.04, Shielded VM), daily disk snapshots kept 7 days      |

State lives in a private, versioned GCS bucket (`<project>-tfstate`), split by layer prefix.

## Why two layers

CI should be able to change the VM, but never its own permissions. The bootstrap layer holds
everything security-sensitive (IAM, identity federation) and needs an owner to change. The main
layer holds everything that changes day to day, and CI's service account can only touch
Compute Engine (`roles/compute.admin`, plus `iam.serviceAccountUser` on the VM's account).

## Keyless CI

GitHub Actions requests a short-lived OIDC token, Google's Security Token Service exchanges it
for a one-hour access token, and only tokens whose `repository` claim is
`ashutosh-lodha/ArchBoard` are accepted. There's no service-account JSON key anywhere.

## First-time setup

In [Cloud Shell](https://shell.cloud.google.com), with the project selected:

```bash
git clone https://github.com/ashutosh-lodha/ArchBoard.git && cd ArchBoard
bash infra/terraform/bootstrap.sh <project-id>
```

The script prints the static IP and the `gh variable set …` commands for the repository.

## Day to day

Edit `main/`, open a pull request, read the plan in the workflow log, and merge to apply.
The VM has `deletion_protection` on and its boot disk survives instance replacement
(`auto_delete = false`), so a mistaken change can't silently destroy the database.
