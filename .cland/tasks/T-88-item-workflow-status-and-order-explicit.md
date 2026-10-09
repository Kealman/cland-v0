---
id: T-88
kind: question
title: "Item workflow status and order: explicit fields or derived"
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:41.945Z
updated: 2026-10-09T19:09:41.945Z
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
