---
id: T-1074
kind: task
title: Scope, selection and messages to the Coordinator in the Items area
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: null
branch: null
created: 2026-10-21T17:32:16.621Z
updated: 2026-10-21T17:32:16.621Z
---

## Summary

Scoping, selection, the messages to the Coordinator and item ids as links in the Items area.

## Parent

E-416 (§3.4, v0.1.2 §3.8; tracer step 3).

## What to build

`s` scopes to a node with breadcrumbs and a back stack, and `␣␣` goes back. `x` toggles a row into the selection, Shift with `j` or `k` extends it, and Esc clears it. `m` opens the card's one-line quick message to General, with the item's context. `M`, or the switch beside the field, sends to the item's topic and creates it when missing. `m` on a selection sends one message to General with one line per item. `gi`, `gt` and `gs` jump, and an item id in any text opens the item with its ancestors unfolded.

## Acceptance criteria

- [ ] C1. Three selected rows and `m` deliver one message to General naming the three items by display id, as a fake Coordinator receives it (Web test with the fake harness).
- [ ] C2. `M` on an item without a topic creates its topic and sends there (Web test).
- [ ] C3. `s`, the breadcrumbs, `␣␣` and item-id links behave as described (Web test).
