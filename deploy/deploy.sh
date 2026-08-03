#!/usr/bin/env bash
set -euo pipefail

readonly APP_NAME="gate-controller-cloud-v3"
readonly APP_NAMESPACE="gate-controller-cloud-v3"
readonly UUID_PATTERN='^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$'
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
readonly SCRIPT_DIR
readonly MANIFEST="$SCRIPT_DIR/kubernetes/application.yaml"

require_variable() {
  local task_name="$1"
  if [[ -z "${!task_name:-}" ]]; then
    echo "Missing required environment variable: $task_name" >&2
    exit 1
  fi
}

for task_command in curl jq kubectl sed; do
  if ! command -v "$task_command" >/dev/null 2>&1; then
    echo "Missing required command: $task_command" >&2
    exit 1
  fi
done

for task_variable in \
  IMAGE \
  SOURCE_SHA \
  AZURE_TENANT_ID \
  GATE_CONTROLLER_KEY_VAULT_NAME \
  GATE_CONTROLLER_SECRET_IDENTITY_CLIENT_ID \
  GATE_CONTROLLER_URL; do
  require_variable "$task_variable"
done

if [[ ! "$IMAGE" =~ ^ghcr\.io/ben-z/gate-controller/cloud-v3@sha256:[0-9a-f]{64}$ ]]; then
  echo "IMAGE must be an immutable gate-controller digest." >&2
  exit 1
fi

if [[ ! "$SOURCE_SHA" =~ ^[0-9a-f]{40}$ ]]; then
  echo "SOURCE_SHA must be a full lowercase Git commit SHA." >&2
  exit 1
fi

if [[ ! "$AZURE_TENANT_ID" =~ $UUID_PATTERN ]]; then
  echo "AZURE_TENANT_ID must be a UUID." >&2
  exit 1
fi

if [[ ! "$GATE_CONTROLLER_SECRET_IDENTITY_CLIENT_ID" =~ $UUID_PATTERN ]]; then
  echo "GATE_CONTROLLER_SECRET_IDENTITY_CLIENT_ID must be a UUID." >&2
  exit 1
fi

if [[ ! "$GATE_CONTROLLER_KEY_VAULT_NAME" =~ ^[a-zA-Z][a-zA-Z0-9-]{1,22}[a-zA-Z0-9]$ ]] ||
  [[ "$GATE_CONTROLLER_KEY_VAULT_NAME" == *--* ]]; then
  echo "GATE_CONTROLLER_KEY_VAULT_NAME is invalid." >&2
  exit 1
fi

if [[ ! "$GATE_CONTROLLER_URL" =~ ^https://[a-zA-Z0-9.-]+$ ]]; then
  echo "GATE_CONTROLLER_URL must be an HTTPS origin without a path." >&2
  exit 1
fi

task_rendered_manifest="$(mktemp "${TMPDIR:-/tmp}/gate-controller-manifest.XXXXXX")"
cleanup() {
  rm -f -- "$task_rendered_manifest"
}
trap cleanup EXIT

sed \
  -e "s|__IMAGE__|$IMAGE|g" \
  -e "s|__AZURE_TENANT_ID__|$AZURE_TENANT_ID|g" \
  -e "s|__KEY_VAULT_NAME__|$GATE_CONTROLLER_KEY_VAULT_NAME|g" \
  -e "s|__SECRET_IDENTITY_CLIENT_ID__|$GATE_CONTROLLER_SECRET_IDENTITY_CLIENT_ID|g" \
  "$MANIFEST" > "$task_rendered_manifest"

if grep -q '__[A-Z_]*__' "$task_rendered_manifest"; then
  echo "Rendered manifest still contains unresolved placeholders." >&2
  exit 1
fi

kubectl apply \
  --server-side \
  --force-conflicts \
  --field-manager=gate-controller-cd \
  -f "$task_rendered_manifest"

kubectl \
  --namespace "$APP_NAMESPACE" \
  patch secretproviderclass "$APP_NAME" \
  --type=merge \
  --patch '{"spec":{"parameters":{"userAssignedIdentityID":null}}}'

kubectl \
  --namespace "$APP_NAMESPACE" \
  rollout status "deployment/$APP_NAME" \
  --timeout=10m

task_live_image="$(kubectl \
  --namespace "$APP_NAMESPACE" \
  get "deployment/$APP_NAME" \
  -o jsonpath='{.spec.template.spec.containers[?(@.name=="gate-controller-cloud-v3")].image}')"

if [[ "$task_live_image" != "$IMAGE" ]]; then
  echo "Live image mismatch: expected $IMAGE, got $task_live_image" >&2
  exit 1
fi

task_live_version=""
for task_attempt in {1..12}; do
  if task_version_response="$(curl \
    --fail \
    --location \
    --max-time 10 \
    --silent \
    "$GATE_CONTROLLER_URL/api/version" 2>/dev/null)"; then
    task_live_version="$(jq -er '.version | select(type == "string")' \
      <<<"$task_version_response" 2>/dev/null || true)"
    if [[ "$task_live_version" == "$SOURCE_SHA" ]]; then
      break
    fi
  fi

  echo "Waiting for application version $SOURCE_SHA (attempt $task_attempt/12, got ${task_live_version:-no valid response})."
  sleep 5
done

if [[ "$task_live_version" != "$SOURCE_SHA" ]]; then
  echo "Live application version mismatch: expected $SOURCE_SHA, got ${task_live_version:-no valid response}." >&2
  exit 1
fi

echo "Deployed and verified $IMAGE at application version $SOURCE_SHA"
