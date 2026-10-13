---
id: Q-88
kind: question
title: "Item workflow status and order: explicit fields or derived"
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: M-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:41.945Z
updated: 2026-10-09T19:30:59.113Z
closed: 2026-10-09T19:30:59.116Z
---

## Question

Is an item's workflow status an explicit field or derived by fixed rules, and how are items ordered and prioritised within a parent?

## Context

Items have two states, open and closed. The board derives its columns from claims, verdicts and labels (`nvim/lua/cland/items.lua`): closed is done; a clear review or label `qa` is qa; a review not clear or label `review` is review; claimed is in progress; assigned is planned; else backlog. The "in work" filter selects claimed or assigned items only, so an item between review and QA vanishes (the bug item named in the map's Notes). Nothing stores order: lists follow id. The human wants the left panel to read as a vertical board (in progress, review, QA, next planned; done hidden), to mark items as priority so the Coordinator takes them next, and done items of closed epics gone from the board.

## To decide

- An explicit `status` field (backlog, planned, in progress, review, qa, done: who may set each, how claims, verdicts and close move it, what the hub validates) versus derived status with fixed rules written down; the tracker file format change if any (ADR 0002 keeps files the source of truth).
- A `rank` (order within the parent) and/or a priority mark: how the human sets it from the items panel, how the Coordinator's clause reads it ("next unblocked item by rank"), what `cland task` gains.
- The definition of every items panel filter and board column in those terms, and what the merge gate reads.
- GLOSSARY entries: Status, Rank or Priority.

Record the resolution as a comment, the spec section in `docs/spec/v0.1.md`, the GLOSSARY update, and update the bug item with the decided fix.

## Comments

### human · 2026-10-09T19:30:53.849Z

Resolution (2026-10-09, the human accepted every point).

- Tasks get an explicit `status` field: backlog (default), planned, in progress, review, qa, ready, done. State stays open/closed. Containers show children's progress instead; questions and specs have no status. Blocked is a glyph over any status.
- The hub moves status on events: Implementer claim gives in progress, Reviewer claim review, QA claim qa, a not-clear verdict in progress, sufficient clear verdicts ready, merge or close done, reopen backlog. The Implementer sets review on handover; the Coordinator and the human may set any status; other sessions' manual edits are refused.
- A sparse integer `rank` orders siblings (tasks, and epics within a release). `cland task rank T-n --top|--before|--after`; panel keys move items; lists sort by rank then id; the Coordinator takes the lowest-ranked unblocked planned task of the current release. No priority flag; the `high` label retires.
- "In work" is planned through ready; "done" is the current release's done tasks; board columns are the statuses; the vertical board shows in progress, review, qa, ready, planned, folds backlog, hides done.
- The merge gate is unchanged; `ready` is informational.
- T-80 is fixed by the "in work" definition; a stopgap (pending verdict or `qa-required` label counts as in work) is acceptable before then.
- GLOSSARY: Status, Rank. ADR 0002 unchanged.

Recorded in docs/spec/v0.1.md §3.2 and GLOSSARY.md.

### human · 2026-10-09T19:30:59.113Z

Resolved: see the resolution comment; spec v0.1 §3.2
