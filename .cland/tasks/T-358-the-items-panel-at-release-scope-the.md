---
id: T-358
kind: task
title: "The items panel at release scope: the release's epics as folded rows with done/total and the status breakdown in rank order, an unfolded epic showing its status sections, the epic tab row kept, and Direct tasks (N) after the epics"
state: closed
status: done
size: M
criterion_seq: 7
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-357
topic: topic-219
branch: t/T-358-the-items-panel-at-release-scope-the
created: 2026-10-13T20:53:52.261Z
updated: 2026-10-14T00:06:01.957Z
closed: 2026-10-14T00:06:01.957Z
---

## Summary

At release scope the items panel's board lists the release's epics as folded rows, each with done/total and its status breakdown, in rank order. An epic unfolds into its status sections as the epic scope draws them. The release's direct tasks sit under a folded `Direct tasks (N)` row after the epics. The epic tab row stays for narrowing to one epic, and the categories count line stays at the bottom.

## Parent

E-276: The explorer and the card, tracer bullet 5. Spec: `docs/spec/v0.1.2.md` §3.11 (decided in T-237, and with the mockups on 2026-10-12 for Direct tasks). Built before it: T-329 (the release scope lists only the release's own items, and the count line's unscheduled part) and T-318 (the count line). The colour of done rows comes from ticket T-357.

## What to build

**Where it applies.** The `board` filter at release scope, when `items.scope()` is of the release kind and no epic tab is selected (`vboard.parent_filter()` is nil).

- With an epic tab selected (`p`, `P`, `<Tab>`), the panel shows that epic's status sections as today.
- The `work`, `you` and `done` filters and the layer views keep their flat lists: they cut across epics.
- `all` and `map` are unchanged.

**The epic rows.** In `nvim/lua/cland/vboard.lua`'s `render`, after the scope's header row:

- One row per epic under the release (`items.children(scope.id)` of the level below):
  - the fold glyph ▸ or ▾ and the derived glyph (closed ●, any task in work ◐, any planned ○ in the text colour, else ○ dim, as ticket T-350 derives it);
  - the id and title;
  - on the right, `done/total` over its tasks and the breakdown: the non-zero counts in words, in status order (`1 ◐ · 2 rev · 3 planned · 4 backlog`), cut from the right to fit the panel's width.
- Live epics come in rank order. Closed epics follow in the order they closed (`closed`), in the done colour.
- An epic with a lead claim shows the lead before the fraction, as the scope header does.

**An unfolded epic** shows its status sections as the epic scope does: `IN PROGRESS`, `REVIEW`, `QA`, `READY`, `PLANNED`, then the backlog fold and `DONE`.

- They are indented one level and composed by `vboard.compose` narrowed to that epic, through the same function the tab path uses.
- Empty sections inside an unfolded epic are left out, to keep the panel short.
- The `next` mark stays the release's next planned task, computed over the whole release before narrowing.

**Direct tasks.** After the epics, a folded `Direct tasks (N)` row counts the release's direct tasks, with the same breakdown. Unfolded, it shows their status sections. When the release has no epics, the row is still folded (§3.8, the prototype's answer 1).

**Folds.** Epic rows and the Direct tasks row fold with `za`, `zo`, `zc`, `zR` and `zM`, through `state.S.ui.items_folds` keyed `board:<epic id>` and `board:direct:<release id>`, apart from the `all` tree's folds, which use the bare id. They are folded by default. Enter keeps opening the row under the cursor, epic rows included, as today. `K`, `J` and `T` on an epic row rank the epic among its siblings (`task.rank`), as they do today on any level item.

**What stays.** The epic tab row on top. The header summary (`board · N in work · M done`). The leaves fold (`questions and specs`) and the `more` fold, now inside each epic's sections. The categories count line at the bottom (T-318, T-329) with Enter switching to `all`.

**Docs.** `nvim/README.md`'s items panel section: the release scope's epic rows, the breakdown, Direct tasks, the folds and the tab row.

**Demo** (the epic's tracer bullet 5). The items panel at R-228 lists the release's epics in rank order with their fractions. `za` on one shows its status sections. `Direct tasks (N)` follows the epics.

**Out of scope.**

- The explorer (tickets T-350 to 07).
- Changing the `work`, `you` or `done` filters, or the layer views.
- The centre board (`␣b`): its columns stay.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()`. Extend `nvim/test/vboard.test.ts` (its `categories` scenario already has R-228 with E-269). Add a second epic, a closed epic, a direct task and an epic tab selection.
- Update `qa/cases/PANELS-*.lua` and `ITEMS-*.lua` that assert the release scope's flat sections. A case with a ladder of `["epic"]` has no release scope and is unaffected.
- Redraws stay coalesced once per tick (T-293). The breakdown is computed in the render pass from `state.S.items`, with no hub request.
- Tests wait on state, never on a sleep. Every key goes through the action registry; no new key.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. At release scope under `board`, the panel lists the release's epics as folded rows in rank order with `done/total` and the breakdown, and the closed epic last in the done colour.
  - done: impl-358 · 2026-10-13T21:33:23.674Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.549Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C2. `za` on an epic row shows its status sections indented, without empty sections. `za` again folds it, and the fold survives a hub event.
  - done: impl-358 · 2026-10-13T21:33:24.046Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C3. `Direct tasks (N)` follows the epics, folded, and unfolds into the direct tasks' sections. A release with no epics shows it folded.
  - done: impl-358 · 2026-10-13T21:29:40.777Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C4. Selecting an epic tab shows that epic's sections as before. The `work`, `you` and `done` filters are unchanged.
  - done: impl-358 · 2026-10-13T23:07:57.507Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C5. The categories count line is the last row, and Enter on it still switches to `all`.
  - done: impl-358 · 2026-10-13T21:29:42.551Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C6. `K` on an epic row sends `task.rank` for the epic, and the rows reorder on the `task` event.
  - done: impl-358 · 2026-10-13T21:29:43.137Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31
- [x] C7. The swept QA cases pass. `nvim/README.md` describes the release scope's epic rows.
  - done: impl-358 · 2026-10-13T21:29:43.946Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-2 · 2026-10-13T21:34:12.880Z · commit e89e40a0e4b7827e4d7bc3469ae92aabb72f6840
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-4 · 2026-10-13T23:09:17.318Z · commit 85482c368610f529e3e3206861be6af21dceaf31
  - verified: rev-23 [reviewer] · run rev-2026-10-13-358-5 · 2026-10-13T23:49:19.550Z · commit 85482c368610f529e3e3206861be6af21dceaf31

## Comments

### impl-358 · 2026-10-13T21:29:32.378Z

Implemented folded release epic/direct rows, task summaries, rank/closing order, derived glyphs, nested shared sections and fold keys, Enter/rank behavior and release-wide next. Updated README and PANELS-013/014 expectations. Targeted vboard 23/23 and swept ITEMS-002/PANELS-013/PANELS-014 3/3 pass; typecheck and diff check pass. Implementation evidence is posted in the item topic; full verification follows clear source review.

### rev-23 · 2026-10-13T21:32:42.501Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-358-1
commit: 04330d1ef94e1eae7cafc85dd4f7fd421f2f9d5f
scope: full

Medium — nvim/lua/cland/vboard.lua:376: batch folds modify both namespaces irrespective of the current filter; isolate board/all zR/zM and cover both directions. Medium — nvim/test/vboard.test.ts:327: T-140 is dropped from the unchanged archived-release exclusion guard; restore it (and retain archived child exclusions). C1/C2 failed. No other blocker from the full source review; re-review the corrected head before verification. A-2082: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2082-t-358-full-source-review-fold-namespaces-and-retained-exclusions.md.

Criteria: C1 failed (Restore the existing archived-release T-140 exclusion assertion; its removal weakens unchanged release-scope coverage.), C2 failed (zR/zM modify both bare all-tree and board-prefixed fold keys, so the required independent fold state is overwritten across filters.).

### impl-358 · 2026-10-13T21:33:23.427Z

Addressed A-2082's two source blockers: restored the archived-release T-140 exclusion and explicitly guards T-141/T-142; zR/zM now operate only in the active board/all namespace. Round-trip isolation regression was red before fix and green after; complete vboard file passes 24/24, typecheck and diff check pass. Corrected head pushed for re-review; no full verification run submitted yet.

### rev-23 · 2026-10-13T21:34:12.880Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-358-2
commit: e89e40a0e4b7827e4d7bc3469ae92aabb72f6840
scope: full

No remaining high or medium findings. Archived release/children exclusions are retained; batch folds now affect only the active board/all namespace, covered by both-direction open/close round trips red then green (A-2083). Prior full review A-2082 remains applicable. C7 verified from README and swept QA evidence; C1–C6 await exact-head cland verify. A-2084: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2084-t-358-corrected-full-source-review-at-e89e40a.md.

Criteria: C7 verified.

### impl-358 · 2026-10-13T21:34:50.208Z

Corrected source review rev-2026-10-13-358-2 is clear at e89e40a0 (A-2084); C7 verified, C1–C6 await exact-head verification. Per Coordinator clarification of the no-holder line, enqueued cland verify nvim run de9f942f-26f4-4216-9045-bdd7b0820b28 at queue position 3, addressed to rev-23/impl-358, with no force. Holding the reviewed head unchanged until its hub result.

### rev-23 · 2026-10-13T23:06:46.376Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-358-3
commit: e89e40a0e4b7827e4d7bc3469ae92aabb72f6840
scope: evidence

Medium — nvim/lua/cland/vboard.lua:375–390: zR selects release-board fold keys for the active plan panel; layers.test.ts:389 fails after zR. Honor plan.panel_id and retain that regression unchanged.
Medium — nvim/test/layers.test.ts:322/353; plan.test.ts:271; shell.test.ts:1302; thread.test.ts:513: five descendant-row waits need navigation through the new folded outer groups, retaining all assertions.
A-2115 full run failed 6 tests (1848/1854), exit 1; typechecks/hub phases pass, no skips/cancellations. C4 failed; other run-dependent criteria remain pending. Source fix/adaptation needs a new source review before verification. A-2116: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2116-t-358-failed-full-evidence-plan-fold-regression-and-five-folded-row-waits.md.

Criteria: C4 failed (Batch-fold dispatch updates release-board keys while the plan panel is active, regressing its existing background section behavior (layers.test.ts:389).).

### impl-358 · 2026-10-13T23:07:56.923Z

Diagnosed A-2115/A-2116: one product regression (plan panel zR dispatched to release-board folds), five legitimate outer-group navigation updates. M.fold now honors plan.panel_id first; the plan-layer test remains unchanged and passes. Updated five tests only to open their corresponding epic/direct group; all assertions retained. Layers 14/14, vboard 24/24 and affected plan/shell/thread 1/1 each pass; typecheck/diff check green. Corrected head pushed for source re-review before a new hub run; integrated dev control remains running.

### rev-23 · 2026-10-13T23:09:17.318Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-358-4
commit: 85482c368610f529e3e3206861be6af21dceaf31
scope: full

No high or medium findings. Active plan.panel_id now selects the plan background fold before release-board namespaces, matching the render dispatch; the original plan-layer test is unchanged and green. Five navigation adaptations open matching outer groups while preserving all assertions and existing snapshot readiness. Full original source scope A-2084 retained. C7 QA/docs refreshed from unchanged evidence; C1–C6 await new exact-head cland verify. Failed A-2115 is not green evidence. A-2118: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2118-t-358-corrected-full-source-review-at-85482c36.md.

Criteria: C7 verified.

### impl-358 · 2026-10-13T23:09:34.149Z

Source re-review rev-2026-10-13-358-4 is clear at 85482c368610f529e3e3206861be6af21dceaf31 (A-2118), with C7 refreshed and C1–C6 pending exact-head verification. Submitted fresh cland verify nvim run a3bb9a99-93ba-4a0d-b782-8c45aab7129c, position 2 behind the integrated dev control and T-344, addressed to rev-23/impl-358. Head remains clean and unchanged; going idle for hub result.

### impl-358 · 2026-10-13T23:49:03.149Z

Exact-head verification a3bb9a99-93ba-4a0d-b782-8c45aab7129c passed at reviewed 85482c368610f529e3e3206861be6af21dceaf31: effective full mode, typecheck and 1854/1854 tests green, zero failures/cancellations/skips. Durable log A-2123: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2123-suite-a3bb9a99-93ba-4a0d-b782-8c45aab7129c-nvim-at-85482c3.log. Reviewer received same-head result directly; awaiting final C1–C6 verification. Branch remains clean and unchanged; keeping claim until merge.

### rev-23 · 2026-10-13T23:49:19.550Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-358-5
commit: 85482c368610f529e3e3206861be6af21dceaf31
scope: evidence

No high or medium findings. Exact-head cland verify a3bb9a99 / A-2123 widened to full and passed both typechecks and 1854/1854 tests, zero failures/cancellations/skips/todo. All six formerly failing cases pass, including unchanged active-plan folds and preserved layer/stage/scope/background assertions. Source review A-2118 and retained QA/docs evidence remain applicable. C1–C7 verified. A-2124: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2124-t-358-final-exact-head-evidence-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-14T00:06:01.957Z

Merged a20857a3075fdd68f8d1da3951bb58fc33e23444 onto dev.
