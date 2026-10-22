---
id: T-1130
kind: task
title: Area modules and their hub state for Sessions, Accounts and Artifacts
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1115
topic: null
branch: t/T-1130-area-modules-and-their-hub-state-for
created: 2026-10-22T15:16:14.835Z
updated: 2026-10-22T16:02:31.743Z
---

## Summary

The shell renders Sessions, Accounts and Artifacts through area modules of their own, each with a list, a page and a drawer slot, and the connection keeps those areas' hub state from the snapshot and the deltas, so the slices that follow change only their own area's files.

## Parent

E-418 (prefactor for tracer steps 1 to 6; v0.2 §3.2 the shell, §3.3 the live model).

## What to build

Today the shell draws every area other than Items as one generic list of ids and titles, the connection maps sessions, accounts and artifacts to those rows, and it rereads whole lists on `account`, `artifact`, `presence` and `session.process` frames.

- **Area modules.** Sessions, Accounts and Artifacts each get a module the shell mounts in a pane, in a pane's page (the detail view, also opened in the other pane with ⌘Enter) and in the drawer, with its keyboard controls wired through the per-area tables of the keys slice. Each keeps today's list until its slice lands. The Sessions module is laid out as the Sessions board draws it: the header, the accounts strip, the verify line and the groups, each its own component, empty here, so the strip, the verify line and the groups can land in parallel lanes.
- **Hub state.** From the snapshot and the deltas the connection keeps: the merged session rows with the archived count; the roles with their launch defaults; the verification queue with the time its frame arrived; the account views in registry order with the registry error; the adapters' capability tables (read once with `session.list`); and the artifacts. An `account` frame replaces that account's view, a `verification.queue` frame replaces the queue and an `artifact` frame replaces that artifact, each without rereading a list. A resync or reconnect takes the areas' state from the fresh snapshot.

Inbox, Topics and Events stay as they are; E-417 owns them and may adopt the same seam.

## Acceptance criteria

- [ ] C1. Sessions, Accounts and Artifacts render through their own area modules in a pane, in the other pane's page and in the drawer, and Items, Inbox, Topics and Events render as before (Web test).
- [ ] C2. A pushed `verification.queue`, `account` or `artifact` frame updates the client in place, and no `session.list`, `account.list` or `artifact.list` request follows it on the socket (Web test).
- [ ] C3. After a hub restart the Sessions and Accounts areas show the new hub's rows without a page reload and keep none from before the drop (Web test).
- [ ] C4. `web/README.md` describes the area modules, their slots and the hub state each area reads (docs).
