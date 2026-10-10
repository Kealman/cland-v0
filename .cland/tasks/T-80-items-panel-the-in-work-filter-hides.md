---
id: T-80
kind: task
title: 'Items panel: the "in work" filter hides items between review and QA and planned items'
state: closed
status: done
labels:
  - needs-triage
  - ui
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:08:04.194Z
updated: 2026-10-10T03:09:46.085Z
---

## Observed

The items panel filter "in work" (filter 2) selects open items that are claimed or assigned (`nvim/lua/cland/items.lua`, the filter table). An item loses its claim when the Implementer's work ends and again when the Reviewer releases it, so an item that waits between review and QA, or waits for a reviewer, disappears from "in work" although it is in flight. Items the Coordinator plans next are not assigned to anyone, so they never show either. The human reads "all" instead, where every item of the project piles up.

## Expected

"In work" shows everything in flight: in progress, in review, in QA, and what is planned next; done items stay out of it.

## Note

The proper fix waits on the v0.1 map ticket "Item workflow status and order: explicit fields or derived", which decides whether status is an explicit field or derived by fixed rules. A stopgap that also includes items with a pending verdict or a `qa-required` label is acceptable before that.

## Comments

### human · 2026-10-09T19:31:04.179Z

Decided in T-88: in work = planned, in progress, review, qa, ready, once the explicit status field exists (spec v0.1 §3.2). Until then a stopgap that also counts items with a pending verdict or the qa-required label is acceptable.

### coord · 2026-10-10T03:09:46.085Z

Fixed by T-123 (squash f339516 on dev). The items panel reads the hub's status, and "in work" is planned, in progress, review, qa and ready, so an item under review or between review and QA now shows. T-80's case is a regression test (PANELS-012, together with the stub-hub status tests). Closed by the Coordinator.
