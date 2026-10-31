---
id: Q-1521
kind: question
title: Shape B decisions after the Kubernetes research
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-1511
blocked_by:
  - Q-1516
  - Q-1517
topic: null
branch: null
created: 2026-10-31T14:35:39.678Z
updated: 2026-10-31T17:17:21.587Z
closed: 2026-10-31T17:17:21.587Z
---

## Question

Shape B decisions (map M-1511 round-1 decision 11), after the Kubernetes research: the distributable (Helm chart or kustomize, image build and publish in the release flow), the hub Deployment with its PVC and SQLite, agent hosts as pods created by the hub through the Kubernetes API or declared in the chart, Ingress and TLS, how the human reaches the hub (web, remotes, port-forward, the CLI), secrets, backups, the droplet executor from a cluster, and what of 0.4.x versus later. Grilling with the human.

## Comments

### human · 2026-10-31T17:17:21.458Z

## Resolution (round 6, 2026-10-31, all accepted by the human)

1. **Distributable.** One Helm chart `cland` in the repository (deploy/helm/), published with each release as an OCI artifact in GHCR beside the image ghcr.io/kealman/cland (multi-arch amd64+arm64; Node 24, Neovim for the project's tests and harnesses, Playwright Chromium, git, procps); chart values: image, PVC size, Ingress host, host pools, secret names. No kustomize.
2. **The hub in the cluster.** A one-replica StatefulSet, PVC RWO at /cland holding `.cland/`, HOME and the territory; readiness from `cland hub status`; the hub lock gains a host identity (hostname + boot id) and a heartbeat instead of the pid check; the droplet watchdog is re-armed by the hub on restart (as today) and may become a Job; `cland web` in a cluster prints the Ingress host from config; cookies get Secure under an https `[web] origin`.
3. **Agent pods.** A `kubernetes` host provider creates one pod per host (same image, the host agent as entrypoint, no systemd, no sidecar), a ServiceAccount with a Role on pods, pods/exec and pods/log in its namespace; transport `outbound` (the host agent connects to the hub's in-cluster Service) from the start for Kubernetes, `ssh` stays for VM providers; login disks are one PVC per login mounted into the pod.
4. **How the human reaches the hub.** The web through an Ingress with TLS (cert-manager, Let's Encrypt) and one-time links; Telegram and Discord as today; the Neovim workbench stays a LOCAL client: `cland attach-cluster <context>` holds a `kubectl port-forward` to a new optional loopback TCP listener of the hub's CLI protocol inside the pod and starts the human's local Neovim against it; the `cland` CLI from the Mac the same way; session attach through `kubectl exec -it`. Neovim is in the image only for the project's tests and harnesses, never as the human's workbench.
5. **Secrets and tests.** A Kubernetes Secret with secrets.toml (Telegram, Discord, ElevenLabs, key logins) and one with the DO token for the test droplets; the droplet executor runs from the cluster as today (egress to the DO API, SSH out); no in-cluster node-group executor in 0.4.x.
6. **Backup and upgrade.** PVC snapshots by the chart's schedule (VolumeSnapshot where the CSI supports it; a `cland backup` to object storage is deferred); `helm upgrade` with a new image is a hub restart (agent pods and tunnels survive); `cland update` runs from the pod.
7. **0.4.0 vs 0.4.x.** 0.4.0 carries only what shape A needs and B must not contradict: the StatefulSet-safe hub lock, PVC-safe HOME paths, Secure cookies, the transport layer with `ssh` only; 0.4.x: image, chart, `kubernetes` provider, `outbound` transport, `attach-cluster`, cluster install docs. First live run of B on DOKS (token and region exist), Hetzner when orderable.
