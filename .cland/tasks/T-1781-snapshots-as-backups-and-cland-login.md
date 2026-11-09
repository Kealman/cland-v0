---
id: T-1781
kind: task
title: Snapshots as backups, and `cland login snapshot`
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1535
blocked_by:
  - T-1777
topic: null
branch: null
created: 2026-11-09T12:44:10.095Z
updated: 2026-11-09T12:44:16.475Z
---

## Summary

Snapshots become backups: one after each sign-in, and one at most daily while a login is in use, taken under `fsfreeze`. Only the last two are kept. A host stop never waits for one: a snapshot due at release is taken of the detached volume afterwards, and a provider rate limit defers it to the retry time. `cland login snapshot <name>` takes one on demand.

## What to build

A snapshot scheduler on the hub clock:
- An in-use login gets a daily timer from its last snapshot. Its snapshot runs `loginDisk freeze`, then `snapshotVolume`, then `loginDisk thaw`; the thaw runs even when the snapshot fails.
- A detached volume is snapshotted directly.
- After a new snapshot is confirmed, the hub deletes the older ones beyond two, each with a confirming read, and keeps the ids on the row.
- A refusal with a retry time (DigitalOcean allows one snapshot per volume per 10 minutes) is retried at that time and never blocks a release.
- A snapshot pending at a hub stop resumes from the row at the next start.

T-1777's after-sign-in snapshot goes through this module. The `login.snapshot` frame and `cland login snapshot` are added.

## Acceptance criteria

- [ ] C1. A successful sign-in leaves exactly one snapshot, and a third snapshot of a login deletes the oldest, leaving the last two ids on the row (test).
- [ ] C2. On the hub clock, an in-use login is snapshotted once per 24 h under freeze and thaw, and its disk is thawed when the snapshot fails (test).
- [ ] C3. A host stop with a snapshot due completes its deletion first, and the detached volume is snapshotted afterwards (test).
- [ ] C4. A rate-limited snapshot is retried at the provider's retry time and not before, and no host stop waits for it (test).
- [ ] C5. `cland login snapshot <name>` snapshots a ready or in-use disk login, and is refused for a key login naming that it has no disk (test).
- [ ] C6. A snapshot due while the hub is stopped is taken after the next start (test).

## Blocked by

- T-1777

## Notes

- Hot files: `hub/src/host/login-snapshots.ts` (new), `hub/src/host/login-signin.ts` (the after-sign-in call), `hub/src/host/logins.ts` (snapshot ids), `hub/src/cli/login.ts` (`snapshot`). Registration points: `hub/src/protocol.ts`, `hub/src/hub/dispatch.ts`.
- Tests: new `hub/test/login-snapshots.test.ts` (T2, fake clock, the fake provider's `snapshotWindowMs`).
- Serves epic C3.
