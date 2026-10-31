---
id: Q-1516
kind: question
title: "Shape B: the hub in Kubernetes, requirements and costs"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:38.240Z
updated: 2026-10-31T14:50:27.035Z
closed: 2026-10-31T14:50:27.035Z
---

## Question

What does shape B of map M-1511 (round-1 decision 11: the whole hub in Kubernetes, one replica, PVC for `.cland`, sessions as processes in agent-host pods, Ingress with TLS) require, and what does it cost on the cheapest managed and self-managed clusters?

Primary sources: Kubernetes docs (StatefulSet vs Deployment with a ReadWriteOnce PVC, `Recreate` strategy, PodDisruptionBudget, liveness/readiness, `emptyDir` with `medium: Memory` for credential tmpfs, Secrets and their encryption at rest, `kubectl exec`/`port-forward`, ephemeral containers), SQLite guidance on network and block storage (WAL on a PVC is fine on block storage, not on NFS), DOKS pricing and limits (control plane free, node pools, block storage, load balancer price), Hetzner + k3s (node prices, hcloud CCM/CSI, load balancer), GKE Autopilot pricing, cert-manager and ingress-nginx/Traefik for TLS, Helm vs kustomize for distributing a chart, container image build and publish (GitHub Container Registry, multi-arch), Node 24 base images, Playwright Chromium in a container for QA, Neovim in a container, running `git daemon` in-cluster vs a sidecar, egress needs (model APIs, GitHub, DigitalOcean API for droplet runs with the token from a Secret).

Answer: the minimal manifests set (hub Deployment with PVC, agent-host Deployment or Job per host with the host agent, Services, Ingress, Secrets, a ServiceAccount if the hub creates pods itself), whether the hub should create agent pods through the Kubernetes API as a host provider (round-1 decision 2) or a fixed pool should be declared in the chart, how the human reaches the hub (web with one-time links through the Ingress, Telegram/Discord outbound, `kubectl port-forward` for Neovim and the CLI), what `cland` CLI commands cannot work against a cluster hub, backup of the PVC, the monthly cost for a minimal cluster running the hub plus two small agent pods on each of DOKS, Hetzner k3s and GKE Autopilot, and what breaks in cland's assumptions (macOS-only code paths, `caffeinate`, `open`, file watching on PVCs, paths in hub.json, the 100-byte socket path).

Deliver docs/research/kubernetes-shape.md on branch research/kubernetes-shape with the cost table, the manifest outline, the list of hub changes, and "Rules for the spec".

## Comments

### human · 2026-10-31T14:50:26.553Z

## Resolution

Research note: docs/research/kubernetes-shape.md on branch research/kubernetes-shape (final b7f82197, pushed to origin only). Cost table, manifest outline, nine hub changes, 18 rules for the spec.

1. Shape B works with a handful of hub changes. Cheapest by far: k3s on one Hetzner CX33 (€8.99/month) with Traefik on the node IP, the PVC on the node's NVMe through local-path, no load balancer. Other options per month: CX43 €16.49 (room for 3–4 agent pods); CX33 + volume + LB11 €17.62; DOKS 1 × s-4vcpu-8gb + volume + DO load balancer $62; GKE Autopilot ≈ $141 always on, ≈ $80 with agents 176 h/month. ARM CAX21 (€10.99) is the fallback if x86 types stay "unavailable" and needs a multi-arch image.
2. Correction to round-1 decision 11: the hub is a one-replica StatefulSet, not a Deployment (a Deployment starts the replacement while the old pod is still Terminating; the docs point to a StatefulSet for at-most-one pods).
3. New hazard: the hub lock stores a pid and its ps start time; a second container cannot see that pid in its own PID namespace, would break a live lock, and two hubs would share one SQLite file; ReadWriteOnce still lets two pods on the same node mount the volume. The lock needs a host identity and a heartbeat.
4. The hub creates agent pods itself as a `kubernetes` host provider with a namespace Role on pods only; a fixed StatefulSet pool scales down from the highest ordinal regardless of live sessions, which breaks round-3 placement.
5. Transport stays as in shape A: SSH to the pod IP with the reverse tunnel and git daemon over the tunnel; no git sidecar, no Service for spokes.
6. The human reaches the hub through the web (links minted by `kubectl exec … cland web --qr`), Telegram and Discord outbound, and the CLI and Neovim through `kubectl exec`; `kubectl port-forward` reaches loopback TCP only, not the Unix socket every CLI command and the Neovim plugin use.
7. ingress-nginx was retired in March 2026 and is excluded; Traefik or another maintained controller with cert-manager.
8. Other breakages: the droplet watchdog dies with the hub container; session cookies behind TLS get no Secure flag (no Origin header on GET navigations); plain `cland web` prints a loopback link; the image needs procps (the lock calls ps); HOME must be on the PVC (the spend ledger lives there).
9. Not found: DOKS allocatable memory on an 8 GiB node; whether DOKS encrypts Secrets at rest; Hetzner volume price from primary sources. Agent pod sizes are assumptions until the Q-1517 measurements.
