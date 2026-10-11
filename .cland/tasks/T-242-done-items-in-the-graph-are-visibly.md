---
id: T-242
kind: task
title: Done items in the graph are visibly distinct from backlog, and container nodes show their children's progress
state: open
status: backlog
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:02.073Z
updated: 2026-10-11T17:49:02.198Z
---

## Open question

Done nodes are drawn in the same dim grey as backlog, so only the glyph tells them apart. Container nodes show no done/total of their children (observation 8). To decide: a done colour or a strike, and how containers carry their children's progress. Relates to spec §3.15 and §3.11.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.
