---
id: T-1044
kind: task
title: The explorer counts only open children, so closed epics show 0/0 and live epics undercount
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1007
topic: topic-796
branch: t/T-1044-the-explorer-counts-only-open-children
created: 2026-10-21T11:16:47.594Z
updated: 2026-10-21T11:29:11.045Z
---

## Summary

Since T-1007 the Neovim explorer's startup read is `task.list projection=summary state=open` (nvim/lua/cland/init.lua:237). Closed items arrive only through `load_closed_items` (init.lua:207), which runs on demand from the archive view. Until then `explorer.index()` builds `kids` from open items, so `container_cols` (explorer.lua:542) and `right_of` (items.lua:496) count only open children.

On the human's live workbench (2026-10-21 ~10:0xZ) E-412 showed "3/4" with 13 tasks and 9 closed. E-1006 showed "0/0" with 5 closed tasks. E-789 and E-795, closed and green, showed "0/0". The human asked whether this is a bug from the speed fix. It is.

## What to build

Container rows show correct done and total counts without loading every closed item at startup. The hub's summary projection carries, for each container (release, epic, category), its child counts by state, computed server-side from the tracker index: at least done, total and the in-review count the row shows. The explorer renders container columns from those counts, and the first payload stays within T-1007's and T-1038's byte budgets. Expanding a container still loads its closed children on demand, as today.

## Acceptance criteria

- [x] C1. On a fixture with an epic of 13 tasks, 9 of them closed, and a fully closed epic of 5 tasks, the explorer's first render shows "9/13" and "5/5" (or the established format with those numbers) before any closed item is loaded (T2 test).
  - done: impl-1044 · 2026-10-21T11:26:42.272Z
- [x] C2. The summary projection carries per-container child counts by state, and `task.list projection=summary state=open` stays within the startup byte budget on the 1,000-item fixture (test, guard from T-1038).
  - done: impl-1044 · 2026-10-21T11:26:42.299Z
- [x] C3. A task changing state updates its container's counts through the existing task events, with no full re-read (test).
  - done: impl-1044 · 2026-10-21T11:26:42.312Z
- [x] C4. The existing explorer, explorer-card and startup-budget Neovim tests pass.
  - done: impl-1044 · 2026-10-21T11:26:42.324Z

## Comments

### impl-1044 · 2026-10-21T11:26:42.337Z

Implemented at ca876d130778622aed9818a7f3654da6a2894ff5 (tree c4a1e585706041e2cc38f0a7e76f89c16fa922a5), pushed to origin. Full-index child_counts feed both Neovim progress views; parent task events keep current/former ancestor counts fresh. Test-first regressions and targeted receipts are in A-8332, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8332-t-1044-implementation-and-targeted-evidence.md. Local darwin/arm64 targeted tracker 11/11, explorer-component 21/21, explorer-card-component 15/15, items 5/5, explorer-card 1/1, explorer 2/2 and startup-budget 4/4 passed; npm run check passed (test lint report-only, 0 refusals). Startup hard bounds passed at 38.604 ms and 67,813 bytes; 1,000-item summary guard 42,666 bytes. No whole-suite receipt yet; requesting source review before mode-free verification.

### rev-23 · 2026-10-21T11:29:11.045Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1044-source
commit: ca876d130778622aed9818a7f3654da6a2894ff5
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards 0 / Spec 0 findings. A-8335 audits 13-file change from fixed base80f8f94c: complete-index child_counts before list filters; sparse status/done/work aggregates preserve release/direct-task conventions and lazy closed rows. Default/summary lists and task events carry counts. Union of previous/current ancestor paths refreshes both parents and release work after child mutations without list re-read. Explorer and Items consume counts with legacy-frame fallback. Public T1 projection/events and observed T2 first-render/update cases retain final assertions and bounded startup payload guard. Wire equality and hub/Neovim/issue-tracker docs match additive behavior. All C1–C4 remain execution-dependent; A-8332 targeted Darwin summaries are supporting evidence, not a queued task pass. Normal mode-free configured verification may proceed at unchanged reviewed head. No Reviewer runtime or source edits.
