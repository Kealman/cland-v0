---
id: T-1615
kind: task
title: The hub lock records its host identity and a heartbeat
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1538
blocked_by: []
topic: topic-1331
branch: t/T-1615-the-hub-lock-records-its-host-identity
created: 2026-11-02T03:34:16.287Z
updated: 2026-11-02T05:47:48.835Z
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

## Comments

### impl-1615 · 2026-11-02T05:44:27.417Z

Rule 20 inventory before editing: hub/src/hub/lock.ts owns LockHolder parsing, sync/async acquisition, break-guard recovery and release. Direct hub consumers: daemon.ts (opt-in here); cli/hub.ts (liveHolder), doctor/project.ts (liveHolderAsync), orphans.ts (readLock) are lifecycle migrations owned by T-1617. tracker/offline-migrate.ts acquires hub.lock offline but retains legacy acquisition pending lifecycle migration. Non-hub users unchanged: territory.ts, suite-lock.ts, termination-owner.ts, executor/droplet/{droplet,spend}.ts, orphans.ts's orphan-sweep.lock. Process-start helpers used by adapters/processes, system-processes, git-maintenance-owner, executor/local, watchdog, suite-command and tests retain semantics. Test/fixture inventory includes daemon, edges, startup-cleanup, territory-lock, executor-spend/safety/admission-lock/lock-liveness, orphan-sweep-lock/orphan-servers, suite-runner/close-component, pid-identity, process-started/system-processes, doctor, secrets/gateway-secrets, harness/native-process, cover-quiet, run-suite/memory-producer/measure-memory, host-boundary, suite-selection/task-selection/coverage and git-maintenance; old records remain compatible. Docs/briefs: hub/README lock entry, docs/spec/v0.4, qa/briefs/E-579; no wire shape changes or new frames. Shipped skills contain no raw lock record reader. New tests will exercise acquireLock and persisted lock/guard records with injected process/identity/clock seams named by the ticket; native boot reader exercised separately. T-1616 owns refresh/lost-lock lifecycle; T-1617 owns foreign-holder lifecycle clients.

### impl-1615 · 2026-11-02T05:47:48.835Z

Published lock format for T-1616/T-1617: hub acquisition calls acquireLock(path, processes?, {hostIdentity:{hostname,bootId,pidNamespace}, now?, lapseMs?}). Fields are additive beside pid/started/token; heartbeat is ISO wall time. Defaults HUB_LOCK_HEARTBEAT_MS=10000 and HUB_LOCK_LAPSE_MS=60000; exactly 60000 ms remains held. readLock preserves token/new fields. foreignLockHolder compares every component. Hub break-guard owner records carry the same identity/heartbeat; foreign guard owners use lapse without probing their PID. Invalid/missing heartbeat on a complete foreign identity stays held. Generic sync/async acquisitions keep prior serialized shapes. daemon native acquisition opts in; projectHub synthetic identity opts in, direct injected-process legacy fixtures stay native-probe-free. Heartbeat refresh and lost-lock shutdown remain T-1616; start/stop/status/doctor/orphan/offline-migrate fencing remains T-1617.
