---
id: Q-1516
kind: question
title: "Shape B: the hub in Kubernetes, requirements and costs"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:38.240Z
updated: 2026-10-31T14:35:56.144Z
---

## Question

What does shape B of map M-1511 (round-1 decision 11: the whole hub in Kubernetes, one replica, PVC for `.cland`, sessions as processes in agent-host pods, Ingress with TLS) require, and what does it cost on the cheapest managed and self-managed clusters?

Primary sources: Kubernetes docs (StatefulSet vs Deployment with a ReadWriteOnce PVC, `Recreate` strategy, PodDisruptionBudget, liveness/readiness, `emptyDir` with `medium: Memory` for credential tmpfs, Secrets and their encryption at rest, `kubectl exec`/`port-forward`, ephemeral containers), SQLite guidance on network and block storage (WAL on a PVC is fine on block storage, not on NFS), DOKS pricing and limits (control plane free, node pools, block storage, load balancer price), Hetzner + k3s (node prices, hcloud CCM/CSI, load balancer), GKE Autopilot pricing, cert-manager and ingress-nginx/Traefik for TLS, Helm vs kustomize for distributing a chart, container image build and publish (GitHub Container Registry, multi-arch), Node 24 base images, Playwright Chromium in a container for QA, Neovim in a container, running `git daemon` in-cluster vs a sidecar, egress needs (model APIs, GitHub, DigitalOcean API for droplet runs with the token from a Secret).

Answer: the minimal manifests set (hub Deployment with PVC, agent-host Deployment or Job per host with the host agent, Services, Ingress, Secrets, a ServiceAccount if the hub creates pods itself), whether the hub should create agent pods through the Kubernetes API as a host provider (round-1 decision 2) or a fixed pool should be declared in the chart, how the human reaches the hub (web with one-time links through the Ingress, Telegram/Discord outbound, `kubectl port-forward` for Neovim and the CLI), what `cland` CLI commands cannot work against a cluster hub, backup of the PVC, the monthly cost for a minimal cluster running the hub plus two small agent pods on each of DOKS, Hetzner k3s and GKE Autopilot, and what breaks in cland's assumptions (macOS-only code paths, `caffeinate`, `open`, file watching on PVCs, paths in hub.json, the 100-byte socket path).

Deliver docs/research/kubernetes-shape.md on branch research/kubernetes-shape with the cost table, the manifest outline, the list of hub changes, and "Rules for the spec".
