---
id: T-983
kind: task
title: The snapshot at connection
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-979
topic: null
branch: null
created: 2026-10-20T16:50:00.282Z
updated: 2026-10-20T16:50:00.282Z
---

## Summary

A client that asks for it in its hello's feature list gets one snapshot after the welcome, stamped with an epoch and a sequence number. The snapshot carries the tracker levels, items, sessions, topics, inbox, the first page of events and the accounts, without the suite history, and replaces the eleven reads at connection.

## What to build

The hello carries a feature list (the snapshot, numbered deltas, slim frames), and the welcome answers with the accepted features. With the snapshot feature, the hub composes one snapshot in one turn of its loop and sends it as one frame per domain under one sequence number, closed by an end marker. Each frame stays within its kind's size limit. The domains:
- the tracker levels and the ladder;
- the items, each with the latest verdict of each kind and its round, while the verdict history stays behind `task.view`;
- the sessions with presence, the roles, the crew, the Coordinator and the verification queue;
- the open topics and those closed in the last seven days;
- the inbox with `needsYou`;
- the first page of events;
- the accounts.

A connection without the feature list, which means Neovim's and the CLI's, receives today's frames unchanged.

## Acceptance criteria

- [ ] C1. A client hello with the snapshot feature receives, after the welcome, frames under one epoch and one sequence number closed by an end marker, and a hello without it receives today's frames only (test).
- [ ] C2. The snapshot carries the levels and ladder, items with the latest verdict of each kind and its round, sessions with presence, roles, crew, Coordinator and verification queue, open topics plus those closed in the last seven days, the inbox with `needsYou`, the first page of events and the accounts (test, one assertion per domain).
- [ ] C3. No snapshot frame carries suite history or an item's verdict history, and each frame stays under its kind's size limit (test).
- [ ] C4. The snapshot is composed in one synchronous turn: no other frame reaches the connection between its first frame and its end marker (test with a change raced against the composition).
- [ ] C5. On a local copy of the live tracker, a measurement script records the snapshot's bytes per domain and its compose time, and the figures are posted as a comment on E-412 beside the prototype's 1.15 MB (local evidence).
- [ ] C6. `hub/README.md` documents the feature list, the snapshot's frames and the end marker.
