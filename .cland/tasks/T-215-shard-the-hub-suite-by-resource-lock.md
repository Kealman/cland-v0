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
parent: T-230
blocked_by:
  - T-174
  - T-232
topic: null
branch: null
created: 2026-10-11T06:30:53.758Z
updated: 2026-10-11T18:06:17.252Z
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

## Comments

### coord · 2026-10-11T18:06:17.252Z

Input from T-232 (2026-10-11 18:06Z): cland verify ships with an admission budget capped at 1 full run; values above 1 are reserved. Overlapping V1 workers need a shared compatibility broker (for hand runs and pre-V1 branches holding /tmp/cland-suite.lock) and per-run recovery records. Both belong here, together with deciding which shards may run side by side.
