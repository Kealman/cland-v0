---
id: T-1147
kind: task
title: session.list returns hub-merged rows for archived sessions
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
topic: null
branch: t/T-1147-session-list-returns-hub-merged-rows-for
created: 2026-10-22T16:51:34.536Z
updated: 2026-10-22T16:51:57.854Z
---

## Summary

`session.list {archived: true}` returns processes only, while the hub-merged `SessionRow[]` exists only in snapshots and deltas, which leave archived sessions out. T-1132's Stopped group with its archived count and the archive toggle need merged rows for archived sessions without merging them in the browser. This prerequisite adds them under rule 19, so it lands and the hub restarts before T-1132 is enqueued.

## What to build

`session.list` gains an additive `rows` field carrying the hub-merged session rows for the sessions it returns, archived ones included, built by the same projection the snapshot uses. The existing fields stay unchanged for every current consumer (Neovim, CLI, tests).

## Acceptance criteria

- [ ] C1. `session.list {archived: true}` returns a `rows` field whose entries equal the snapshot's merged row shape for each archived session, and the existing fields are byte-identical for current callers (test).
- [ ] C2. The web edge allows the read, and the wire types and conformance cover the new field (test).
