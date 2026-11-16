---
id: T-1905
kind: task
title: Test process cleanup throws "native process identity unavailable" for a child whose exit was already observed, under Linux load
state: open
status: backlog
size: S
labels:
  - flaky
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:44:00.478Z
updated: 2026-11-16T07:44:00.478Z
---

## Summary

In impl-1703's loaded Linux evidence (2026-11-16, Docker `--init`, arm64 Node 24.21.0, load 10.64, dev edbe8da2c plus T-1703's patch), `hub/test/opencode-adapter.test.ts:608` "after a hub restart, resume re-finds the OpenCode server and session through the process table and the event stream goes on" failed 20/21 in cleanup. It reported `Error: native process identity unavailable for pid 1761; fixture preserved; captured: known; current: native exit observed; listed descendants are not confirmed gone`, from `requireIdentities` → `cleanupRecordedProcesses` → `cleanupOwnedProcesses` → `cleanup`. The same file passed 21/21 at load 8.15 just before. The test's assertions passed; only the fixture's teardown refused. `hub/test/process-cleanup.ts:94` throws when either identity is missing and `alive(target.pid)` is true. Here the current row says the native exit was observed, which points to an exited child that isn't reaped yet still answering the liveness probe, or a pid reading taken after exit. It is not T-1703's change, a closed-store fence in sessions.ts.

## What to build

Find what `alive(pid)` sees for a child whose native exit was observed: a zombie, a reaped pid or a reused pid. Make cleanup settle an observed exit as gone when its captured identity matches and no live process with that identity remains, and keep refusing a pid that is live with an unknown identity (T-543 and T-1337 stay intact). Add a regression with a held reap or a fake process table.

## Acceptance criteria

- [ ] C1. Cleanup accepts a child whose captured identity is known and whose exit was observed, including while the zombie is unreaped, and still refuses a live pid with an unknown or mismatched identity (test, red before the fix).
- [ ] C2. `opencode-adapter.test.ts` passes 10/10 full-file runs in a Linux `--init` container at a load of at least 10, with no cleanup refusal (evidence).
