---
id: T-1792
kind: task
title: "`cland login remove`"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1779
  - T-1781
  - T-1783
topic: null
branch: null
created: 2026-11-09T12:44:12.424Z
updated: 2026-11-09T12:44:21.087Z
---

## Summary

`cland login remove <name>` deletes a disk login's volume and every snapshot, each confirmed by a read, then its row. For a key login it deletes `.cland/auth/<name>.key` and the row. The command is refused while the login is in use, naming the host.

## What to build

The `login.remove` frame and `cland login remove`. A deletion the provider does not confirm keeps the row with the ids that remain, and the command exits nonzero naming them, so a rerun finishes the work. Removing a `creating` login is refused while its sign-in runs. The `[auth]` store key is never removed.

## Acceptance criteria

- [ ] C1. `cland login remove` of an in-use login is refused naming its host and changes nothing (test).
- [ ] C2. After that host stops, the same command deletes the volume and both snapshots with confirming reads, and the login leaves `cland login list` (test).
- [ ] C3. A deletion the provider does not confirm keeps the row with the remaining ids, and the command exits nonzero naming them (test).
- [ ] C4. Removing a key login deletes its key file and its row, and leaves the `[auth]` key (test).
- [ ] C5. Removing a `creating` login is refused naming the running sign-in (test).

## Blocked by

- T-1779
- T-1781
- T-1783

## Notes

- Hot files: `hub/src/host/login-remove.ts` (new), `hub/src/host/logins.ts` (row removal), `hub/src/cli/login.ts` (`remove`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-remove.test.ts` (T2, the fake provider's `ignoreVolumeDelete` for C3).
- Serves epic C9.
