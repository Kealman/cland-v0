---
id: T-162
kind: task
title: "Graph stages: stage tags on nodes, s groups columns by stage and names edges against the plan, gp on a stage"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-161
  - T-114
topic: null
branch: null
created: 2026-10-10T07:49:36.763Z
updated: 2026-10-10T07:49:36.763Z
---

## Parent

T-116 (The task graph), slice 4 of 5. Spec §3.10 (stages), §3.13 (opening the plan view from a stage).

## What to build

Stages in the graph. With an epic plan, nodes carry their stage tag; `s` groups the columns by stage and names the edges that go back against the plan; `gp` on a stage opens the plan view.

## Acceptance criteria

- [ ] Nodes show their stage when the parent has a plan.
- [ ] `s` groups columns by stage and lists the edges that run against the plan.
- [ ] `gp` on a stage opens the plan view.
- [ ] Demo: an epic with a plan regroups by stage on `s`; a headless test covers it.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-161 (Graph cursor and live updates)
- The plan-parsing and plan-view tickets of T-114 (The epic plan), not yet cut; until then, blocked by the epic.
