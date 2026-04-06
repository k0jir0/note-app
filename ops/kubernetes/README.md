# Immutable Kubernetes Stack

This directory contains the Kubernetes deployment path for the non-persistent environment requirement. The stack keeps the same public-proxy and internal-app split used by `docker-compose.sandbox.yml`, but adds rolling-update Deployments, ingress isolation, and a scheduled forced recycle of the running pods every 24 hours.

## What the manifest does

- Creates a dedicated `helios` namespace.
- Deploys the internal `helios` service as a 3-replica rolling Deployment.
- Deploys an internal ephemeral MongoDB service for local verification and non-persistent data rotation.
- Deploys the public `helios-proxy` service as a 2-replica rolling Deployment that fronts the app service, exposed locally through NodePort `30080`.
- Applies default-deny ingress controls, then opens only the proxy-to-app and app-to-Mongo paths.
- Creates RBAC plus a daily CronJob that runs `kubectl rollout restart` against both Deployments.

## Required operator changes

Before you apply `immutable-stack.yaml`, confirm these values still match your target environment:

- `helios:hardened` is the current local image reference used for the kind cluster. Because kind consumes the image from the local Docker daemon, the manifest sets `imagePullPolicy: Never` and expects you to preload that image into the cluster.
- The support images are pinned to immutable `linux/amd64` digests for reproducible local kind runs. If you intentionally move to a different architecture or upstream support-image version, refresh the pinned digests before applying the manifest.
- `http://localhost:3002` is the current base URL baked into the ConfigMap for the local kind entry point.
- The manifest now provides `MONGODB_URI` internally, so `helios-secrets` must include at minimum `SESSION_SECRET` and `NOTE_ENCRYPTION_KEY`.

## Refreshing pinned support images

Use Docker's manifest metadata to update the pinned `mongo` and `nginx` references when you change upstream versions or cluster architecture:

```powershell
$mongo = docker manifest inspect mongo:7 --verbose | ConvertFrom-Json
$mongo | Where-Object { $_.Descriptor.platform.os -eq 'linux' -and $_.Descriptor.platform.architecture -eq 'amd64' } | Select-Object -First 1 -ExpandProperty Ref

$nginx = docker manifest inspect nginx:1.27-alpine --verbose | ConvertFrom-Json
$nginx | Where-Object { $_.Descriptor.platform.os -eq 'linux' -and $_.Descriptor.platform.architecture -eq 'amd64' } | Select-Object -First 1 -ExpandProperty Ref
```

The repository also includes `.github/workflows/itsg33-k8s-support-image-refresh.yml`, which refreshes these pinned support-image digests on a schedule and opens a pull request when upstream `linux/amd64` digests change. The manual commands above remain the fallback path.

## Apply and rotate

```bash
kubectl create namespace helios
kubectl create secret generic helios-secrets -n helios \
  --from-literal=SESSION_SECRET='replace-with-long-random-secret' \
  --from-literal=NOTE_ENCRYPTION_KEY='replace-with-64-char-hex-key'
kubectl apply -f ops/kubernetes/immutable-stack.yaml
kubectl get cronjob,pods,svc -n helios
kubectl rollout restart deployment/helios deployment/helios-proxy -n helios
```

The scheduled CronJob runs at `03:00` cluster time each day. If the cluster uses a different local time zone expectation, adjust the cron expression to match your maintenance window.