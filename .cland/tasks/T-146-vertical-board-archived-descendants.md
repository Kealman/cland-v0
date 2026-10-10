---
id: T-146
kind: task
title: "Vertical board: archived descendants duplicate when archive and unscheduled folds are both open; the fraction reads cache internals"
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
created: 2026-10-10T03:33:57.937Z
updated: 2026-10-10T03:33:57.937Z
---

## Parent

T-19 (follow-ups). Two low findings from T-128's review (rev-7-128-1, A-392).

## What to build

1. Duplicate rows on the vertical board: when both the archived-root fold and the unscheduled fold are open, an archived item's descendants appear twice. Each item should appear once; decide by the same "unscheduled = parents reach no open container" rule T-123 uses, so an item under a closed container shows in exactly one group.
2. The verified/total fraction reads the item-view cache's internals. Give the cache a small accessor, or compute the fraction from the item data the board already holds. T-112 will replace the fraction's source with structured criteria, so keep it behind the one replaceable function.

## Acceptance criteria

- [ ] With both folds open, every item appears exactly once; a test covers it.
- [ ] The fraction no longer reads cache internals.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Low; not a v0.1 prerequisite.
