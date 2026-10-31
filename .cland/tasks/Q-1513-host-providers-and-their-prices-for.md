---
id: Q-1513
kind: question
title: Host providers and their prices for agent hosts
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-1511
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:35:37.634Z
updated: 2026-10-31T14:51:01.743Z
closed: 2026-10-31T14:51:01.743Z
---

## Question

Which host providers can run cland's agent hosts (round-1 decision 2: a Linux machine running several harness sessions, started on demand, stopped on idle), and what do they cost per live hour and per idle hour, including a kept disk? Map M-1511 rounds 1–3.

Compare, from primary sources (pricing pages, API docs, limits pages), with the date checked: DigitalOcean small droplets (s-1vcpu-2gb, s-2vcpu-4gb, s-4vcpu-8gb; stopped droplets bill fully; volumes; snapshots), Hetzner Cloud (CX/CPX/CAX lines, API, snapshots, stopped-server billing, locations), Fly.io Machines (per-second billing while started, stopped machines bill rootfs and volumes only, auto-start/stop, API), serverless containers that could host a long-lived process (E2B, Modal, Google Cloud Run jobs/services with min instances, DigitalOcean MicroVMs, Daytona), and managed Kubernetes node pools (DOKS, Hetzner + k3s on CX machines, GKE Autopilot) as the shape-B substrate. For each: price per hour live and idle, boot time to SSH or exec, persistent disk options, API and token model (can a token be scoped to one project or tag), SSH availability (round-1 decision 3 needs SSH; outbound-only providers are the later extension), egress and image costs, regions near London/Frankfurt, limits on concurrent machines and API rate limits, snapshot or image support (round-1 decision 6: one image recipe), and anything that breaks the host anatomy of round 2 (systemd, tmpfs, git, Node 24, Neovim, Playwright Chromium for QA).

Also measure, read-only on this Mac with `ps`, the current RSS and CPU of the running harness processes (codex app-server, claude, opencode serve, node spoke) to give a first per-session footprint; note it as a Mac figure, not Linux.

Deliver docs/research/host-providers.md on branch research/host-providers: a price table (8 vCPU equivalents are irrelevant; size for 2–8 sessions of 300–600 MB each), a recommendation of the first and second provider with reasons, and "Rules for the spec".

## Comments

### human · 2026-10-31T14:51:01.584Z

## Resolution

Research note: docs/research/host-providers.md on branch research/host-providers (final 359d08df, pushed to origin only). Twelve rules for the spec.

1. First provider: DigitalOcean droplets. Reuses the executor's token, snapshot, tag and ledger code; regions lon1, fra1, ams3; billed per second with a 60 s minimum; SSH accepted 26.9 s after create in lon1 (measured 2026-10-12). A powered-off droplet bills in full, so idle stop destroys the droplet and keeps a snapshot or a 20 GiB volume ($2/month).
2. Second provider: Fly.io Machines. A stopped Machine bills only storage, starts in about a second, app-scoped tokens. No systemd (Fly's /init is PID 1); rootfs wiped on start unless persist_rootfs; a public sshd needs a $2 dedicated IPv4; API 1 request/s per action.
3. Hetzner is about a fifth of DigitalOcean nominally but cannot be ordered today: every CX, CAX and CPX plan "currently unavailable", status page "Limited availability of cloud instances" since 2026-06-26; no London location; hours rounded up; no managed Kubernetes.
4. Serverless (DO MicroVMs, E2B, Modal, Cloud Run, Daytona) costs 2–12× a droplet of the same size per live hour and none gives SSH to a public address; they stay the later outbound-WSS provider class.
5. Shape B substrate: DOKS has a free control plane and nodes at droplet prices; GKE Autopilot in London is about 4× a droplet.
6. Prices (USD/h, no VAT): DO s-2vcpu-4gb 0.0357 live, 0.0027 destroyed with a 20 GiB volume; DO s-4vcpu-8gb 0.0714; Hetzner CX23 EUR 0.0096, CX33 EUR 0.0144 (full price stopped); Fly shared-2x 4 GB lhr 0.0396 live / 0.0068 idle with volume and IPv4, shared-4x 8 GB 0.0791 / 0.0068; DO MicroVM 2/4 0.078 (no SSH); E2B 2/4 0.1656 + $150/month Pro; Daytona 4/8 0.3312; Modal 2/4 0.238 (×1.15–1.75 EU); Cloud Run London 4/8 0.380; GKE Autopilot London 4/8 0.280 + cluster fee.
7. Footprint on macOS (ps + footprint): a Claude session 250–550 MB, a Codex session 150–250 MB, opencode serve about 200 MB shared, a spoke 20–60 MB, a hub typecheck peaks at 1.24 GB. Estimate: 2 vCPU / 4 GB holds 3–4 sessions, 4 vCPU / 8 GB holds 6–8. Linux figures come from the host prototype (Q-1517).
8. Rules: where a stopped machine still bills, idle stop destroys it; the host agent must not depend on systemd (Fly and pods have none; this amends round-2 decision 2 and the transport note's systemd-run layout: systemd where present, a plain supervisor otherwise); the work disk is disposable; each provider declares live and idle price, billing minimum and token confinement (Hetzner project, Fly app token, DO custom scopes); the image recipe takes the CPU architecture as a parameter (provision.sh is x86_64-only today); host creation respects each provider's API pacing and machine limits.
9. Not found: Hetzner volume price and default limits; whether a DO token can be limited to one project or tag; Fly machines-per-org limit; SSH on E2B and Modal; any Linux per-session figures.
