---
id: T-993
kind: task
title: The web phase on droplets
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-991
topic: topic-789
branch: t/T-993-the-web-phase-on-droplets
created: 2026-10-20T16:51:40.674Z
updated: 2026-10-21T09:38:50.157Z
---

## Summary

The prepared executor snapshot carries Chrome Headless Shell and its Linux libraries, keyed by the lock file, so the web phase runs on the remote executors with four workers.

## What to build

The droplet prepare installs Chrome Headless Shell and the libraries it needs on Linux. The snapshot key changes with the lock file. The `Web` shard runs four workers on a droplet.

## Acceptance criteria

- [x] C1. The droplet prepare plan installs Chrome Headless Shell and its Linux libraries, and its snapshot key changes when the lock file changes (unit test).
  - done: impl-993 · 2026-10-21T09:38:37.145Z
- [x] C2. The `Web` shard is planned with four workers on a droplet executor and two locally (unit test).
  - done: impl-993 · 2026-10-21T09:38:37.160Z
- [x] C3. The prepared-image provisioning (provision.sh, run as root by the hub at prepare time) installs the Linux libraries Chrome Headless Shell needs, proven before merge by a unit test of the provision plan; the live droplet `Web` receipt follows as landing evidence after the hub restart and a Coordinator-run executor prepare.
  - done: impl-993 · 2026-10-21T09:38:37.173Z
- [x] C4. `docs/agents/tests.md` documents the browser in the prepared snapshot.
  - done: impl-993 · 2026-10-21T09:38:37.188Z

## Comments

### coord · 2026-10-20T19:25:28.457Z

Dependency noted by the Coordinator, 2026-10-20 19:25Z (impl-991 on T-991): the droplet provision installs no Chrome Headless Shell system libraries, and the non-root prepared runner cannot apt-install them. T-991's first REMOTE Web receipt waits on T-993's prepared browser image; T-991 itself is verified locally on macOS (--executor local). Until T-993, a droplet run that selects the Web phase must report it as unavailable on that machine, not pass or crash.

### impl-993 · 2026-10-21T09:38:37.134Z

Implemented and pushed 7c47b454637cde1ca901f3a56a8dab3c015fc486. Root provisioning installs the pinned Playwright Ubuntu 24.04 Chromium runtime libraries. Unit contracts cover provision plan, existing npm shell install lifecycle, lock-only invalidation; existing Web planner test proves 4 droplet/2 local workers. Targeted T1: 5+8+27 pass on macOS/local; typecheck and test:lint pass (lint report-only, zero refusals), shell syntax/diff clean. C3's live Linux Web receipt is Coordinator-owned landing evidence after hub restart and executor prepare, per Coordinator rewording.
