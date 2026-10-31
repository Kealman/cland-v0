---
id: T-1544
kind: task
title: The sessions layer acts through the session's Host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1543
topic: null
branch: null
created: 2026-10-31T23:47:40.914Z
updated: 2026-10-31T23:48:13.785Z
---

## Summary

Give the sessions layer a host registry that holds only `local`, and add to `AdapterHost` a lookup of the Host for a process row and for a launch, which the adapters use from ticket 04 onwards. Route the launch and relaunch cwd checks, the crew-pool restart's stat, the launch's identity reads, the deaf-episode liveness, the legacy identity upgrade, durable pending-stop recovery and `LaunchFiles` rollback through it.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/contract.ts` (`AdapterHost`), `hub/src/adapters/index.ts`, `hub/src/adapters/launch-files.ts`, `hub/src/adapters/session-cwd.ts`

## Acceptance criteria

- [ ] C1. `AdapterHost` exposes the Host of a process row and of a launch, and every lookup resolves to the `local` host (test).
- [ ] C2. The launch cwd check, the crew-pool restart check and the relaunch cwd refusal call the Host's statDirectory, with refusal texts unchanged (test).
- [ ] C3. Launch identity reads, deaf-episode liveness at startup and on its timer, the legacy identity upgrade and pending-stop recovery go through the Host's identity, alive and processes operations (test with a recording Host).
- [ ] C4. `LaunchFiles` rollback ends a failed launch's children through the Host's stop, and a pending-stop record written before this change is still recovered after a hub restart (test).
- [ ] C5. `sessions.ts` and `launch-files.ts` no longer import `stat`, `pidAlive`, `processIdentityAsync`, `systemProcesses` or `endProcess`, apart from the hub's own `CLAND_TEST_CRASH_AT` self-kills.
- [ ] C6. The session-launch, session-resume, session-stop-races, session-async-processes and session-cwd test files pass with no test edited.
