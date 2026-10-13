---
id: T-128
kind: task
title: "The vertical board: the items panel as a board of the current release on
  the hub's status and rank, with sections, folds, the next mark, the epic tab
  row, K, J and T, and e and E with the pick kept in ui.json"
state: closed
status: done
labels:
  - ready-for-agent
  - v0.1
assignee: null
parent: E-109
blocked_by:
  - T-126
  - T-123
topic: topic-54
branch: t/T-128-the-vertical-board-the-items-panel-as-a
created: 2026-10-09T21:57:34.784Z
updated: 2026-10-10T03:41:41.727Z
closed: 2026-10-10T03:41:27.096Z
---

## Parent

T-109 (Workbench basics), slice 5 of 5. Spec §3.11 (The items panel as a vertical board, Glyphs), §3.1 (Tree and scope). Blocked by T-123, the last ticket of T-107, which brings status, rank and the status-aware items panel this rewrites.

## What to build

The items panel becomes a vertical board of the current release, built on the hub's `status` and `rank` with nothing derived.
- **Sections:** in progress, review, qa, ready and planned, each with its count. Backlog and unscheduled are folded (`za`). Done is hidden and counted in the header ("board · 12 in work · 6 done").
- **A row** shows:
  - the status glyph and the id;
  - a dim parent prefix ("E-5 ›") and the title;
  - the claim or the verdict mark: ✗ for a not-clear last verdict, "for Reviewer" while a review is awaited;
  - the dim "verified/total" fraction, green when complete. Until T-112, it counts the checked boxes under `## Acceptance criteria`.
  - ◌ over a planned item with open blockers.
- **The "next" mark:** the first unblocked planned row carries a teal "next" mark.
- **Order:** rows sort by epic rank, then task rank.
- **The tab row** under the header filters by epic.
- **Keys:**
  - `1` to `5` and `f` keep the v0 filters, as the spec says, not the prototype;
  - `K` and `J` move an item among its siblings, and `T` moves it to the top, all through `cland task rank`;
  - Enter opens; `gi`, `gt` and `gs` as everywhere.
- **The scope:** `e` and `E` cycle the open containers, and the pick is kept in `ui.json`.

## Acceptance criteria

- [ ] On the stub hub, `T` on a planned task sends the rank change through the hub, and the row becomes the "next" row from the resulting `task` event.
- [ ] `e` scopes the board to another container, and the choice survives a restart through `ui.json`.
- [ ] Sections, counts, folds, glyphs, marks and order match §3.11, on a fixture covering every status, a blocked item and a not-clear verdict.
- [ ] Every key is registered in the action registry.
- [ ] Headless QA cases cover the board, succeeding `PANELS-001` to `PANELS-004`; `nvim/README.md` documents the board.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M. Implementer: Codex. References: `prototype/panels` (`vboard.lua`, `rank.lua`); mockups `ItemsBoard.dc.html` and `screens/v01-items-board.png`. Precedence: the spec, then the prototype's behaviour, then the mockups. The digit keys follow the spec.

## Comments

### impl-128 · 2026-10-10T03:10:22.909Z

Reading the spec and T-123 foundations. Implementing the vertical items board with hub-only rank updates, persisted container scope, registry actions and stub-hub/headless coverage; thread.lua stays outside this change.

### impl-128 · 2026-10-10T03:16:09.924Z

First vertical-board regression is green: all seven hub statuses, epic-before-task rank, blocked/failed/review marks, criteria fraction, initial backlog/unscheduled folds and colors. Scope cycling survives a cold restart via T-125 ui.json. Adding rank result-only/refusal/event probes and shared centre-board coverage next.

### impl-128 · 2026-10-10T03:29:46.322Z

Committed 8f4d1f680a372ffe642907486d772003adc10a4f (copied from git log -1). Typecheck and affected targeted tests pass. The complete old-assertion replacement audit is A-389 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-389-t-128-implementation-and-complete-assertion-replacement-audit-at-8f4d1f6.md. One root npm test is running on this committed head through the machine suite lock.

### rev-7 · 2026-10-10T03:33:45.936Z

verdict: review
result: clear
by: rev-7 [reviewer]
run: rev-7-128-1
commit: 8f4d1f680a372ffe642907486d772003adc10a4f

Low — nvim/lua/cland/vboard.lua:228: opening both an archived root-container fold and unscheduled renders archived descendants twice, because the root fold collects rows already assigned to unscheduled; confirmed with pinned production Lua.
Low (design heuristic) — nvim/lua/cland/vboard.lua:102: direct detail/stale/seen cache access repeats item-view freshness policy outside its owner (possible Feature Envy); a body accessor would keep fetch/invalidation/failure handling together.

Full 17-file item review clear at 8f4d1f680a372ffe642907486d772003adc10a4f against 0c433b0. Standards and Spec independently have no high/medium findings. Sections/counts, marks/glyphs, criteria fractions, epic-first ordering/next, shared seven-column centre composition, hub-event-only rank/refusal handling, saved scope/fallback, filters, action registry and fitter agree with the brief. No new window-option writes; board wrap stays explicitly local.

A-389 checked against every existing-test delta: no deleted test or weakened behavioral assertion. Exact filters, rank orders, snapshot/event/idempotence and timing checks remain; changed done/fold visibility has explicit replacement checks. Read-only production-source composition probes pass and reproduce the low duplication; diff check passes. No suite or shipped QA case run. Implementer owns full-suite validation.

Evidence: A-392, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-392-t-128-review-rev-7-128-1-at-8f4d1f6.md.

### impl-128 · 2026-10-10T03:41:15.393Z

Implementation complete at 8f4d1f680a372ffe642907486d772003adc10a4f (copied from git log -1), committed/pushed to local origin; clean worktree. One root npm test on this head passed: hub 815/815, Neovim 168/168, zero failures; 721.33s. Full log A-396. Typecheck A-390. Full assertion replacement audit A-389; reviewer accepted it and recorded clear rev-7-128-1 in A-392. Final handover A-397: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-397-t-128-final-implementation-handover-at-8f4d1f6.md. Shared vertical/centre composition, event-only rank, persisted scope, criteria/glyphs/folds/registry/fitting; thread.lua untouched. No merge.

### coord · 2026-10-10T03:41:27.087Z

Merged 5ab1ed171f3d58df90f8544eb4b36201db66e3d2 onto dev.

### coord · 2026-10-10T03:41:41.727Z

Merged by the Coordinator through `cland merge T-128`, after `cland push`: squash 5ab1ed1 on dev. It merged cleanly over T-132, T-138 and T-123.
Gate: review rev-7-128-1 clear on 8f4d1f6 (A-392). Decisions:
- `all` stays inclusive;
- the items panel and the centre board share one hub-backed composition, while the centre board keeps T-123's seven status columns;
- K, J and T go through `task.rank`, with rows reordering from hub events only;
- the scope is kept in ui.json, with a fallback to the current release;
- the fraction function is replaceable until T-112.
Old tree assertions were replaced, not deleted (audit A-389). Root suite on 8f4d1f6: 815 hub and 168 Neovim passed (A-396); handover A-397. The two low findings are filed as T-146. This completes epic T-109's tickets; the epic stays open for the human's demo.
