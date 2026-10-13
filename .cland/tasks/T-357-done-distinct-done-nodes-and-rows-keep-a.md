---
id: T-357
kind: task
title: "Done distinct: done nodes and rows keep a readable title in the done colour with the green glyph in the graph, the items panel and the board, and container nodes in the graph carry done/total and the count in work"
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
blocked_by: []
topic: topic-218
branch: t/T-357-done-distinct-done-nodes-and-rows-keep-a
created: 2026-10-13T20:53:52.151Z
updated: 2026-10-13T21:21:04.930Z
closed: 2026-10-13T21:21:04.930Z
---

## Summary

Done items stop looking like backlog. A done node or row keeps its title readable in the done colour `#98bfa2` with the green ● and no strikethrough, in the graph, the items panel and the board. Container nodes in the graph (epics in a release graph, releases) carry done/total of their children and the count in work, where task nodes carry the criteria fraction. The panel, the board and the graph read that fraction from the summary's `criteria` counts instead of a `task.view` per row.

## Parent

E-276: The explorer and the card, tracer bullet 6. Spec: `docs/spec/v0.1.2.md` §3.3 (decided in T-242). The summary's `criteria` counts come from T-330, whose out-of-scope list left this switch to E-276. ADR 0005.

## What to build

**The colour.** `nvim/lua/cland/hl.lua`:

- `P.done = '#98bfa2'` and `set('ClandDone', { fg = P.done })`.
- Add `ClandDone` to `TWINS`, so `ClandDoneBar` and `ClandDoneChip` exist for bars.
- The done glyph stays ● in `ClandGreen` (`items.GLYPH.done`, `M.ITEM.closed`).
- Ticket T-350 uses `ClandDone`. If 01 merged first with its own line, drop the duplicate here.

**The graph** (`nvim/lua/cland/graph.lua`, `M.label`):

- A done node draws its glyph ● in `ClandGreen`, its id dim, and its title in `ClandDone`. It no longer dims every chunk. No strikethrough.
- A container node shows `done/total · N in work` from its children on the evidence line, where a task node shows its criteria fraction:
  - an epic counts its tasks;
  - a release node counts its epics, with the in-work count over its tasks;
  - in work means in progress, review, qa or ready.
- The done tray (`d`) keeps its fold.
- `graph-layout.lua` stays unchanged. Today a container node without a verdict has no evidence line, so the new line can make it one row taller. The layout measures the lines `M.label` returns, so check that `graph-layout.test.ts` and `qa/cases/GRAPH-001.lua` still hold, and update their expected screens where a container gains the line.

**The items panel.**

- `items.lua` `row()`: the title of a closed item uses `ClandDone`, not `ClandDim`.
- `vboard.lua` `row()`: a done task's title uses `ClandDone`, in the `DONE` section, the `done` filter and the board's done column.
- Container rows' `done/total` keeps `ClandDim`. Section headings are unchanged.

**The board** (`nvim/lua/cland/board.lua`, `card`): a closed item's title lines use `ClandDone`.

**The fraction from the summary.**

- `vboard.fraction(it)` returns verified, total and stale from `it.criteria` (the summary's `{ total, done, verified, stale, failed }`). It no longer calls `require('cland.item_view').get`.
- `graph.fraction` and the board share it, so the panel, the board and the graph send no `task.view` for their rows.
- The item view and the plan view keep `task.view` for the full criteria.

**Docs.** `nvim/README.md`: the done colour in the items panel, board and graph sections, the container nodes' `done/total · N in work`, and that the fractions come from the summary.

**Demo** (the epic's tracer bullet 6). `␣G` on R-228 shows a closed epic in the done colour with its full fraction, and an open one with its count in work.

**Out of scope.**

- The explorer's rows (ticket T-350, which uses `ClandDone`).
- The items panel at release scope (ticket T-358).
- Strikethrough anywhere: §3.3 rules it out.
- `graph-layout.lua`'s placement.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()`. The colour is checked by reading the extmark or `screenattr` highlight at the title's cell (`synIDattr` of the hl id, or `nvim_get_hl` on the extmark's group), not by eye.
- Extend `nvim/test/graph.test.ts`, `vboard.test.ts` and `items.test.ts`. Update `qa/cases/GRAPH-001.lua` only if it asserts the dim title.
- The stub fixtures' tasks carry `criteria` counts. The board and panel tests check that no `task.view` reaches the stub for a row.
- Tests wait on state, never on a sleep. No new key.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. `ClandDone` is `#98bfa2`, with Bar and Chip twins. No done title anywhere uses `ClandStrike`.
  - done: impl-357 · 2026-10-13T21:00:53.293Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-2 · 2026-10-13T21:04:55.670Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C2. In the graph, a done task node's title cell is in `ClandDone` with ● green. A done node of the release graph keeps its full title.
  - done: impl-357 · 2026-10-13T21:00:53.627Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C3. In the graph of a release, an epic node shows `done/total · N in work` from its tasks, and the release node in its parent's graph shows its epics' fraction.
  - done: impl-357 · 2026-10-13T21:04:05.739Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C4. In the items panel, a done task's title in the `DONE` section and under the `done` filter is in `ClandDone`. A closed container's title in the `all` tree is too.
  - done: impl-357 · 2026-10-13T21:00:54.292Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C5. On the board, a closed item's title is in `ClandDone`.
  - done: impl-357 · 2026-10-13T21:00:54.621Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C6. The panel, the board and the graph draw verified/total and `stale` from the summary's `criteria`. No `task.view` reaches the stub hub while they draw.
  - done: impl-357 · 2026-10-13T21:00:54.933Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
- [x] C7. `nvim/README.md` describes the done colour and the container nodes' fraction.
  - done: impl-357 · 2026-10-13T21:00:55.243Z
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-2 · 2026-10-13T21:04:55.670Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
  - verified: rev-23 [reviewer] · run rev-2026-10-13-357-3 · 2026-10-13T21:20:48.338Z · commit ce98c28a81fd8cff2040199adbcd5d9b90e10ddc

## Comments

### impl-357 · 2026-10-13T21:00:12.816Z

Implemented the done palette/twins, graph node styling and container done/total plus active task counts, closed panel/card titles, and summary-based criteria fractions. Added protocol-boundary headless assertions for highlights and zero row task.view calls; updated stub summaries to native counts while preserving full task.view criteria. Focused graph (16) and vboard (21) tests pass. Running the real-hub items checks next; source review precedes cland verify nvim.

### rev-23 · 2026-10-13T21:03:23.437Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-357-1
commit: a088ecedf6d0fa0c9bf8c92b393df2bbc116257e
scope: full

Medium — nvim/lua/cland/graph.lua:81: hard-coded release/epic child selection violates the configured ladder rule and fails tracker-container-source's Lua guard; renamed kinds fall back to counting all children, including questions/direct tasks. Derive child selection from hub ladder and add a configured-level progress regression. C3 failed. No other source blocker; full verification remains pending a corrected reviewed head. A-2060: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2060-t-357-full-source-review-configured-container-progress.md.

Criteria: C3 failed (Container progress hard-codes release/epic instead of configured ladder kinds; renamed containers count mixed children incorrectly and the source guard rejects it.).

### rev-23 · 2026-10-13T21:04:55.670Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-357-2
commit: ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
scope: full

No remaining high or medium findings. C3 correction derives child kinds from the configured ladder, with task-only completion at the final level; A-2063 shows the mixed-child regression red then green and source guard 3/3. Full source review A-2060 otherwise remains applicable. C1/C7 verified by source; C2–C6 await exact-head Neovim verification. A-2064: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2064-t-357-corrected-full-source-review-at-ce98c28.md.

Criteria: C1 verified, C7 verified.

### impl-357 · 2026-10-13T21:20:25.033Z

Exact-head verification 46e68726-0f63-41b2-995b-07c0dc7cc16b passed at ce98c28a81fd8cff2040199adbcd5d9b90e10ddc: effective full mode, 1851/1851 tests, no failures/cancellations/skips. Log A-2076 is /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2076-suite-46e68726-0f63-41b2-995b-07c0dc7cc16b-nvim-at-ce98c28.log. Reviewer received the same-head result directly; awaiting final C2–C6 verification. Tree remains clean and no tracker-only dev merge was made.

### rev-23 · 2026-10-13T21:20:48.338Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-357-3
commit: ce98c28a81fd8cff2040199adbcd5d9b90e10ddc
scope: evidence

No high or medium findings remain. A-2076 exact-head verification 46e68726 widened to full and passed typecheck plus 1851/1851 tests (Neovim 326/326), with zero failures/skips/cancellations. Done styling, default/configured graph progress and summary-only fraction regressions pass. Same-head source review A-2064 remains applicable. All C1–C7 verified. A-2077: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2077-t-357-final-exact-head-suite-evidence.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-13T21:21:04.930Z

Merged a0ee9575015fca74b3afa1ed2d35c083ee315c42 onto dev.
