---
id: T-1917
kind: task
title: hub-lock-readers.test.ts still reports child_process tier mismatches from production lock readers (inspect, readForeignHolder, migrateOffline) after T-1640
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-16T16:18:12.909Z
updated: 2026-11-24T09:01:14.673Z
---

## Summary

impl-1640 found (topic-1560, 2026-11-16 16:18Z) that after T-1640 moves the fixture to `fixtureLockIdentity`, the T2 file `hub/test/hub-lock-readers.test.ts` still makes report-only `child_process` tier mismatches. They come from production paths: `execFileSync` through `lockHostIdentity` in CLI inspect/readForeignHolder and migrateOffline, and `spawnSync` from migrateOffline's process-start observer (test "offline migration handles foreign age 65000 without local signals"). Either the readers take injectable identity and process-start seams, or the file is retiered.

## Acceptance criteria

- [ ] C1. A macOS suite run of `hub-lock-readers.test.ts` reports no `child_process` tier mismatch, through injected identity and process-start seams or a recorded retier, with its assertions unchanged (test).
