---
id: T-1061
kind: task
title: The items board and the card's progress still count only loaded open children
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1044
topic: topic-808
branch: t/T-1061-the-items-board-and-the-card-s-progress
created: 2026-10-21T14:08:05.830Z
updated: 2026-10-21T14:12:45.502Z
---

## Summary

T-1044 moved the items list rows onto the hub's `child_counts`, but two other workbench surfaces still count from the open-only snapshot: the items board and the item card's progress section. On the human's workbench after restart #38 (14:07Z), the Explorer showed R-377 3/13, E-1006 7/7 and E-415 8/10. At the same time the board showed E-1006 "0/0", E-415 "0/2" and R-377 "0/11", and R-377's card read "0 of 10 done".

## What to build

Every done/total counter in the Neovim workbench reads the hub's `child_counts`:
- the board rows and the board header ("N in work · N done"): nvim/lua/cland/vboard.lua counts `items.children` by state and loaded tasks by status;
- the card's progress section: nvim/lua/cland/explorer_card.lua iterates `members` from the loaded index.

Done items stay hidden where they are hidden today ("done hidden").

## Acceptance criteria

- [ ] C1. A headless test renders the board from an open-only snapshot of a tracker with closed children and reads each container's done/total equal to `child_counts`, header included.
- [ ] C2. A headless test renders a release's and an epic's card progress from the same snapshot and reads done, in-progress, backlog and blocked counts that include closed children.
- [ ] C3. A search of nvim/lua for other done/total or "of N done" counters finds none left counting loaded children; any found are moved too and listed in the item topic.

## Comments

### impl-1061 · 2026-10-21T14:12:45.502Z

C1/C2 test-first at the headless Neovim rendered board/card seams. Red board output: release 0/4 instead of 1/4, mixed epic 0/3 instead of 2/5, completed epic 0/0 instead of 2/2. Red card release: 0 of 3 done instead of 1 of 4. Both targeted tests now pass on the working tree (local Darwin arm64); recorded-frame maintenance is pending. C3 audit additionally found Explorer category open/done and scoped release task-detail counters, plus board direct-task group totals unavailable from current hub aggregates; implementing Coordinator's direct-child/level-label decision.
