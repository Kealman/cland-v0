---
id: T-153
kind: task
title: "Vertical board: a selected scope under an archived release shows as its header and again in the archive group"
state: open
status: backlog
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T06:06:44.959Z
updated: 2026-10-10T06:06:44.959Z
---

## Parent

T-19 (follow-ups). A low note from T-146's review (rev-8-20261010-146-1, A-466).

## What to build

When the vertical board's scope is an open epic under an archived release (pick T-8 under T-2 with `e`/`E`) and the archive and unscheduled folds are open, the epic shows twice: as the scope header and again as a row in the archive group under its release. Decide one presentation: either the scope's own row is left out of the groups below its header, or the header is visibly a label and the row stays. Apply it in the board's grouping, not as a special case in the renderer.

## Acceptance criteria

- [ ] The selected scope reads once on the board, by the chosen rule; a rendered-row test covers T-8 under archived T-2.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

Size S. Low; not a v0.1 prerequisite.
