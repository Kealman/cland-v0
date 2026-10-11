---
id: T-215
kind: task
title: "Shard the hub suite by resource: lock only the tests that need the machine"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by:
  - T-174
topic: null
branch: null
created: 2026-10-11T06:30:53.758Z
updated: 2026-10-11T06:35:57.174Z
---

## What to build

Mark the hub tests that touch shared machine state (real ports, `/tmp/cland-suite.lock`, headless Neovim, real-time waits) and run them as the **locked shard**. Everything else runs on its own tmp hub and forms the **free shard**. Several branches may run the free shard at the same time without the lock, under a per-run concurrency cap that keeps the machine under load 15 (T-173 showed that two full runs overload it).

Depends on T-174: fewer real-time waits shrink the locked shard.

## Acceptance criteria

- [ ] A test manifest or tag decides each test's shard, and a lint fails on an unmarked test that touches the listed resources.
- [ ] The free shard runs green twice concurrently on dev.
- [ ] The locked shard's duration appears in the suite report.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Requested by the human via the stand-in, 2026-10-11. v0.1.1 backlog: do not launch in v0.1.
