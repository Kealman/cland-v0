---
id: T-329
kind: task
title: "The release scope: the items panel at release scope lists only the release's own items, and the count line leads to the categories and the unscheduled items under all"
state: open
status: backlog
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-270
blocked_by: []
topic: null
branch: null
created: 2026-10-13T14:04:09.323Z
updated: 2026-10-13T14:04:09.323Z
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

- [ ] C1. A Neovim headless test on the stub hub at release scope under `board` shows no row of a category's item and no unscheduled fold. The last row reads `categories <N> · <M> open · unscheduled <K>`, with N, M and K right for the fixture. The `work` and `done` filters show no such row either.
- [ ] C2. With no unscheduled item the line drops its unscheduled part. With no open category it shows only `unscheduled <K>`. With neither it is absent.
- [ ] C3. Enter on the count line switches the panel to `all` with the cursor on the line. The categories section and an `unscheduled (K)` fold follow it, and `za` unfolds the unscheduled items.
- [ ] C4. A task event that gives an unscheduled task a parent under the release shows the task at release scope and lowers K by one. The test waits on that state.
- [ ] C5. With no open release, the panel shows today's unscheduled view.
- [ ] C6. `nvim/README.md`'s items panel section describes the release scope, the count line and the `all` sections.
