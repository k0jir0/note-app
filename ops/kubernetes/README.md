# Immutable Kubernetes Stack

This directory contains the Kubernetes deployment path for the non-persistent environment requirement. The stack keeps the same public-proxy and internal-app split used by `docker-compose.sandbox.yml`, but adds rolling-update Deployments, ingress isolation, and a scheduled forced recycle of the running pods every 24 hours.

## What the manifest does

- Creates a dedicated `note-app` namespace.
- Deploys the internal `note-app` service as a 3-replica rolling Deployment.
- Deploys an internal ephemeral MongoDB service for local verification and non-persistent data rotation.
- Deploys the public `note-app-proxy` service as a 2-replica rolling Deployment that fronts the app service, exposed locally through NodePort `30080`.
- Applies default-deny ingress controls, then opens only the proxy-to-app and app-to-Mongo paths.
- Creates RBAC plus a daily CronJob that runs `kubectl rollout restart` against both Deployments.

## Required operator changes

Before you apply `immutable-stack.yaml`, confirm these values still match your target environment:

- `note-app:hardened` is the current local image reference used for the kind cluster. Because kind consumes the image from the local Docker daemon, the manifest sets `imagePullPolicy: Never` and expects you to preload that image into the cluster.
- `http://localhost:3002` is the current base URL baked into the ConfigMap for the local kind entry point.
- The manifest now provides `MONGODB_URI` internally, so `note-app-secrets` must include at minimum `SESSION_SECRET` and `NOTE_ENCRYPTION_KEY`.

## Apply and rotate

```bash
kubectl create namespace note-app
kubectl create secret generic note-app-secrets -n note-app \
  --from-literal=SESSION_SECRET='replace-with-long-random-secret' \
  --from-literal=NOTE_ENCRYPTION_KEY='replace-with-64-char-hex-key'
kubectl apply -f ops/kubernetes/immutable-stack.yaml
kubectl get cronjob,pods,svc -n note-app
kubectl rollout restart deployment/note-app deployment/note-app-proxy -n note-app
```

The scheduled CronJob runs at `03:00` cluster time each day. If the cluster uses a different local time zone expectation, adjust the cron expression to match your maintenance window.