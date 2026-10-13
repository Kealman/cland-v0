---
id: T-244
kind: task
title: The item view shows the human's picture first and folds the agents' text
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
created: 2026-10-11T17:49:02.559Z
updated: 2026-10-12T11:35:34.170Z
---

## Open question

The item view shows the whole Markdown body, which is written for agents. The human wants a short description, status, progress, who is on it, the latest verdict and blockers first, with the body folded away (observation 10). To decide: where the summary comes from (a field, the Goal's first sentence, or one an agent keeps), and what the picture holds. Becomes the explorer's detail pane.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T09:12:27.043Z

Decided (2026-10-12, round 3): a ## Summary section of one to three sentences written by whoever creates the item (to-tickets, plan-epic, the clauses, the human), the first paragraph of the first non-Parent section as the fallback; the card shows summary, facts, progress, plan stage, the latest verdict with its reason, relations, dates and last activity, the body behind zb; the card is the explorer's right part and replaces the item view on gi. Recorded in docs/spec/v0.1.2.md §3.9; mockups in map T-264 (T-260).

### human · 2026-10-12T11:35:34.170Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.9; built by T-276 The explorer and the card, with the hub's fields from T-270 Status, fields and instrumentation
