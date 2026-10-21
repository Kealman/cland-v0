---
id: T-1078
kind: task
title: Criteria edits on the card
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1073
topic: null
branch: null
created: 2026-10-21T17:32:17.135Z
updated: 2026-10-21T17:32:17.135Z
---

## Summary

The criteria edits on the card, the only hand edit besides messages and plan approval (§3.5).

## Parent

E-416 (§3.5; tracer step 6).

## What to build

`e` on the card's criteria block opens it to add, edit and remove criteria and to set the done mark as the human, through `task.criterion`. Ids are never reused. Labels and the body stay in Neovim. Nothing in the Items area ranks or moves items by hand.

## Acceptance criteria

- [ ] C1. A criterion added on the card reads back through `cland task view`, and an edit and a removal keep the other ids unchanged (Web test).
- [ ] C2. Setting the done mark records it as the human (Web test).
- [ ] C3. No other field of the item is editable from the web (Web test).
