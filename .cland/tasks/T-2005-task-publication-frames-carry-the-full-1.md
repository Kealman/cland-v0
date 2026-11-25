---
id: T-2005
kind: task
title: Task publication frames carry the full 1,650-item layer map each, so a status-changing comment still costs about 7 s of CPU after T-2004
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: null
branch: null
created: 2026-11-19T11:19:25.604Z
updated: 2026-11-25T13:02:28.148Z
---

## Summary

T-2004 made the hub responsive during a status-changing comment on a planned-stage item (`task.view` went from 5.3 s to 0.22 s on its fixture) by chunking and yielding. The total CPU only fell from 9.16 s to 7.05 s per such comment, though. In its measurement (impl-2004, A-21737 and topic-1656, 2026-11-19 11:19Z), most of the remaining cost is generating and sending 900+ legacy task frames, each carrying the full 1,650-item visibility layer map, to 21 subscribers.

## What to build

Cut the per-frame cost: send a layer map delta or one map per batch rather than the full map in every task frame, with capability negotiation so legacy clients keep working. Measure hub-only CPU on T-2004's fixture.

## Acceptance criteria

- [ ] C1. On T-2004's fixture, hub CPU per status-changing comment falls by at least half against T-2004's merged code, measured with hub-only CPU separated from client parsing (test).
- [ ] C2. Clients that don't negotiate the new shape receive frames byte-identical to today's, kept by a previous-shape regression (test).
