---
id: T-1615
kind: task
title: The hub lock records its host identity and a heartbeat
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: null
branch: null
created: 2026-11-02T03:34:16.287Z
updated: 2026-11-02T03:34:43.687Z
---

## Summary

A new hub lock records the holder's host identity (hostname, boot id and PID-namespace id) and a heartbeat time beside its pid, start time and token. A contender whose identity differs in any part never probes the holder's pid. It refuses the start while the heartbeat is fresh, and breaks the lock through the existing `hub.lock.break` guard only after the heartbeat has lapsed. Records with the contender's own identity, and records in every older shape, keep today's rules.

Hot files: `hub/src/hub/lock.ts`, `hub/src/process-identity.ts` [E-1532: one boot-id reader], `hub/src/hub/daemon.ts` (acquire call only), new `hub/test/hub-lock-identity.test.ts`

## Acceptance criteria

- [ ] C1. A hub lock written by a new hub carries the holder's hostname, boot id and PID-namespace id (null where the platform has none) and a heartbeat time, beside its pid, start time and token (test).
- [ ] C2. A lock whose host identity differs from the contender's in any part and whose heartbeat is younger than the lapse refuses the start with `HubLocked`, even when its pid is not alive on the contender's machine (test).
- [ ] C3. The same foreign lock with a heartbeat older than the lapse is broken through the `hub.lock.break` guard, and the contender takes the lock whole (test).
- [ ] C4. The pid of a foreign record is never probed with a signal or `ps` on the contender's machine (test).
- [ ] C5. A lock with the contender's own host identity keeps today's pid, start-time and pid-reuse rules (test).
- [ ] C6. Records without the new fields, in each older shape (pid alone, with `started`, with `startedUtc`, with `token`), keep today's rules (test).
- [ ] C7. The boot id comes from the reader `process-identity.ts` already uses on Linux, and from `kern.bootsessionuuid` on macOS (test).
- [ ] C8. Host identity and heartbeat apply to the hub lock only, and the spend, territory, suite and termination locks write and read their records as before (test).
- [ ] C9. `daemon.test.ts`, `edges.test.ts`, `startup-cleanup.test.ts`, `territory-lock.test.ts` and `executor-spend.test.ts` pass with no test edited.

## Notes

Shared files: see Hot files
