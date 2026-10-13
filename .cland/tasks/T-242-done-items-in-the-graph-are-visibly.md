---
id: T-242
kind: task
title: Done items in the graph are visibly distinct from backlog, and container
  nodes show their children's progress
state: closed
status: done
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:02.073Z
updated: 2026-10-12T11:35:33.857Z
closed: 2026-10-12T11:35:33.889Z
---

## Open question

Done nodes are drawn in the same dim grey as backlog, so only the glyph tells them apart. Container nodes show no done/total of their children (observation 8). To decide: a done colour or a strike, and how containers carry their children's progress. Relates to spec §3.15 and §3.11.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:32.618Z

Decided (2026-10-12, round 2): a done node keeps a readable title: green filled glyph, title in a done colour (green-tinted, dimmer than live text), not the backlog grey, no strikethrough; container nodes carry done/total of their children and the count in work where task nodes carry the criteria fraction; the same colour rule for done rows in the panel and on the board. Recorded in docs/spec/v0.1.2.md §3.3.

### human · 2026-10-12T11:35:33.857Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.3; built by T-276 The explorer and the card
