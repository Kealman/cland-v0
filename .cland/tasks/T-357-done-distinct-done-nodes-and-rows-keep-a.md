---
id: T-357
kind: task
title: "Done distinct: done nodes and rows keep a readable title in the done colour with the green glyph in the graph, the items panel and the board, and container nodes in the graph carry done/total and the count in work"
state: open
status: planned
size: M
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by: []
topic: null
branch: null
created: 2026-10-13T20:53:52.151Z
updated: 2026-10-13T20:54:01.601Z
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

- [ ] C1. `ClandDone` is `#98bfa2`, with Bar and Chip twins. No done title anywhere uses `ClandStrike`.
- [ ] C2. In the graph, a done task node's title cell is in `ClandDone` with ● green. A done node of the release graph keeps its full title.
- [ ] C3. In the graph of a release, an epic node shows `done/total · N in work` from its tasks, and the release node in its parent's graph shows its epics' fraction.
- [ ] C4. In the items panel, a done task's title in the `DONE` section and under the `done` filter is in `ClandDone`. A closed container's title in the `all` tree is too.
- [ ] C5. On the board, a closed item's title is in `ClandDone`.
- [ ] C6. The panel, the board and the graph draw verified/total and `stale` from the summary's `criteria`. No `task.view` reaches the stub hub while they draw.
- [ ] C7. `nvim/README.md` describes the done colour and the container nodes' fraction.
