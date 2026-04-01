Terraform usage notes

- Do NOT commit `.terraform/` directories or provider binaries to git. These are runtime artifacts downloaded by `terraform init`.
- Do NOT commit `*.tfstate` or `*.tfstate.backup` files. Use a remote backend (S3/Dynamo/remote) for state.

Quick setup for developers:

1. Install Terraform (https://www.terraform.io/downloads).
2. From a module (e.g., `ops/terraform/rotation_lambda`) run:

```powershell
terraform init
```

3. Configure backend (S3) before running `apply` in production workflows.

CI example (GitHub Actions) snippet:

```yaml
- name: Setup Terraform
  uses: hashicorp/setup-terraform@v2
  with:
    terraform_version: '1.6.8'

- name: Terraform Init
  run: terraform init -input=false
```
