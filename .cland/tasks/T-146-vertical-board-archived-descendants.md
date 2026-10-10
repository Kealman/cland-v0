---
id: T-146
kind: task
title: "Vertical board: archived descendants duplicate when archive and unscheduled folds are both open; the fraction reads cache internals"
state: open
status: review
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-61
branch: t/T-146-vertical-board-archived-descendants
created: 2026-10-10T03:33:57.937Z
updated: 2026-10-10T06:02:24.857Z
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

## Comments

### impl-146 · 2026-10-10T05:57:42.974Z

Added a minimal real Neovim/stub-hub regression opening archive and unscheduled folds. Targeted command: node --test --test-name-pattern='archived descendants' nvim/test/vboard.test.ts. It fails with the archived child rendered twice. Next: enforce exclusive group membership using open_container_of and move detail freshness behind an item-view accessor.

### impl-146 · 2026-10-10T06:01:58.421Z

Implemented and pushed 9d3cea022a8d67bdbbd60d3ab488f778e4c980c1 to origin; worktree clean. Archive folds now exclude unscheduled descendants using open_container_of, with two real rendered-row regressions. item_view.get owns cache freshness; vboard.fraction reads that accessor and remains the replaceable source for T-112. Node v24.21.0: vertical-board 6/6, typecheck, full locked Neovim suite 190/190 and diff check passed. Evidence: A-459 diagnosis, A-461 suite (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-461-t-146-full-neovim-suite-190-passed.log), A-462 typecheck.
