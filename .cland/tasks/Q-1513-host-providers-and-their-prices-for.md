---
id: Q-1513
kind: question
title: Host providers and their prices for agent hosts
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:37.634Z
updated: 2026-10-31T14:35:55.549Z
---

## Question

Which host providers can run cland's agent hosts (round-1 decision 2: a Linux machine running several harness sessions, started on demand, stopped on idle), and what do they cost per live hour and per idle hour, including a kept disk? Map M-1511 rounds 1–3.

Compare, from primary sources (pricing pages, API docs, limits pages), with the date checked: DigitalOcean small droplets (s-1vcpu-2gb, s-2vcpu-4gb, s-4vcpu-8gb; stopped droplets bill fully; volumes; snapshots), Hetzner Cloud (CX/CPX/CAX lines, API, snapshots, stopped-server billing, locations), Fly.io Machines (per-second billing while started, stopped machines bill rootfs and volumes only, auto-start/stop, API), serverless containers that could host a long-lived process (E2B, Modal, Google Cloud Run jobs/services with min instances, DigitalOcean MicroVMs, Daytona), and managed Kubernetes node pools (DOKS, Hetzner + k3s on CX machines, GKE Autopilot) as the shape-B substrate. For each: price per hour live and idle, boot time to SSH or exec, persistent disk options, API and token model (can a token be scoped to one project or tag), SSH availability (round-1 decision 3 needs SSH; outbound-only providers are the later extension), egress and image costs, regions near London/Frankfurt, limits on concurrent machines and API rate limits, snapshot or image support (round-1 decision 6: one image recipe), and anything that breaks the host anatomy of round 2 (systemd, tmpfs, git, Node 24, Neovim, Playwright Chromium for QA).

Also measure, read-only on this Mac with `ps`, the current RSS and CPU of the running harness processes (codex app-server, claude, opencode serve, node spoke) to give a first per-session footprint; note it as a Mac figure, not Linux.

Deliver docs/research/host-providers.md on branch research/host-providers: a price table (8 vCPU equivalents are irrelevant; size for 2–8 sessions of 300–600 MB each), a recommendation of the first and second provider with reasons, and "Rules for the spec".
