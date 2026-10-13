---
id: T-351
kind: task
title: "The explorer's keys: l, h, za, j and k over the visible rows, s rebases the tree with breadcrumbs and ␣␣ goes back, D hides done items and A shows the archived roots, all kept in ui.json"
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
  - T-350
topic: topic-221
branch: t/T-351-the-explorer-s-keys-l-h-za-j-and-k-over
created: 2026-10-13T20:53:51.511Z
updated: 2026-10-13T22:36:26.339Z
closed: 2026-10-13T22:36:26.339Z
---

## Summary

The explorer's outline keys: `l` and `h` unfold and fold, `j` and `k` move over the visible item rows, `s` rebases the tree on a node with breadcrumbs, and `␣␣` returns. `D` hides done items in the whole tree and `A` shows the closed releases and closed root items. The folds, the scope, `D` and `A` live under an `explorer` key in `ui.json`.

## Parent

E-276: The explorer and the card, tracer bullet 1 (second half). Spec: `docs/spec/v0.1.2.md` §3.8 (Form and keys, the prototype's answers). Prototype: `nvim/EXPLORER-PROTOTYPE.md` (Keys table) and `explorer.lua` (`move`, `right`, `left`, `fold`, `fold_all`, `toggle_done`, `toggle_archive`, `scope_here`, `crumbs`, `count_done`, `restore`) on `prototype/explorer`. Prior art: folds keyed by item id, the cursor restored by identity.

## What to build

**The keys** (scope `explorer` in `nvim/lua/cland/actions.lua`, buffer-local maps through `actions.map`):

| Key | What it does |
| --- | --- |
| `j` `k` | Next or previous item row. Label rows are skipped: the column header, the release's breakdown lines and the stage labels. A count works (`3j`). |
| `l` | Unfold. On an open node, step to its first child. On a leaf, nothing here (ticket T-352 makes it focus the card). |
| `h` | Fold an open node. On a leaf or a folded node, go to the parent and fold it. The scope's root never folds. |
| `za` `zo` `zc` | Toggle, open or close the node. On a leaf, act on its parent. |
| `zR` `zM` | Unfold or fold every node of the current view. |
| `s` | Scope to the row: the tree is rebased on it. On a leaf, scope to its container with the cursor kept on the leaf. On a virtual row (`Direct tasks`, a root), scope to it. |
| `␣␣` | Back. Scopes are views in the centre's history (`layout.show` pushes them), so `␣␣` returns to the previous scope with the cursor on the node it came from. From the root it returns to the previous centre view. |
| `D` | Hide or show done items in the whole tree, done epics included. |
| `A` | Show or hide the archived roots: closed releases under `Other releases`, and closed root items under `Unscheduled`. |

**Breadcrumbs.** The explorer's winbar reads the scope's path, for example `R-228 0.1.2 Working with items › E-270 Status, fields and instrumentation`. A virtual scope names its owner (`R-228 › Direct tasks`). The context line in the top bar matches it.

**The done count.** The winbar head ends with the count of done items in the current scope: `done shown · N · D` or `done hidden · N · D`. It counts what `D` touches in the scope, folded nodes included, and not in other roots (the prototype's answer 9, "the header's done count for the current scope").

**`ui.json`.** `nvim/lua/cland/ui.lua` keeps an `explorer` key:

```lua
explorer = {
  folds = { ['E-270'] = true, [':categories'] = false, ... }, -- the human's folds, by item id or virtual key
  scope = 'E-270' | vim.NIL,   -- the scope ␣e reopens
  hide_done = false,           -- D
  archive = false,             -- A
  card_width = vim.NIL,        -- ticket T-352
}
```

- `snapshot()` writes it. `load()` reads it.
- `validate()` checks the shapes. A fold key matches `^%a%-[1-9]%d*$` or `^:`. A value must be a boolean.
- A missing key means the defaults. The file stays `version = 2`.
- `atomic_write` already keeps keys an older workbench does not know, so a dev workbench without this ticket keeps the key.
- A fold for an item the tracker no longer holds is dropped on the next write.
- The `gi` reveal of ticket T-352 is kept apart from the human's folds and never saved.

**The cursor.** A fold, unfold, `D`, `A` or scope change keeps the cursor on its row key when that row is still drawn. Else it goes to the nearest drawn ancestor. Ticket T-359 completes the fallback order for hub events.

**Help and hints.** The status-line hint for the explorer reads `l h fold · s scope · ␣␣ back · D done · A archive`. The README's Explorer section gains the key table. `M.HELP` gains the keys.

**Demo** (the epic's tracer bullet 1, keys). On the stub fixture: `j` `j` `l` unfolds an epic, `s` scopes to it with the breadcrumbs, `␣␣` returns with the cursor on the epic, `D` hides the done tasks and the winbar says how many, and a restart of the workbench (`ui.json` reread) keeps the folds, `D` and the scope `␣e` reopens.

**Out of scope.** The card and `Enter`, and `l` on a leaf (ticket T-352). The messages (ticket T-355). The roots' contents beyond what ticket T-350 lists (ticket T-356). Cursor restoration across hub events (ticket T-359).

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005). Vim folds stay off (prior art).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()`. They go in `nvim/test/explorer.test.ts`. The `ui.json` assertions read the file after `require('cland.ui').flush()`, as `nvim/test/ui.test.ts` does.
- Tests wait on state, never on a sleep. Every key goes through the action registry. A key test in `nvim/test/palette.test.ts` style checks the registry lists the explorer's keys.
- The explorer edits nothing by hand.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [x] C1. `j` and `k` skip the column header, the release's breakdown rows and the stage labels. `3j` moves three item rows.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:03.272Z
- [x] C2. `l` unfolds a node and on an open node steps to its first child. `h` folds an open node, and on a leaf goes to its parent and folds it. `za`, `zo` and `zc` on a leaf act on its parent. `zR` and `zM` unfold and fold the view.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:04.818Z
- [x] C3. `s` on an epic rebases the tree on it with its path in the winbar. `s` on a task scopes to its epic with the cursor on the task. `␣␣` returns to the release view with the cursor on the epic, and `␣␣` from the root returns to the previous centre view.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:05.988Z
- [x] C4. `D` hides done items in the whole tree, done epics included, and the winbar shows the count hidden in the current scope. `A` adds a closed release under `Other releases` and a closed root item under `Unscheduled`.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:08.196Z
- [x] C5. After the debounce, `ui.json` holds `explorer.folds` by id, `scope`, `hide_done` and `archive`. A second workbench started on the same project restores them. An invalid `explorer` value is reported and replaced by the defaults without dropping the rest of the file.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:10.127Z
- [x] C6. The `explorer` actions are in the registry with titles, and `␣?` lists them.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:11.562Z
- [x] C7. `nvim/README.md`'s Explorer section has the key table, and the help line lists the keys.
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-1 · 2026-10-13T22:04:04.156Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - verified: rev-23 [reviewer] · run rev-2026-10-13-351-2 · 2026-10-13T22:35:43.865Z · commit 4abd56dd6680c02b067d6579d75113faee054ee6
  - done: impl-351 · 2026-10-13T22:36:12.988Z

## Comments

### impl-351 · 2026-10-13T21:57:13.738Z

Navigation/scoping/filter slices now pass targeted headless tests: counted j/k skip labels, l/h and z folds preserve row/ancestor, s + breadcrumbs with pop-back centre history, D across all roots, A archived roots, scope-only done counts independent of folds/filter. Adding ui.json persistence/validation and help.

### rev-23 · 2026-10-13T22:04:04.156Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-351-1
commit: 4abd56dd6680c02b067d6579d75113faee054ee6
scope: full

No high or medium findings on Standards or Spec. Outline movement/folds, immutable scope roots, breadcrumbs/history, D/A and scope counts, independently validated saved preferences and registry coverage match C1–C7. Existing assertions remain strong. C7 source-verified from README/help; C1–C6 await exact-head cland verify. A-2097: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2097-t-351-full-source-review-at-4abd56dd.md.

Criteria: C7 verified.

### impl-351 · 2026-10-13T22:04:21.335Z

Source clear rev-2026-10-13-351-1 at exact 4abd56dd6680c02b067d6579d75113faee054ee6 (A-2097), C7 verified. Submitted cland verify nvim after source verdict: df95412b-01dd-4d49-84dd-651e75970cd9; topic-221, rev-23, impl-351. Queue position 2 / worker null at submission. Tree clean; awaiting hub result and Reviewer final verdict.

### rev-23 · 2026-10-13T22:35:43.865Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-13-351-2
commit: 4abd56dd6680c02b067d6579d75113faee054ee6
scope: evidence

No high or medium findings. Exact-head cland verify df95412b / A-2101 widened to full and passed both typechecks and 1867/1867 tests, zero failures/cancellations/skips/todo. All 13 explorer cases pass including counted keys, scopes/Back, D/A counts, cold-start preferences, invalid-value isolation and action/help coverage. Source review A-2097 remains current. C1–C7 verified; implementation done marks remain the claimant's responsibility. A-2103: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2103-t-351-final-exact-head-evidence-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.

### coord · 2026-10-13T22:36:26.339Z

Merged 177f92cae8eec8e6188667a76d25a8f3bb5de113 onto dev.
