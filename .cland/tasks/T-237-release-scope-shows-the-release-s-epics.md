---
id: T-237
kind: task
title: Release scope shows the release's epics as rows with a status breakdown,
  and drills down to tasks at epic scope
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
created: 2026-10-11T17:49:00.863Z
updated: 2026-10-12T11:35:33.074Z
---

## Open question

At release scope, the human wants to see which epics are in work and which are planned, as folded epic rows in rank order, each with its fraction and a status breakdown. They also want part of the task level inside each epic. At epic scope, the task sections stay as today. To decide: per-epic rows with counts or a bar, cross-epic status sections, or a hybrid (observations 1 and 7). Relates to spec v0.1 §3.1, §3.2 and §3.11.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T09:12:27.314Z

Decided (2026-10-12, round 3): at release scope the items panel lists the release's epics as folded rows with done/total and the status breakdown in rank order; an unfolded epic shows its status sections as the epic scope does; the epic tab row stays; categories as one count line at the bottom. Recorded in docs/spec/v0.1.2.md §3.11; the full tree lives in the explorer (§3.8, map T-264).

### human · 2026-10-12T11:35:33.074Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.11; built by T-276 The explorer and the card
