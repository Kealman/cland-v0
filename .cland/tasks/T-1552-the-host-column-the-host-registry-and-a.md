---
id: T-1552
kind: task
title: The `host` column, the host registry and a test host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: null
branch: null
created: 2026-10-31T23:47:42.826Z
updated: 2026-11-01T07:09:55.342Z
---

## Summary

`harness_processes` gains `host`, added in place with `local` for every existing row, and `HarnessProcess` carries it. The hub's host registry holds `local` and, for tests only, named test hosts: `CLAND_TEST_HOSTS` on a real hub and a `hosts` option in-process. The orphan sweep and doctor's orphan check, the table's other readers, ignore rows on another host.

Hot files: `hub/src/adapters/processes.ts`, `hub/src/adapters/contract.ts` (`HarnessProcess.host`), `hub/src/adapters/index.ts`, `hub/src/hub/daemon.ts`, `hub/src/orphans.ts`, `hub/src/host/test-host.ts` (new)

## Acceptance criteria

- [ ] C1. A hub opened on a `hub.db` written before the column existed adds `host` in place, every existing row reads `local`, and new rows are written with their host (test).
- [ ] C2. `session list` and the session frames show no new field for a `local` row (test).
- [ ] C3. A hub started with `CLAND_TEST_HOSTS=t1` has a test host `t1` that logs each operation it receives to `hub.log`, mints `linux:` identities for what it spawns and refuses spawn with a reason naming it a test host; without the variable no test host exists (test).
- [ ] C4. The orphan sweep and doctor's orphan check neither protect nor sweep a local process because a row on another host carries its pid (test).
- [ ] C5. The orphan-servers, orphan-sweep-lock and session-async-processes test files pass with no test edited.
