---
id: T-1826
kind: task
title: Removing and snapshotting a login from the hosts view
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1537
blocked_by:
  - T-1825
topic: null
branch: null
created: 2026-11-12T10:07:20.735Z
updated: 2026-11-12T18:07:56.645Z
---

## Summary

The hosts view removes and snapshots logins through the hub. Removal sits behind a confirmation that says the volume and its snapshots are deleted, and is not offered for a login in use.

## What to build

Two actions on each disk login's line:
- **Remove.** Offered for a login that is not in use, through `login.remove`. A confirmation names the login and says that its volume and snapshots are deleted.
- **Snapshot.** Through `login.snapshot`; the line shows the hub's result, or its refusal, such as a snapshot inside the provider's window.

A key login offers Remove only; its key file is deleted as `cland login remove` deletes it. Confirm and Cancel follow the session actions' pattern, and the hub's refusals show on the login's line.

## Acceptance criteria

- [ ] C1. `Remove` on a ready login asks for confirmation naming the login and the deletion of its volume and snapshots, and Confirm removes it, so that `cland login list` no longer shows it (test).
- [ ] C2. A login in use offers no `Remove`, and a removal the hub refuses leaves the login listed with the hub's reason on its line (test).
- [ ] C3. `Snapshot` on a disk login takes a snapshot through the hub, and the login's snapshots in `cland login list` include the new one (test).
- [ ] C4. A snapshot the hub refuses shows the hub's text on the login's line and changes nothing (test).

## Blocked by

- T-1825

## Notes

- Hot files: `web/src/sessions/HostsView.tsx`, `HostsView.module.css`.
- Tests: `web/test/hosts-view.test.ts` (Web, `projectHub` with the fake host provider and the fake harness binaries, isolated Headless Shell).
- Serves epic C2.
