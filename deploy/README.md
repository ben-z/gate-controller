# Gate Controller deployment

The application repository owns its Kubernetes workload. After checks pass, it
publishes `sha-<commit>` image tags and deploys the resolved multi-architecture
manifest digest.

## One-time bootstrap

The shared AKS cluster must first have Microsoft Entra control-plane
authentication enabled. The operator running bootstrap must be able to deploy
Azure resources, assign roles, invoke AKS commands, read the source Key Vault,
and administer the GitHub repository.

```sh
az bicep install
./deploy/bootstrap/bootstrap.sh
```

Bootstrap creates two secretless federated identities:

- a GitHub Actions identity with AKS Cluster User access and a namespace-scoped
  Kubernetes RoleBinding;
- an AKS workload identity that can read only the application's dedicated Key
  Vault.

It copies the existing encrypted secret backups into the dedicated vault and
sets non-secret variables on the GitHub `production` environment. That
environment accepts deployments from `master` and operator-created `rollback/*`
branches. Existing secrets in the shared vault are retained for rollback.

## Continuous deployment

`Cloud V3 Checks` runs on every pull request and default-branch push. A
successful `master` push triggers the image workflow, which builds the two
architectures, publishes the immutable manifest, deploys it, waits for the
rollout, confirms the exact live image, and probes the login page.

## Manual rollback

List successful automatic production deployments and select the full commit SHA
to restore:

```sh
gh run list \
  --repo ben-z/gate-controller \
  --workflow "Publish and deploy Cloud V3" \
  --event workflow_run \
  --status success \
  --limit 10 \
  --json databaseId,headSha,createdAt
```

Create a temporary rollback branch at that commit:

```sh
git push origin <full-40-character-sha>:refs/heads/rollback/<name>
```

In GitHub Actions, open **Publish and deploy Cloud V3**, choose **Run workflow**,
select that branch under **Use workflow from**, and run it. The selected commit's
workflow builds and deploys the code and deployment strategy bundled together at
that commit. The production environment rejects branches outside `master` and
`rollback/*`.

After the rollback succeeds, delete the temporary branch:

```sh
git push origin --delete rollback/<name>
```
