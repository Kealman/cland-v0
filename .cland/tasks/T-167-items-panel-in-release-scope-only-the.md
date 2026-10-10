---
id: T-167
kind: task
title: "Items panel in release scope: only the release's items; unscheduled holds open orphans only, never done items or other epics' subtrees"
state: closed
status: done
rank: 1170
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-107
blocked_by: []
topic: topic-76
branch: t/T-167-items-panel-in-release-scope-only-the
created: 2026-10-10T09:25:25.219Z
updated: 2026-10-10T10:46:38.884Z
---

## Parent

T-107 (v0.1 release and status). A bug the human reported on the live build, relayed by the stand-in on 2026-10-10.

## What to build

The items panel scoped to the release T-130 also lists:
- the old epics T-19 and T-20, as folded rows;
- an "unscheduled (55)" group that, unfolded, shows closed v0 items (T-1 and its tickets, with done glyphs).

Spec v0.1 §3.1 and §3.2 say release scope works like this:
- It shows the release's own items, in their status sections.
- An "unscheduled (N)" line appears only for open items that reach no release. It is folded, and it never contains done items.
- Other containers' subtrees (T-19, T-20) are not unscheduled items of this release.
- Everything else shows only under the "all" filter.

## Acceptance criteria

- [ ] With the scope set to a release, the panel lists only that release's items in their status sections.
- [ ] "Unscheduled (N)" counts and lists only open items whose parents reach no release; closed and done items never appear in it.
- [ ] Open containers outside the release (T-19, T-20) and their subtrees do not appear in release scope, and do appear under "all".
- [ ] A headless test on a fixture with the shape the human saw (two releases, an old epic with closed tickets, an open orphan) asserts each rule; the 80- and 120-column checks pass.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

High priority: the human's view of the release. Size S to M. T-146 and T-153 touched the vertical board's grouping; keep the panel and the board on one rule where they share it.

## Comments

### impl-167 · 2026-10-10T09:53:43.275Z

Diagnosis at the shared panel/board seam: default 'board' is currently stored as items_filter='all'. Coordinator clarified the fix: separate default board from an explicit all filter; preserve e/E scope cycling. Building the reported two-release/legacy-epic/orphan fixture as a headless regression.

### impl-167 · 2026-10-10T10:00:32.101Z

Fix implemented: board is the default filter (1), explicit all is the ranked tree filter (6), f/F cycle both, e/E unchanged. Shared vboard composition excludes every configured container subtree from unscheduled regardless of closure and admits only open, non-done items. ui.json v1's former all default migrates to board; v2 preserves explicit all. The reported headless fixture is green at 80/120 columns; vboard, changed real-hub item tests, migration/cold-start and configured-level/filter-cycle tests pass. Typecheck passed; full locked Neovim suite is waiting for the existing suite holder.

### rev-8 · 2026-10-10T10:14:30.705Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-167-1
commit: fd6313b4dbe43ad9db1ecb476fa2d6be91fb37e8

Low — nvim/lua/cland/init.lua:281: built-in help still says key 1 is all and omits key 6, so it describes the old filter mapping.

No high or medium findings remain. Standards and Spec reviews are clear. Release membership, orphan-only unscheduled, explicit all tree, shared composition, and UI v1/v2 migration match the requested scope. In-memory Lua probes passed membership, exact-once traversal, migration, and preference preservation. Implementation evidence reports targeted checks/typecheck passing; the full Neovim retry was queued in the evidence reviewed.

Review artifact A-556: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-556-t-167-review-clear-with-one-low-help-text-note.md

### rev-8 · 2026-10-10T10:16:26.835Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-167-2
commit: b401c3367404cf0c88e4cd3bb19625c58db1df63

No findings. nvim/lua/cland/init.lua:281 now matches the implemented numeric filters and f/F cycle: 1 board, 2 in work, 3 needs you, 4 done, 5 map, 6 all. A-556's low help note is resolved. Standards and Spec delta reviews are clear; prior full-item clear carries forward. Read-only inspection; no suites run for this text-only delta.

A-559: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-559-t-167-help-delta-review-clear.md

### coord · 2026-10-10T10:46:38.884Z

Merged 8293adf78dd922cb74e7b6c7cc5a1a3bcc547d6c onto dev.
