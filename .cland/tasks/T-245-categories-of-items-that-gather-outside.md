---
id: T-245
kind: task
title: Categories of items that gather outside the epics (tech debt, bugs,
  follow-ups, ideas)
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
created: 2026-10-11T17:49:02.803Z
updated: 2026-10-12T11:35:34.344Z
---

## Open question

Agents create such items during work. The human wants to see them per category and to promote them, plan a batch of them, or let the Coordinator take them when idle (observation 11). To decide: a container kind, a field or label with a dedicated view, or both, plus the lifecycle, and how this replaces the tech-debt label and the T-216 stand-in (D20).

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T09:12:27.177Z

Decided (2026-10-12, round 3): a root-level container kind category in [tracker] levels; the migration seeds Tech debt (from T-216), Bugs, Follow-ups, Ideas; agents file with --parent C-n as the clauses say; the explorer shows categories as a root section with counts; promotion is a message to the Coordinator (move, rank to top, plan these); the Coordinator takes category work by rank when the release has nothing unblocked, from crew.toml idle_from (empty = never); the tech-debt label retires; an item in a category is not unscheduled. Recorded in docs/spec/v0.1.2.md §3.10 and GLOSSARY (Category, Unscheduled).

### human · 2026-10-12T11:35:34.344Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.10; built by T-269 Prefixes and categories (the hub side) and T-276 The explorer and the card (the Neovim side)
