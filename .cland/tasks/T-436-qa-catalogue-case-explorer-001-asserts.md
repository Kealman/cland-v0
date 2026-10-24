---
id: T-436
kind: task
title: QA catalogue case EXPLORER-001 asserts the lead column at a width where the explorer hides it
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: null
branch: null
created: 2026-10-14T18:29:15.523Z
updated: 2026-10-24T06:46:23.119Z
---

## Summary

The catalogue case EXPLORER-001 asserts `coord` in the explorer buffer with the card open at 200x50. The tree then has 85 content columns, and nvim/lua/cland/explorer.lua:397–402 shows the lead column only from 118. The product is right. The case should assert lead only when the tree is wide enough, or open the card after the lead check. Seen in E-276 QA run qa-2026-10-14-27-10 (A-2507). Its assertions after `coord` were not reached.

## Acceptance criteria

- [ ] C1. EXPLORER-001 passes at 200x50 with the card open, and still checks the lead column at a width of 118 tree columns or more.
