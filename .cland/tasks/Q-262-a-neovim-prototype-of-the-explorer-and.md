---
id: Q-262
kind: question
title: A Neovim prototype of the explorer and the card on prototype/explorer
state: closed
labels:
  - wayfinder:prototype
assignee: cland-design
parent: M-264
blocked_by:
  - Q-259
  - Q-260
topic: null
branch: null
created: 2026-10-12T09:10:35.904Z
updated: 2026-10-12T11:10:15.216Z
---

## Question

Does the explorer with its card feel right in Neovim on the real v0.1.2 data? A throwaway prototype on the branch `prototype/explorer` (never merged): the outline tree with folding, the rows per level, the card following the cursor, `s` scoping with breadcrumbs and `␣␣` back, `␣e` and `gi`, `D`, the done colour, the quick message to the Coordinator, the categories root; cursor stability through hub updates; cost at the size of the current tracker. The human tries it and its reactions settle the open points the mockups left.

## Comments

### human · 2026-10-12T10:54:49.718Z

The Neovim prototype is on `prototype/explorer` at 58f5c1079cc968807b0e425a51b899e2cacb2d97, pushed to origin and never merged. The details are in `nvim/EXPLORER-PROTOTYPE.md` on the branch. Not closing: the human tries it first.

**Run.** The hub keeps running from the main checkout. Only Neovim loads the prototype's plugin, from its worktree:

```sh
CLAND_EXPLORER=1 \
CLAND_COMMAND='["node","/Users/evgeniyivanov/Projects/cland/v0/hub/bin/cland.ts"]' \
/Users/evgeniyivanov/Projects/cland/v0/.claude/worktrees/agent-a39f9bb122392d461/nvim/bin/cland-nvim \
/Users/evgeniyivanov/Projects/cland/v0
```

- `CLAND_EXPLORER=1` makes the explorer the startup view and sends `gi` from any view into it (§3.8). Without it, dev behaviour is unchanged, and `␣e`, `:Cland explorer` and `gi` inside the explorer still work.
- `CLAND_COMMAND` points the plugin's only CLI use (`cland hub start` when no hub answers) at the main checkout.
- The explorer keeps folds by id, the scope, D, A and the card's width in `.cland/ui.json` under `explorer`. The dev workbench drops that key when it next writes the file.

**Keys.**

- `␣e` or `:Cland explorer [T-n]` opens the explorer, or reveals T-n; any prefix works.
- `j` `k` move between rows and skip label rows.
- `l` unfolds; on an open node it steps into it.
- `h` folds; on a leaf it folds the parent and goes there.
- `za` `zo` `zc` `zR` `zM` toggle, open and close folds.
- `s` scopes to the row, with breadcrumbs in the winbar.
- `␣␣` goes back: scopes are views in the centre's history, and the cursor returns to the node you came from.
- `D` hides done items everywhere; the header counts what it touches.
- `A` shows the closed releases and the closed root items.
- `↵` focuses the card. In the card, `h` or `␣␣` goes back, `zb` shows the agents' text, `m` messages, and `↵` reveals the referenced item.
- `m` on a row, a `V` selection or the card opens the composer: `↵` sends, `S-↵` adds a newline, `Esc` keeps the draft.
- `gi` `gt` `gs` `gp` work from the tree and the card.

**Real.**

- The tree, from `task.list` and task events, with rows per level as §3.8 and the mockups:
  - a release with epics done/total, one cell per epic, and the task breakdown on two lines;
  - an epic with done/total, the status bar, the ◐ rev qa counts, the stage in work and the lead;
  - a task with its claim or the verifier's hold, the latest verdict with its round, and verified/total.
- Live items come by rank, then the done in the order they closed, in #98bfa2.
- An epic with a plan groups its tasks by stage; Direct tasks fold under their release.
- The card follows the cursor after 100 ms, with no work while the item is the same. It shows the §3.9 blocks, and the summary uses rule B of T-258, ported to Lua with the script's exact output on all 267 items.
- `m` sends topic.send to the Coordinator through the plugin's client: one item to its topic, a selection to General, with the scope and one line per item.
- Hub events rewrite the buffer only on a visible change and keep the cursor by id, then the next item, the previous, the nearest ancestor.

**Choices and stubs.**

- T-216 stands in as the one category (C-216). Unscheduled holds the open root items (the map T-264).
- `updated` stands in for the closing time.
- The kind prefix and the stripped titles are display only; messages carry the T- ids with the kind word.
- An item with no topic gets its message in General.
- Columns drop as the tree narrows. The card is 42 % wide, 36–72 columns, until resized.
- The card shows a DECISION block for Resolution and Decided comments (not in §3.9).
- Left out: size, regression_of and a verdict's scope, which the hub does not have. The verify result comes from `hub.status` suites, a connect-time snapshot that usually says none.
- No idle_from mark, no search, no hand edits.

**Measurements.** The live hub, 267 items, headless at 200×50, medians of 30:

- The release root as drawn, 65 rows: 3.1–4.5 ms to build, 0.3 ms to write the buffer.
- Every node unfolded with the closed releases, 278 rows: 9.5–11.6 ms to build, 1.3 ms to write.
- Cards: 0.45–0.9 ms for a task or v0.1.2; 2 ms for an epic or the category; 8 ms for the v0.1 release.
- A refresh of every list plus a redraw gave 6 renders and 0 buffer writes, with the cursor kept.
- 48 `task.view` details were held after the walk.
- ui.json was byte-identical before and after (read-only run), and no message was sent (dry run, sends blocked).
- 10 tests against the stub hub pass: `node --test nvim/test/explorer.test.ts`.

**Open points for T-263.**

1. A release with no epics (v0.1.2 today) shows nothing until Direct tasks (18) is unfolded. Should they start unfolded, and what does "epics done/total" read?
2. At 200 columns with both side panels open, the tree gets 57 columns and the card 41. Should the card take the right panel's place?
3. A message about an item with no topic: General, or create the topic first?
4. Display ids or T- ids in messages until the prefix migration?
5. Keep the DECISION block (closed questions, Decided observations)?
6. Keep the summary's "fallback from ## X" provenance line?
7. Which key for the archive toggle (A)?
8. Should maps sit under Unscheduled or have their own root?
9. Should the header's done count cover the whole view or only the scope?
10. Confirm the keys: `j` `k` skip labels; `h` on a leaf folds the parent; `l` steps in; `s` on a leaf scopes to its parent.
11. Where do the item view's criteria keys, `e` and `L` go once `gi` replaces the item view?
12. On the card, keep the rank number (id × 10 when unset) or only the ordinal?
13. The hub needs a closing time on the summary.
14. The hub needs verified/total in task.list, to save one `task.view` per row.
15. The hub needs the latest verify result per task.
16. The hub needs size, regression_of and a verdict's scope (§3.12).
17. E-230 is closed with its stage S2 still open. Should closing an epic close its stages?
18. Where should the last activity come from: summaries, the journal or the events view?
19. The model is rebuilt on every hub event. That is fine at 270 items; at ten times as many, a dirty check or lazy folds would be needed.

### human · 2026-10-12T11:10:15.078Z

Resolution (2026-10-12). The human tried the prototype (prototype/explorer, ba5bc9c; worktree ../cland-explorer) and accepted it. Answers to its open points: a release with no epics keeps its direct tasks folded; the card takes the right panel's place when the centre is narrow; m sends to General and M creates the item's topic and sends there; the hub supplies the closing time, verified/total in task.list, the latest verify result and the §3.12 fields. The other points decided from the spec: see docs/spec/v0.1.2.md §3.8 and §3.9 (the prototype's answers).

### human · 2026-10-12T11:10:15.216Z

Resolved: prototype accepted; see the resolution comment; spec v0.1.2 §3.8, §3.9
