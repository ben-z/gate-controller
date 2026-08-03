#!/usr/bin/env bash
set -euo pipefail

readonly APP_NAMESPACE="gate-controller-cloud-v3"
readonly APP_SERVICE_ACCOUNT="gate-controller-cloud-v3"
readonly APP_URL="https://gate-controller-cloud-v3.benzhang.dev"
readonly AZURE_RESOURCE_GROUP="unicorns-aks-rg"
readonly AZURE_AKS_CLUSTER_NAME="unicorns-aks"
readonly GITHUB_REPOSITORY="ben-z/gate-controller"
readonly GITHUB_ENVIRONMENT="production"
readonly SOURCE_KEY_VAULT="unicornsftw-kv"
readonly SECRET_NAMES=(
  gate-controller-cloud-v3-initial-admin-credentials
  gate-controller-cloud-v3-agent-token
  gate-controller-cloud-v3-openai-api-key
)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR

for task_command in az gh jq sed; do
  if ! command -v "$task_command" >/dev/null 2>&1; then
    echo "Missing required command: $task_command" >&2
    exit 1
  fi
done

if ! az bicep version >/dev/null 2>&1; then
  echo "Missing Azure Bicep CLI. Run: az bicep install" >&2
  exit 1
fi

az bicep build --file "$SCRIPT_DIR/main.bicep" --stdout >/dev/null
task_repo_admin="$(gh api "repos/$GITHUB_REPOSITORY" --jq '.permissions.admin')"
if [[ "$task_repo_admin" != "true" ]]; then
  echo "GitHub authentication must have administrator access to $GITHUB_REPOSITORY." >&2
  exit 1
fi

task_subscription_id="$(az account show --query id -o tsv)"
task_tenant_id="$(az account show --query tenantId -o tsv)"
task_operator_id="$(az ad signed-in-user show --query id -o tsv)"
task_oidc_issuer="$(az aks show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_AKS_CLUSTER_NAME" \
  --query oidcIssuerProfile.issuerUrl \
  -o tsv)"
task_aad_managed="$(az aks show \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_AKS_CLUSTER_NAME" \
  --query aadProfile.managed \
  -o tsv)"

if [[ "$task_aad_managed" != "true" ]]; then
  echo "AKS Microsoft Entra integration must be enabled before bootstrapping application CI/CD." >&2
  exit 1
fi

if [[ -z "$task_oidc_issuer" ]]; then
  echo "AKS OIDC issuer is missing." >&2
  exit 1
fi

for task_secret_name in "${SECRET_NAMES[@]}"; do
  if ! az keyvault secret show \
    --vault-name "$SOURCE_KEY_VAULT" \
    --name "$task_secret_name" \
    --query id \
    -o tsv \
    --only-show-errors >/dev/null; then
    echo "Missing or unreadable source secret: $task_secret_name" >&2
    exit 1
  fi
done

task_outputs="$(az deployment group create \
  --name gate-controller-cloud-v3-bootstrap \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --template-file "$SCRIPT_DIR/main.bicep" \
  --parameters \
    aksName="$AZURE_AKS_CLUSTER_NAME" \
    aksOidcIssuerUrl="$task_oidc_issuer" \
    githubRepository="$GITHUB_REPOSITORY" \
    githubEnvironment="$GITHUB_ENVIRONMENT" \
    kubernetesNamespace="$APP_NAMESPACE" \
    kubernetesServiceAccount="$APP_SERVICE_ACCOUNT" \
    operatorObjectId="$task_operator_id" \
  --query properties.outputs \
  -o json)"

task_deployer_client_id="$(jq -er '.deployerClientId.value' <<<"$task_outputs")"
task_deployer_principal_id="$(jq -er '.deployerPrincipalId.value' <<<"$task_outputs")"
task_key_vault_name="$(jq -er '.keyVaultName.value' <<<"$task_outputs")"
task_secret_identity_client_id="$(jq -er '.secretIdentityClientId.value' <<<"$task_outputs")"

task_temp_dir="$(mktemp -d "${TMPDIR:-/tmp}/gate-controller-bootstrap.XXXXXX")"
cleanup() {
  rm -rf -- "$task_temp_dir"
}
trap cleanup EXIT

sed "s/__DEPLOYER_PRINCIPAL_ID__/$task_deployer_principal_id/g" \
  "$SCRIPT_DIR/namespace-rbac.yaml" > "$task_temp_dir/namespace-rbac.yaml"

az aks command invoke \
  --resource-group "$AZURE_RESOURCE_GROUP" \
  --name "$AZURE_AKS_CLUSTER_NAME" \
  --command 'kubectl apply -f namespace-rbac.yaml' \
  --file "$task_temp_dir/namespace-rbac.yaml" \
  --query logs \
  -o tsv

task_vault_ready=false
for _ in {1..18}; do
  if az keyvault secret list --vault-name "$task_key_vault_name" --maxresults 1 >/dev/null 2>&1; then
    task_vault_ready=true
    break
  fi
  sleep 10
done

if [[ "$task_vault_ready" != "true" ]]; then
  echo "Timed out waiting for Key Vault data-plane role propagation." >&2
  exit 1
fi

for task_secret_name in "${SECRET_NAMES[@]}"; do
  if az keyvault secret show \
    --vault-name "$task_key_vault_name" \
    --name "$task_secret_name" \
    --query id \
    -o tsv \
    --only-show-errors >/dev/null 2>&1; then
    echo "Destination secret already exists: $task_secret_name"
    continue
  fi

  task_backup_file="$task_temp_dir/$task_secret_name.backup"
  az keyvault secret backup \
    --vault-name "$SOURCE_KEY_VAULT" \
    --name "$task_secret_name" \
    --file "$task_backup_file" \
    --only-show-errors >/dev/null
  az keyvault secret restore \
    --vault-name "$task_key_vault_name" \
    --file "$task_backup_file" \
    --only-show-errors >/dev/null
done

gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "repos/$GITHUB_REPOSITORY/environments/$GITHUB_ENVIRONMENT" \
  --input - <<'JSON' >/dev/null
{
  "deployment_branch_policy": {
    "protected_branches": false,
    "custom_branch_policies": true
  }
}
JSON

task_branch_policy_count="$(gh api \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2026-03-10" \
  "repos/$GITHUB_REPOSITORY/environments/$GITHUB_ENVIRONMENT/deployment-branch-policies" \
  --jq '[.branch_policies[] | select(.name == "master" and .type == "branch")] | length')"

if [[ "$task_branch_policy_count" == "0" ]]; then
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    -H "X-GitHub-Api-Version: 2026-03-10" \
    "repos/$GITHUB_REPOSITORY/environments/$GITHUB_ENVIRONMENT/deployment-branch-policies" \
    -f name=master \
    -f type=branch \
    --silent
elif [[ "$task_branch_policy_count" != "1" ]]; then
  echo "Expected exactly one production deployment policy for master." >&2
  exit 1
fi

set_environment_variable() {
  local task_name="$1"
  local task_value="$2"
  gh variable set "$task_name" \
    --repo "$GITHUB_REPOSITORY" \
    --env "$GITHUB_ENVIRONMENT" \
    --body "$task_value"
}

set_environment_variable AZURE_CLIENT_ID "$task_deployer_client_id"
set_environment_variable AZURE_TENANT_ID "$task_tenant_id"
set_environment_variable AZURE_SUBSCRIPTION_ID "$task_subscription_id"
set_environment_variable AZURE_RESOURCE_GROUP "$AZURE_RESOURCE_GROUP"
set_environment_variable AZURE_AKS_CLUSTER_NAME "$AZURE_AKS_CLUSTER_NAME"
set_environment_variable GATE_CONTROLLER_KEY_VAULT_NAME "$task_key_vault_name"
set_environment_variable GATE_CONTROLLER_SECRET_IDENTITY_CLIENT_ID "$task_secret_identity_client_id"
set_environment_variable GATE_CONTROLLER_URL "$APP_URL"

echo "Gate controller deployment identity, namespace RBAC, dedicated Key Vault, and GitHub environment are configured."
