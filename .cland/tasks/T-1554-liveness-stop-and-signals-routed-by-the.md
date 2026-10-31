---
id: T-1554
kind: task
title: Liveness, stop and signals routed by the row's host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1545
  - T-1547
  - T-1548
  - T-1552
topic: null
branch: null
created: 2026-10-31T23:47:43.310Z
updated: 2026-10-31T23:47:47.599Z
---

## Summary

The Host lookup returns the row's own host. Liveness, stop, signals and pending-stop recovery of a row on another host go only to that host, checked by a Linux birth identity (boot id plus start ticks). No pid of such a row is probed or signalled on the hub's machine.

Hot files: `hub/src/adapters/sessions.ts` (the registry lookup), `hub/src/adapters/index.ts`, `hub/src/adapters/processes.ts`, `hub/src/adapters/launch-files.ts`, `hub/src/host/test-host.ts`

## Acceptance criteria

- [ ] C1. Every liveness check, stop, signal and pending-stop recovery of a row goes to the Host its `host` column names (test with recording hosts).
- [ ] C2. A row on another host is alive only when that host reports the recorded `linux:<boot id>:<start ticks>` identity for its pid, and a row there without a Linux identity is never stopped by a signal (test).
- [ ] C3. A row naming an unregistered host is neither probed nor signalled on the hub's machine and shows the state `unknown` (test).
- [ ] C4. With an in-process hub whose `local` host is a spy, a row on a test host whose pid is a live local process gets no `local` operation for that pid through startup, the poll, `session stop`, `session resume` and the orphan sweep (test).
- [ ] C5. Through the frame protocol on a real hub with `CLAND_TEST_HOSTS`, the same row's `session stop` leaves the local process running, and `hub.log` shows the test host answering for it (test).
- [ ] C6. Rows on `local` keep today's checks, the legacy `pid_started` fallback included, and the session-stop-races and session-async-processes test files pass with no test edited.
