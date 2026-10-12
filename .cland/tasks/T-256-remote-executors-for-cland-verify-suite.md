---
id: T-256
kind: task
title: "Remote executors for cland verify: suite runs on cloud VMs behind a provider-agnostic executor interface (DigitalOcean first)"
state: open
status: backlog
labels:
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T08:21:26.188Z
updated: 2026-10-12T08:21:26.188Z
---

Remote executors for `cland verify`: suite runs on cloud VMs through a provider-agnostic executor interface, so the crew stops queueing behind one machine and the project pays per minute.

Decision context (human, 2026-10-12, after the remote-runner market research): cland writes its own orchestration on bare VMs rather than buying a managed runner service, because it is cheaper, has no vendor concurrency or process limits, and lets a user bring any cloud they already have. Managed services (Fly Machines, Namespace, E2B) stay possible as later backends behind the same interface.

Numbers from the v0.1 run (artifact suite logs, 2026-10-09..12): 229 full-suite runs, 42.8 machine-hours, median run 13 min, 60 h of lock wait. On DigitalOcean CPU-Optimized 8 vCPU (≈$0.0042/min) the whole release 0.1 would have cost ≈$11; at 40 runs/day ≈$70/month. Fly ≈$16 / $105, Namespace ≈$21 / $134, GitHub hosted 8-core ≈$57 / $370. The suite is Linux-portable (Neovim phase headless; three darwin mentions in code).

Scope to grill with the human:
- Executor interface in `cland verify`: create machine from image/cloud-init, wait for SSH, run the suite command on a given tree, collect output and the suite artifact, destroy. The local machine is one executor; cloud VMs another.
- First backend: DigitalOcean (per-second billing, 60 s minimum). Hetzner/Vultr next (hourly billing, so a "machine per hour with a queue" policy rather than "machine per run"). Policy is a backend parameter.
- Tree delivery: `git bundle` of the candidate commit or read access to the territory; Node 24 + Neovim + git in the image.
- Lifecycle safety: run timeout, guaranteed destroy even when the hub dies, orphan sweep by tag (a forgotten 8 vCPU VM costs ≈$6/day), per-day spend cap.
- Results flow back into the hub exactly as `cland suite` posts them today (ticket, artifact, verdict evidence, tree-hash cache from T-233).
- Secrets: the provider token lives with the human; the hub reads it, never stores it in the tracker or artifacts.
- Warm pool option: keep one machine up for short runs; spot/preemptible instances where offered.
- Before building: one real suite run on a DigitalOcean 8 vCPU VM to measure duration and confirm no process-limit issue.

Non-goals: macOS runners (5–15× the price, 24 h minimums at Scaleway/AWS); fine-grained impact analysis; replacing the local executor.

Relates to T-218 (verification research, "later: remote executors"), T-232 (`cland verify` scheduler), T-233 (result cache), T-215 (shards).
