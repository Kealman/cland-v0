---
id: T-1722
kind: task
title: Remote host layouts name the Claude Code mod directory, so Claude Code sessions launch on a host
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1601
found_by: qa
topic: null
branch: t/T-1722-remote-host-layouts-name-the-claude-code
created: 2026-11-06T11:10:45.203Z
updated: 2026-11-06T11:12:05.831Z
---

## Summary

`remoteHostLayout` (hub/src/host/remote-layout.ts) never sets `modDir`, and nothing in hub/src supplies one for an ssh Host. The Claude Code adapter therefore refuses every launch on a remote host with `remote layout has no mod directory yet` (hub/src/adapters/claude-code.ts:483). Only in-process test fixtures inject a `modDir`, which is how the E-1532 tests pass. A CLI-started hub, and a real host, cannot run Claude Code, so E-1532's C5 ("sessions of all three harnesses run on a host") and its Definition-of-done demo fail for Claude Code. The DoD brief writer found this on 2026-11-06.

## What to build

- The remote layout names the mod directory inside the host's installed code tree for its version (`<code>/mod/cland`, next to `hub/bin/cland.ts`), and a host configuration can still override it.
- For fake hosts, the registry's fake branch points `modDir` at the installed tree's `mod/cland`, as it already does for `node`, `cli` and `spoke`.
- The adapter's refusal stays for a layout that truly has no mod directory.
- Rule 20 sweep: every reader of `HostLaunchLayout.modDir` and of the remote layout, including the launch-layout and host-launch-layout tests.
- Whether the code tree on a real host contains `mod/cland` is E-1533's question (images or the ready-time code delivery); this item only makes the layout name it.

## Acceptance criteria

- [ ] C1. `remoteHostLayout(home)` returns a `modDir` of `<code>/mod/cland` for the running version, and a configured override wins (test).
- [ ] C2. A CLI-started hub with a fake host launches a Claude Code item session on it, and the session reaches running with its mod bridge connected through the tunnel (test, red before the fix).
- [ ] C3. A layout without a mod directory is still refused with the existing message (test).
