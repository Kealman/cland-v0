---
id: T-153
kind: task
title: "Vertical board: a selected scope under an archived release shows as its
  header and again in the archive group"
state: closed
status: done
labels:
  - ready-for-agent
assignee: null
parent: E-19
blocked_by: []
topic: topic-62
branch: t/T-153-vertical-board-a-selected-scope-under-an
created: 2026-10-10T06:06:44.959Z
updated: 2026-10-10T06:13:12.616Z
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

## Comments

### impl-153 · 2026-10-10T06:07:22.154Z

Presentation rule: the selected scope appears only in its header; exclude its own row from grouped rows. Adding a rendered regression for open T-8 under archived T-2 with archive and unscheduled folds open before changing grouping.

### impl-153 · 2026-10-10T06:08:20.671Z

Rendered regression first failed with T-8 appearing twice (2 !== 1). Background fold membership now comes from compose().groups, which excludes the selected scope before rendering; the renderer just consumes those lists. All 7 vboard tests pass, including archive/unscheduled membership and E restoring the former scope to its archive group. Running required typecheck and locked test:nvim.

### impl-153 · 2026-10-10T06:11:05.669Z

Implemented and pushed d2cc415780e3d137e76641fe9b8389d3cb05ac9f to origin. The selected scope is excluded from compose().groups and appears only in its header; rendered regression covers T-8/T-2 with both folds open and switching back with E. Node v24.21.0: typecheck passed; locked test:nvim 201/201 passed, none skipped; targeted vboard 7/7 passed. Clean working tree.

### rev-8 · 2026-10-10T06:13:04.348Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-153-1
commit: d2cc415780e3d137e76641fe9b8389d3cb05ac9f

No high, medium or low findings. Scope exclusion is applied in compose().groups; render consumes those lists without rebuilding archive membership. Rendered regression covers T-8 under archived T-2, exact-once fixture membership and E restoring T-8. Independent native production-render metadata probe confirms all items once across T-1→T-8→T-1, with T-9 in archive and T-3 exclusively unscheduled. T-146 grouping rule and fraction accessor remain intact. Standards and Spec clear; git diff --check passed; no suite or edits. A-470: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-470-t-153-review-rev-8-153-1-composed-scope-exclusion-clear.md.

### coord · 2026-10-10T06:13:12.616Z

Merged 9c773104340e631555f0e79f636b34d55adda2c3 onto dev.
