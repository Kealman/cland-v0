---
id: T-1786
kind: task
title: Exclusive and non-exclusive logins
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1781
topic: null
branch: null
created: 2026-11-09T12:44:11.156Z
updated: 2026-11-09T12:44:18.615Z
---

## Summary

`exclusive` is enforced twice: the scheduler never binds an exclusive login that is in use, and an attach the provider refuses as "attached elsewhere" counts as in use. A non-exclusive login serves readers. The first host to bind it takes the login's own volume and is its writer. Each later host gets a reader volume made from the latest snapshot, never writes back, and has that volume deleted when it stops. `cland login set <name> --exclusive true|false` changes the flag while the login is not in use.

## What to build

Writer and reader bindings:
- **A reader bind.** `createVolume` from the latest snapshot, then attach and mount.
- **A reader release.** Unmount, detach and a confirmed `deleteVolume`.
- **The writer.** It binds and releases as in T-1778 and T-1779.

A reader bind with no snapshot is refused naming it. The `login.set` frame and `cland login set` are added; the command is refused while the login is in use. Every disk login defaults to exclusive.

## Acceptance criteria

- [ ] C1. A second host cannot bind an exclusive login in use, and a provider attach refused as attached elsewhere leaves the launch unplaced on that host and the login unchanged (test).
- [ ] C2. With `exclusive = false`, two fake hosts run sessions on one login at once: the first holds the login's own volume and the second a volume made from the latest snapshot (test).
- [ ] C3. After both hosts stop, the login's own volume holds the writer's turns and none of the reader's, and the reader's volume is deleted with a confirming read (test).
- [ ] C4. `cland login set <name> --exclusive false` is refused while the login is in use, and `cland login list` shows the writer's host and each reader's host (test).
- [ ] C5. A reader bind of a non-exclusive login with no snapshot is refused naming the missing snapshot (test).

## Blocked by

- T-1779
- T-1781

## Notes

- Hot files: `hub/src/host/login-binding.ts`, `hub/src/host/logins.ts`, `hub/src/cli/login.ts` (`set`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-exclusive.test.ts` (T2); one T3 case with the fake harness on two fake hosts for C3.
- Serves epic C4.
