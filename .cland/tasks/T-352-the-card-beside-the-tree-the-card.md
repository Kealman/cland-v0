---
id: T-352
kind: task
title: "The card beside the tree: the card follows the cursor with the summary, its provenance line and the facts, Enter focuses it, gi opens the explorer on the item, and gI keeps the v0.1 item view"
state: open
status: backlog
size: L
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-351
topic: null
branch: null
created: 2026-10-13T20:53:51.618Z
updated: 2026-10-13T20:53:53.847Z
---

## Summary

The explorer gains its right part. The card of the row under the cursor shows the path, the title, the summary (written or by the T-258 fallback, with a dimmed provenance line) and the facts, and it follows the cursor after about 100 ms. Enter focuses the card and `h` or `␣␣` returns. `gi` now opens the explorer with the card on the item, and `gI` and the palette keep the v0.1 item view.

## Parent

E-276: The explorer and the card, tracer bullet 1 (the first card) and the `gi` and `gI` keys of §3.8. Spec: `docs/spec/v0.1.2.md` §3.8 (Keys and place, the prototype's answers: `l` on a leaf, `gI`) and §3.9 (Summary, The card, Place, the accepted mockups T-260). Q-258 decided the summary rule. Prototype: `explorer_card.lua`, `explorer_summary.lua` and `explorer.lua` (`card_buf`, `fit_card`, `sync`, `render_card`, `follow`, `focus_card`, `reveal`) on `prototype/explorer`. Boards: `CardTask.dc.html`, `CardEpic.dc.html`. GLOSSARY: Card, Summary.

## What to build

**The summary rule.** Port `explorer_summary.lua` as `nvim/lua/cland/explorer_summary.lua`. It is pure Lua with no state, and keeps the prototype's functions: `sections`, `blocks`, `sentences`, `words`, `summary`, `outline`.

- A `## Summary` section is the summary, marked `written`.
- Else the fallback refined by T-258:
  - the first section that is not Parent, Notes, Sources, References, Acceptance criteria or Definition of done;
  - its first prose paragraph with its leading provenance sentences dropped, or its first list item when it has no prose;
  - trimmed to two whole sentences and 50 words, without a trailing lead-in that ends in a colon.
- The provenance is the section's heading, or nil when the body has none.
- Fenced code never starts a section.
- It runs on the parsed body from `task.view`, never on the raw file.

**The card's window.** A vertical split on the right of the tree, inside the centre region.

- `vim.w.cland_card = true`. The buffer's role is `card`.
- `layout.centre()` never takes it for the centre.
- `layout.apply_view` opens it with the explorer and closes it for any other view, through one `explorer.sync(win)` call.
- Its width is 42 % of the explorer's columns, between 36 and 72, and the tree keeps at least 30.
- A width the human sets with a resize is kept in `ui.json` as `explorer.card_width`. `layout`'s resize bookkeeping does not record the card as a panel size.
- Wrap is off, and the card wraps its own text to its width.

**Following the cursor** (prior art):

- A `CursorMoved` autocmd on the tree buffer starts a 100 ms timer.
- When it fires, the card is drawn for the row key under the cursor, unless that key is the one already shown.
- The card's text and highlights are compared, and the buffer is written only on a change.
- The card's item body comes from `require('cland.item_view').get(id)`: one `task.view` for the item shown, cached, and fetched again when the summary's `updated` changes. While it loads, the card shows the facts it has from the summary and `loading the agents' text…` in place of the summary.
- Holding `j` over twenty rows sends at most one `task.view` per row the cursor rests on for 100 ms, and none per row it passes.

**The card's content in this ticket** (order of the boards; ticket T-354 adds the rest):

1. A header line in the card's winbar: `CARD <id> · <kind> · <glyph> <status>` and the keys that work there (`↵ focus · h back · m message · gt topic · gs session` as they land).
2. The path from the root (`R-228 0.1.2 Working with items › E-270 › S2` with the stage tag of the item's epic plan, from `plan.stage_tag`), then the title in bold.
3. **Summary.** The summary's text. Under it, when it came from the fallback, a dimmed provenance line: `fallback from ## <heading> · no ## Summary yet`. With no text, `no summary`.
4. **Facts**:
   - status: a task's own; a container's derived, with `, derived`;
   - layer: the summary's `layer`; for a container, the highest among its tasks, in the order now, watch, background, archive;
   - labels;
   - size, with `—` when unsized;
   - the parent path;
   - lead: the claim with role `lead`, else the Coordinator's name while `leads` is empty; a task's lead is its claimant;
   - claim, with the session and its role;
   - holds, each with session, role and `since`;
   - for a container, the claims and holds on its tasks, each naming the task;
   - the ordinal within the container: `4th of 10 in E-270`. The raw rank comes in ticket T-354.
5. Virtual rows (`Categories`, `Direct tasks`, …) get a small card naming what they hold, up to 12 item lines.

**Focus.**

- Enter on a tree row focuses the card (P21).
- `l` on a leaf focuses the card.
- In the card, `h` or `␣␣` returns to the tree with the cursor where it was. `␣␣` there is a buffer-local map that shadows the global back.
- `j` and `k` in the card move normally.

**`gi` and `gI`.**

- `motions.go('item')` reveals the item in the explorer with the card on it, in place of `layout.show({ kind = 'item' })`. It opens the current scope when the scope holds the item, else the root view, and unfolds the item's ancestors as a reveal kept apart from the human's folds.
- `gi` inside the explorer and the card works the same.
- `gI` is a new global action, "Open the v0.1 item view", that does what `gi` did before. The palette's item pick keeps opening the v0.1 item view. The action is listed in the palette's actions.
- In the explorer and the card, `gt`, `gs` and `gp` act on the row's or card's item through `motions.context()`.

**Test sweep for `gi`.** Tests and QA cases that use `gi` to reach the item view switch to `gI`, or assert the explorer's card where that is what they mean. Today they are `nvim/test/events.test.ts`, `item-prefixes.test.ts`, `thread.test.ts`, `shell.test.ts`, `graph.test.ts` and `qa/cases/GRAPH-001.lua`; grep for others. Make it one commit inside this ticket.

**Docs.** `nvim/README.md`: the card, the summary rule, Enter, `h`, `␣␣`, and `gi` and `gI` in the Motions section. The help lines: `gi` opens the explorer on the item, and `gI` opens the v0.1 item view. The Modules list names `explorer_card.lua` and `explorer_summary.lua`.

**Demo.** On the stub fixture at 200x50, `␣e`, then `j` onto a task: after about 100 ms the card shows its path, title, summary with the fallback line, and facts. Enter focuses it and `h` returns. `gi` on a task id in General opens the explorer with the card on that task, and `gI` opens the v0.1 item view.

**Out of scope.**

- The progress, plan, verdict, relations, branch and suite, dates, Decision block, `zb`, the raw rank, and the card over the right panel (ticket T-354).
- The composer line and `m` (ticket T-355).
- Changing Enter in the items panel, on the board or in the graph: they keep opening the item view (see the NOTES open point).

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005). The card is a buffer drawn from the item model and the cached `task.view`.
- The card must not cost a hub request per cursor move: only a debounced `task.view` for the item it shows, cached.
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()`. The stub hub's `task.view` returns the scenario item's `body` and `comments`.
- The summary rule gets its own Lua-level tests through `c.lua(...)` on a headless client. They cover:
  - a written `## Summary`;
  - a fallback that skips `## Parent`;
  - dropped provenance sentences ("Found by qa-1 in the demo.");
  - a list item when the section has no prose;
  - the two-sentence and 50-word trim;
  - a trailing colon lead-in;
  - a fenced block holding `## ` lines.
- Tests wait on state, never on a sleep. The debounce test waits for the card's content. Every key goes through the action registry.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. The card follows the cursor: moving onto a task shows its card within the debounce, and moving back onto the same row does not redraw the card. Holding `j` over ten rows sends no `task.view` for the rows passed. The stub hub's frame log shows it.
- [ ] C2. A task with a `## Summary` shows it with no provenance line. A task without one shows the fallback text and `fallback from ## <heading> · no ## Summary yet`. The summary unit tests pass on the seven cases.
- [ ] C3. The facts show a task's status, layer, labels, size, parent path, lead, claim and holds with roles, and the ordinal `Nth of M in <container>`. An epic's card shows its derived status with `, derived`, the highest layer of its tasks, and the claims and holds on its tasks.
- [ ] C4. Enter and `l` on a leaf focus the card, whose winbar lists its keys. `h` and `␣␣` in the card return to the tree with the cursor unchanged.
- [ ] C5. `gi` on an id in a thread opens the explorer with the card on that item and its ancestors unfolded. The human's folds in `ui.json` do not change. `gI` and the palette's item pick open the v0.1 item view.
- [ ] C6. The card's width is 42 % of the explorer within 36 to 72 columns. A resize is kept in `ui.json` as `explorer.card_width`, and the card closes when another centre view opens.
- [ ] C7. The swept tests and `qa/cases/GRAPH-001.lua` pass with `gI` or with card assertions. `npm run test:nvim` is green.
- [ ] C8. `nvim/README.md`, the help lines and the Modules list describe the card, the summary rule, `gi` and `gI`.
- [ ] C9. The human's picture comes first. The card opens with the summary and the facts, never with the agents' Markdown body. The body is not drawn in this ticket; ticket T-354 adds it folded behind `zb` (spec §3.9, T-244).
