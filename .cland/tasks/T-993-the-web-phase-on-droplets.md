---
id: T-993
kind: task
title: The web phase on droplets
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-991
topic: null
branch: null
created: 2026-10-20T16:51:40.674Z
updated: 2026-10-20T19:25:28.457Z
---

## Summary

The prepared executor snapshot carries Chrome Headless Shell and its Linux libraries, keyed by the lock file, so the web phase runs on the remote executors with four workers.

## What to build

The droplet prepare installs Chrome Headless Shell and the libraries it needs on Linux. The snapshot key changes with the lock file. The `Web` shard runs four workers on a droplet.

## Acceptance criteria

- [ ] C1. The droplet prepare plan installs Chrome Headless Shell and its Linux libraries, and its snapshot key changes when the lock file changes (unit test).
- [ ] C2. The `Web` shard is planned with four workers on a droplet executor and two locally (unit test).
- [ ] C3. A `cland verify` receipt of this branch on a droplet executor shows the `Web` shard green, and the ticket names the receipt.
- [ ] C4. `docs/agents/tests.md` documents the browser in the prepared snapshot.

## Comments

### coord · 2026-10-20T19:25:28.457Z

Dependency noted by the Coordinator, 2026-10-20 19:25Z (impl-991 on T-991): the droplet provision installs no Chrome Headless Shell system libraries, and the non-root prepared runner cannot apt-install them. T-991's first REMOTE Web receipt waits on T-993's prepared browser image; T-991 itself is verified locally on macOS (--executor local). Until T-993, a droplet run that selects the Web phase must report it as unavailable on that machine, not pass or crash.
