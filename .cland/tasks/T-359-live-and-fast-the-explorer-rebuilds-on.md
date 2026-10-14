---
id: T-359
kind: task
title: "Live and fast: the explorer rebuilds on every hub event, redraws only on a visible change with the cursor kept on its item, builds a 300-item tree in under 15 ms, and is the centre view at startup"
state: open
status: planned
size: M
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-356
topic: null
branch: null
created: 2026-10-13T20:53:52.374Z
updated: 2026-10-14T02:11:39.079Z
---

## Summary

The explorer stays live and cheap. Every hub event rebuilds the model, but the tree and the card are rewritten only on a visible change. The cursor stays on its item through moves, removals and reparenting, falling back by a fixed order. A bench pins the 15 ms budget for 300 items. Last, the explorer becomes the centre view at startup when nothing else is open, with the test harness keeping General for the tests that assume it.

## Parent

E-276: The explorer and the card, tracer bullet 7, and the startup centre of tracer bullet 1. Spec: `docs/spec/v0.1.2.md` §3.8 (Keys and place: the centre view at startup; the prototype's answers: the model rebuilt on every hub event and redrawn only on a visible change, under 15 ms for 300 items). Prototype: `explorer.lua` (`render`, `restore`, `tree_order`, `bench`), `nvim/explorer-live-run.ts` and the Measurements table on `prototype/explorer`. Prior art: restore the cursor by identity with a fixed fallback, debounce the card. Risk recorded in the epic: at ten times today's items a per-subtree check or lazy folds would be needed (the prototype's point 19).

## What to build

**Live updates.**

- The explorer renders from `layout.render`, coalesced once per tick by `state.changed` (T-293), and only while it is visible: the centre view, or a split showing it. A hidden explorer does no work.
- `task`, `topic`, `crew` and `hub.status` events rebuild the model. The buffer is rewritten only when the painted text or highlights differ (ticket T-350's compare), and the card only when its compose output differs.
- The card's cached `task.view` refetches only when its item's `updated` changes (`item_view.get`).
- The card's plan block refetches only through `plan.get`'s own staleness.
- A `task` event for an item that is not visible and does not change a visible row's text (a closed task deep in a folded epic) causes no buffer write. The test counts them.

**The cursor** (prior art, the prototype's `restore`). Before each rewrite, capture the row key under the cursor and the order of drawn keys. After it, put the cursor on:

1. the same key;
2. else the next key of the old order that is still drawn;
3. else the previous one;
4. else the nearest drawn ancestor;
5. else the first item row.

The scope's history entries keep their own cursor keys, so `␣␣` still lands on the node it came from. The card follows the cursor's key, not its row number.

**The bench.**

- `require('cland.explorer').bench(n)` renders the current view `n` times and returns medians in milliseconds: model and rows, then the buffer write. It does the same with every node unfolded and `A` on, and for the card of a given id.
- A test builds a 300-item stub fixture (one release, 10 epics with plans, about 260 tasks across statuses, 4 categories, a map, 15 unscheduled items, 2 closed releases) and runs it with every node unfolded.
- The test asserts that the median build stays under a bound and prints the medians. The 15 ms budget is checked by QA on the dev machine (see the NOTES open point on CI variance).
- An Implementer run of the bench on the dev machine is attached to the item topic as an artifact.

**The explorer at startup.**

- In `nvim/lua/cland/init.lua`'s `M.start`, when there is no restart snapshot and no preset, the centre view is the explorer at the scope kept in `ui.json` (`explorer.scope`), instead of General.
- With a snapshot or a preset, startup is unchanged.
- Before `task.list` answers, the explorer shows `loading the items…`, and the cursor lands on the root release when the items arrive.
- The status line and the top bar name it. The composer is not entered at startup, since the centre is not a thread.

**The test sweep for startup.** Most Neovim tests and QA cases assume General in the centre at start.

- `nvim/test/harness.ts`'s `startClient` gains an option, `centre: 'general' | 'explorer'`, defaulting to `general`. With `general`, after the first screen it types `<Esc><Space>g` and waits for General's composer, so existing tests keep their premise without per-test edits.
- The QA runner (`nvim/lua/cland/qa.lua`) does the same for cases that do not set `centre = 'explorer'`.
- Explorer tests and `qa/cases/EXPLORER-*.lua` use `explorer`.
- This is a test-side choice in the harness, not a seam in the hub or the plugin.
- If a test fails only because of this switch, fix it in the same commit as the harness change.

**Docs.**

- `nvim/README.md`: startup, live updates, the cursor's fallback order, the bench and how to run it.
- The help line names the explorer as the startup view.
- `GLOSSARY.md`'s Explorer entry is checked against the build, and edited only if it disagrees.

**Demo** (the epic's tracer bullet 7). A status change on a visible task moves its row while the cursor stays on its item, and the bench reports the build under 15 ms. A fresh workbench with no restart snapshot opens on the explorer at R-228.

**Out of scope.**

- Lazy folds and a per-subtree dirty check (the map's fog, unless the bench misses the budget; see the NOTES risk).
- Search and filter.
- Changing what Enter opens in the panels, the board or the graph.

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()` at 200x50. Live changes are pushed with the stub's control socket (`emit`, `emits` for a burst, `set`).
- Tests wait on state, never on a sleep. A "no rewrite" assertion counts writes after a state barrier: `vim.wait` on the coalesced render's counter, never a fixed delay.
- Every key goes through the action registry.
- No hub request per row or per cursor move.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder. The startup sweep touches most Neovim tests, so run `npm run test:nvim` through `cland verify` before review, not only targeted files.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A `task` event that moves the task under the cursor from `planned` to `in progress` (to another stage group) moves its row, and the cursor and the card stay on it.
- [ ] C2. Removing the item under the cursor puts the cursor on the next item of the old order. Removing the last one puts it on the previous one. Reparenting the cursor's item into a folded epic puts it on that epic.
- [ ] C3. A burst of 20 `task` events for items under a folded epic, whose visible counts do not change, causes no buffer write of the tree or the card. A `task` event that changes a visible count causes exactly one.
- [ ] C4. `bench()` over the 300-item fixture with every node unfolded returns medians. The test asserts the bound and prints them, and the Implementer's dev-machine run, attached as an artifact, reads under 15 ms.
- [ ] C5. A workbench started with no restart snapshot and no preset opens on the explorer at the kept scope. A preset or a restart snapshot opens as before.
- [ ] C6. `startClient`'s default and the QA runner's default keep General as the start for existing tests and cases. `npm run test:nvim` is green.
- [ ] C7. `nvim/README.md` describes startup, live updates, the cursor's fallback order and the bench. The help line and the GLOSSARY's Explorer entry agree with the build.
