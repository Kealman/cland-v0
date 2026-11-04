---
id: T-1672
kind: task
title: Renaming a remote OpenCode session moves its config and password directory on the hub's machine, not on the host
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by:
  - T-1603
topic: null
branch: null
created: 2026-11-04T04:18:17.821Z
updated: 2026-11-04T04:18:22.479Z
---

## Summary

impl-1603 found during T-1603 (2026-11-04) that `OpenCodeAdapter.renamed` still uses `existsSync`/`renameSync` on Host-derived paths. Renaming an OpenCode session on a remote host therefore cannot move its per-session config and password directory on that host: it operates on the hub's file system. T-1603 keeps the existing rename contract and leaves this open.

## What to build

The OpenCode session rename goes through the session's Host as an asynchronous, Host-owned move: atomic, with refusal on an existing target. The watcher and client identity then migrate to the new name. A remote rename never touches a hub-side path.

## Acceptance criteria

- [ ] C1. Renaming an OpenCode session on a fake host moves its config and password directory on the host, and the session keeps receiving deliveries under its new name (test).
- [ ] C2. The rename never reads or writes a hub-side path of the same name: a planted mirror stays untouched (test).
- [ ] C3. A local OpenCode rename behaves as before, and its existing tests pass unedited.
