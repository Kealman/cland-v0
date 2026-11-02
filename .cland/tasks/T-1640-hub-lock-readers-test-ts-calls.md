---
id: T-1640
kind: task
title: hub-lock-readers.test.ts calls lockHostIdentity directly and spawns sysctl on macOS
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
regression_of: T-1617
topic: null
branch: null
created: 2026-11-02T19:53:37.392Z
updated: 2026-11-02T19:53:37.392Z
---

## Summary

`hub/test/hub-lock-readers.test.ts`, from T-1617, calls `lockHostIdentity` directly in its fixture. On Darwin that runs `sysctl` through `execFileSync`, which a T2 file isn't expected to do, and every run emits report-only tier mismatches. The 14 tests pass. T-1639 added `fixtureLockIdentity`, captured once by the suite runner as `CLAND_TEST_LOCK_IDENTITY`.

## Acceptance criteria

- [ ] C1. `hub-lock-readers.test.ts` takes its native identity from `fixtureLockIdentity`, and a macOS suite run of it reports no `child_process` tier mismatch (test).
- [ ] C2. Its assertions are unchanged and all its tests pass.
