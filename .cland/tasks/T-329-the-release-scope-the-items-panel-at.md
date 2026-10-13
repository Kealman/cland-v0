---
id: T-329
kind: task
title: "The release scope: the items panel at release scope lists only the release's own items, and the count line leads to the categories and the unscheduled items under all"
state: open
status: in progress
criterion_seq: 6
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-270
blocked_by: []
topic: topic-204
branch: t/T-329-the-release-scope-the-items-panel-at
created: 2026-10-13T14:04:09.323Z
updated: 2026-10-13T14:59:48.765Z
---

## Summary

At release scope the items panel lists only the release's own items. The unscheduled fold leaves the release scope. The count line at the bottom counts the categories and the unscheduled items, and Enter on it opens the `all` filter, where both are listed.

## Parent

E-270: Status, fields and instrumentation. Spec: `docs/spec/v0.1.2.md` §3.2 (the release scope shows only the release's own items) and §3.11 (one count line at the bottom). Decided in T-237 and T-238. Mockups: `docs/design/main-screen/Categories.dc.html` and `ItemsBoard.dc.html` (the line `categories 23 · unscheduled 3`).

## What to build

**The release's own items.** In `nvim/lua/cland/vboard.lua`:

- `M.compose` stops collecting `out.unscheduled` when a scope exists. Only items under the scope reach the status sections, the backlog fold, the leaves fold and the "more" fold.
- `M.render` drops the `unscheduled` fold at release scope. `M.summary` counts only the scope's items.
- With no open release, the panel keeps today's unscheduled view under its `no open container: unscheduled` header.
- No item of a category and no unscheduled item shows at release scope under the `board`, `work` and `done` filters.

**The count line.** `M.categories_line` in `nvim/lua/cland/items.lua` gains the unscheduled count.

- It reads `categories <N> · <M> open · unscheduled <K>`. A part with a zero count is left out. The line shows when either count is nonzero.
- K counts the open, not-done items with no parent that are not levels, as `items.unscheduled` defines them.
- It is computed in the render pass from `state.S.items`, with no new hub frame.

**Enter on it.** Enter on the count line keeps its action from T-318 (`items.show_categories` through `panels.lua`). It switches the panel to `all` with the cursor on the line.

**Unscheduled under `all`.** In `M.render` of `items.lua`, under the `all` filter at release scope, the unscheduled items leave the tree walk's loose roots. They group into an `unscheduled (K)` fold after the categories section. `za` folds it through the existing fold keys and the `unscheduled` key of `state.S.ui.items_folds`.

**Fixtures.** `nvim/test/stub-hub.ts` carries a release with an epic and tasks, a category with open items, and two unscheduled tasks, if its fixtures lack any of them.

**Docs.** `nvim/README.md`'s items panel section describes the release scope, the count line with its unscheduled part and the `all` sections.

**Demo** (the epic's words). The headless workbench at the current release shows no Tech debt row and no unscheduled fold, and the `all` filter shows both.

**Out of scope.**

- The release's epics as folded rows with done/total, and "Direct tasks (N)" (§3.11, E-276).
- The explorer's roots for categories, unscheduled items and other releases (E-276).
- The layer views on `gn`, `gw`, `gb` and `gA`. They list layers across every container and stay as they are. See the README's open points.
- Any hub change.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- The Neovim UI is tested headless on the stub hub (`nvim/test/stub-hub.ts`), read with `screenstring()`. A Neovim-only delta needs `npm run test:nvim` green.
- The frame protocol comes first for any hub fact the panel reads. This ticket reads only fields the hub already sends.
- No new seams inside the hub. Helpers stay out of `hub/test/harness.ts`.
- A test that reads `hub.log` or `journal.jsonl` waits on the `flushLogs` barrier (T-291). This ticket reads neither.
- The panel's redraw on hub events is coalesced once per tick (T-293). The count line walks `state.S.items` once per render, with no per-row hub request.
- Panel tests wait on state, never on a sleep.
- Every key goes through the action registry (`nvim/lua/cland/actions.lua`).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25). Run suite-weight work only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. A Neovim headless test on the stub hub at release scope under `board` shows no row of a category's item and no unscheduled fold. The last row reads `categories <N> · <M> open · unscheduled <K>`, with N, M and K right for the fixture. The `work` and `done` filters show no such row either.
  - done: impl-329 · 2026-10-13T14:37:24.558Z
- [x] C2. With no unscheduled item the line drops its unscheduled part. With no open category it shows only `unscheduled <K>`. With neither it is absent.
  - done: impl-329 · 2026-10-13T14:37:24.979Z
- [x] C3. Enter on the count line switches the panel to `all` with the cursor on the line. The categories section and an `unscheduled (K)` fold follow it, and `za` unfolds the unscheduled items.
  - done: impl-329 · 2026-10-13T14:37:25.297Z
- [x] C4. A task event that gives an unscheduled task a parent under the release shows the task at release scope and lowers K by one. The test waits on that state.
  - done: impl-329 · 2026-10-13T14:37:25.627Z
- [x] C5. With no open release, the panel shows today's unscheduled view.
  - done: impl-329 · 2026-10-13T14:37:25.941Z
- [x] C6. `nvim/README.md`'s items panel section describes the release scope, the count line and the `all` sections.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-329-1 · 2026-10-13T14:37:01.795Z · commit c7aff82ccd4a8c8fb896291d49be922414f0b214
  - done: impl-329 · 2026-10-13T14:37:26.239Z

## Comments

### impl-329 · 2026-10-13T14:28:42.388Z

Implemented and pushed c7aff82c. Scoped board/work/done exclude loose roots; the live category count line adds unscheduled K; Enter reaches all with loose roots folded after categories. Layer views stay global. Focused headless tests passed: vboard 20, shell 84, real-hub items 4, PANELS-012/013 2, plus the zero-open-part case. Source review requested before full verification (D25).

### rev-23 · 2026-10-13T14:37:01.795Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-329-1
commit: c7aff82ccd4a8c8fb896291d49be922414f0b214

No high or medium source findings. Scoped board/work/done exclude loose roots; live N/M/K count parts, all loose-tree fold, Enter/cursor, parent-event transition and no-scope fallback match the spec; global layer views remain. Adapted tests retain their rank/glyph/map/fold/state guarantees. C6 docs verified. C1–C5 final runtime verification awaits the complete exact-head run under D25. task.view currently has no done marks; the Implementer must post its own. Evidence A-1966: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1966-t-329-source-review-clear-at-c7aff82-scoped-rows-and-loose-item-navigation.md.

Criteria: C6 verified.

### rev-23 · 2026-10-13T14:52:08.689Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-329-2
commit: c7aff82ccd4a8c8fb896291d49be922414f0b214

Complete verification is not clear: A-1974 passed 1471/1472 hub tests but failed hub/test/opencode-adapter.test.ts:250 waiting for two fake changing catalogs within 5000ms; Neovim never ran. No T-329 hub delta or product criterion failure is inferred, so no criterion is failed from this inherited partial run and C1–C5 remain unverified. Diagnose under the shared-fix rule without weakening deadline/fallback assertions; changed heads require new source review. A-1966 source assessment remains applicable. Evidence A-1976: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1976-t-329-final-run-not-clear-inherited-opencode-catalog-wait.md.

### impl-329 · 2026-10-13T14:59:48.765Z

Full run c109c331 failed an inherited hub readiness bound before Neovim (A-1974), peak 1m load 22.84. Coordinator-directed isolated comparisons passed opencode-adapter.test.ts 19/19 three times each at dev 87b9fbe and head c7aff82c; the case alone passed too. No fixed-wait race or isolated failure found; no source edits. Reported as Tech debt for C-216. Evidence A-1978 contains six whole-file logs and summary. Full verification awaits E-269 QA's machine-priority hold being lifted; source remains c7aff82c.
