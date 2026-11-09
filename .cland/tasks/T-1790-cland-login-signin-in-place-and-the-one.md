---
id: T-1790
kind: task
title: "`cland login signin` in place, and the one-sign-in hint"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1781
  - T-1789
topic: null
branch: null
created: 2026-11-09T12:44:11.998Z
updated: 2026-11-09T12:44:20.265Z
---

## Summary

`cland login signin <name>` re-runs the harness's own sign-in over `ssh -t` on the host and volume that hold the login, while its sessions keep running. It then snapshots the disk under `fsfreeze` and marks the login `ready`. A signed-out login bound nowhere is first attached to a pool host, as `login add` does. A second sign-out of one account within a day adds the hint "This account seems to allow one sign-in: set exclusive or add an account."

## What to build

T-1777's sign-in runner on the existing mount, with no new volume. A Codex sign-in in place runs on the login's own home, whose credentials are already dead (question 12). The sign-in ends with freeze, snapshot and thaw through T-1781. The hint keeps a 24 h window on the hub clock, keyed by account, or by login when the login has no account; it appears in the card, the Agents line and `cland login list`. The `login.signin` frame and `cland login signin` are added.

## Acceptance criteria

- [ ] C1. `cland login signin <name>` on a signed-out login runs the fake sign-in over `ssh -t` on the host holding it, with the same volume id and no volume created (test).
- [ ] C2. The sign-in is followed by freeze, snapshot and thaw on that disk, and the login reads `ready` with a new last sign-in (test).
- [ ] C3. The sessions of that harness on the host keep running through the sign-in, and their next turn uses the renewed login (test).
- [ ] C4. A signed-out login bound nowhere is attached and mounted on a ready pool host for its sign-in, and is detached after it (test).
- [ ] C5. A second sign-out of one account within 24 h of hub-clock time adds the one-sign-in hint to the card, the Agents line and `cland login list`, and a sign-out 24 h or more after the first does not (test).

## Blocked by

- T-1781
- T-1789

## Notes

- Hot files: `hub/src/host/login-signin.ts`, `hub/src/host/login-signals.ts` (the hint), `hub/src/cli/login.ts` (`signin`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-signin.test.ts` (T3 with `fake-ssh` and the fake binaries for C1 to C4; T2 on the fake clock for C5).
- Serves epic C8.
