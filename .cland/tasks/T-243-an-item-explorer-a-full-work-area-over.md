---
id: T-243
kind: task
title: "An item explorer: a full work area over the item tree in the centre"
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
created: 2026-10-11T17:49:02.317Z
updated: 2026-10-12T11:35:34.015Z
---

## Open question

The side panel is for real-time status. The human wants a centre work area to study and plan items: release, epics and tasks, with folding and drill-down, status breakdowns, rank, plan, criteria, and done items visible (observation 9, the frame for observations 1, 3, 6, 7 and 8). Needs a design grilling. Relates to spec §3.1, §3.11, §3.13 and §3.15.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T09:12:26.906Z

Decided (2026-10-12, round 3): the explorer is an outline tree in the centre with in-place folding (not columns), root = the current release, folded roots for categories, unscheduled and other releases; l/h and za fold, j/k move, the card follows the cursor and Enter focuses it, s rescopes with breadcrumbs, ␣␣ back; rows per level with counts and bars; live items by rank then done items in the done colour, D hides done; ␣e opens it and it is the centre at startup, gi opens it on the item; read-only: the one action is a quick message to the Coordinator in the item's topic (the human: hand edits would add chaos). Recorded in docs/spec/v0.1.2.md §3.8; mockups and prototype are tickets of map T-264.

### human · 2026-10-12T11:35:34.015Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.8; built by T-276 The explorer and the card
