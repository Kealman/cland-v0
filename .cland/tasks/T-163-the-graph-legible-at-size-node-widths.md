---
id: T-163
kind: task
title: "The graph legible at size: node widths for 120 to 200 columns, o sideways, the GRAPH-001 successor on the hub's fields, the README"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-161
topic: null
branch: null
created: 2026-10-10T07:49:36.868Z
updated: 2026-10-10T07:49:36.868Z
---

## Parent

T-116 (The task graph), slice 5 of 5.

## What to build

Legible at size. Node widths that fit 120 to 200 columns. Vertical layout by default, with `o` turning it sideways (decided in T-98). The `GRAPH-001` QA case is rebuilt on the hub's fields. `nvim/README.md` describes the graph and its keys. Crossing-edge legibility at a real epic's density is fog for the next version (spec §3.15): document what remains rather than solving it here.

## Acceptance criteria

- [ ] T-19's graph (22 items, 36 edges) is legible at 120, 160 and 200 columns, with screenshots or canvas dumps as artifacts.
- [ ] `o` toggles the sideways orientation; vertical is the default.
- [ ] A headless QA case succeeding `GRAPH-001` passes on dev against the hub's fields.
- [ ] `nvim/README.md` describes the graph, its keys and its known limits.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-161 (Graph cursor and live updates)
