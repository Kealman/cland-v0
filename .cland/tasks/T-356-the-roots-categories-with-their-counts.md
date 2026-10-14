---
id: T-356
kind: task
title: "The roots: Categories with their counts, top three, N more, the done count D hides and the idle-work mark from idle_from; Unscheduled with the maps; Other releases with A for the closed ones; and a card for each root"
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
  - T-355
topic: null
branch: null
created: 2026-10-13T20:53:52.040Z
updated: 2026-10-14T02:11:37.826Z
---

## Summary

The explorer's folded roots name what they hold and unfold as §3.10 and the mockups draw them. An unfolded category shows its top three items by rank, then `N more`, with its open count, how many done items `D` hides, and an `idle work` mark when `idle_from` in crew.toml names it. Unscheduled holds the maps and the other unparented items. Other releases lists the open releases, with the closed ones behind `A`.

## Parent

E-276: The explorer and the card, tracer bullet 4. Spec: `docs/spec/v0.1.2.md` §3.10 (The explorer, Idle work, the accepted mockups T-259) and §3.8 (the folded roots name what they hold, "Other releases" lists open releases only, `A` toggles the archived roots, maps under Unscheduled). The category kind (T-315), the seeded categories (T-316) and `idle_from` (T-317) are merged. Board: `Categories.dc.html`. Prototype: `explorer.lua` (`categories`, `unscheduled`, `other_releases`, `virtual_text`, the `top3` and `:more:` nodes) and the virtual-root cards in `explorer_card.lua`.

## What to build

**Categories.**

- The root row reads `Categories (4) · 23 open` and names each category with its open count: `Tech debt 3 open · Bugs 2 open · …`.
- Categories are the open items of the ladder's root kinds other than the release kind (`items.open_categories`), in id order as the items panel lists them.
- **A category row** shows its glyph (derived), id and title, then `<open> open · <done> done`, its bar over its tasks, and the `idle work` mark in teal when `state.S.crew.config.idle_from` names it. When `idle_from` names several, the mark carries the order (`idle work 1`).
- **An unfolded category** (default open on its top three, the prototype's choice) shows:
  - its top three live items by rank;
  - then a virtual `N more` row, which unfolds into the rest by rank;
  - then its done items in closing order, hidden by `D`;
  - and, while `D` hides them, a faint `D hides <n> done` line in their place.
- An epic in a category is a container row like any epic, with its bar and counts.

**Unscheduled.**

- The root row reads `Unscheduled (N)` with the first two items' ids and titles.
- It holds the open items with no parent that are neither releases nor categories, the maps among them (maps sit under Unscheduled for now).
- Maps come first, then the other kinds, each group by rank.
- With `A`, the closed root items follow in closing order.

**Other releases.**

- The root row reads `Other releases (N)` and names them: `0.2.0 open · v0.1.1 and v0.1.0 closed · A shows them`.
- It lists the open releases other than the root in version order (`items.open_releases`).
- With `A`, the closed releases follow, newest first. Each unfolds to its epics as any release does.

**The roots' cards** (the prototype's choice, since the spec gives them none). The card of `Categories`, `Unscheduled`, `Other releases`, `Direct tasks` or `N more` names what the root is, in one sentence. A `holds` section follows with up to 12 item lines (glyph, id, title in the done colour when done), then `<n> more · l unfolds them`. Each line is a reference for Enter.

**Messages.** Promotion is a message (§3.10). `m` and `M` on a category or its items work as ticket T-355 built them, with no new key. The context line of an item in a category names the category as its container.

**Live crew changes.** A `crew` event that changes `idle_from` redraws the mark without a restart, since `state.S.crew` is already kept by the event.

**Docs.** `nvim/README.md`'s Explorer section describes the three roots, the top three, `N more`, the idle-work mark and `A`. The help line names `A`.

**Demo** (the epic's tracer bullet 4). With `idle_from = ["C-216"]`, the Categories root shows Tech debt with its idle-work mark and its top three tasks. `N more` unfolds the rest. `D` replaces the done tasks with `D hides <n> done`.

**Out of scope.**

- A root of its own for maps (they stay under Unscheduled).
- Moving items between categories, releases and epics: that is a message (§3.8).
- The items panel's count line (built by T-318 and T-329).
- Search and filter (fog).

**Constraints.**

- Neovim is the host, with no plugins (ADR 0005).
- Tests run headless on the stub hub through the frame protocol, one `nvim --headless` per test, keys by `nvim_input`, the screen read with `screenstring()` at 200x50. The fixture holds a ladder of `[["release", "category"], ["epic"]]`, four categories with more than three open items in one, done items, an epic inside a category, a map and an unscheduled task, an open future release, a closed release, and a crew config with `idle_from`. The stub hub's `hub.status` does not carry `crew` today: add it from the scenario, as the real hub's daemon sends it (`hub/src/hub/daemon.ts`). The live change is a `crew` event pushed through the control socket's `emit`.
- Add `qa/cases/EXPLORER-002.lua` (stub hub): the Categories root with the idle-work mark and the top three.
- Tests wait on state, never on a sleep. Every key goes through the action registry.
- A Neovim-only delta needs `npm run test:nvim` green. Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25), and only when `cland verify queue --json` shows no holder.
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. The Categories root row names each category with its open count. A category with five open items shows its top three by rank and `2 more`, which unfolds into the other two.
- [ ] C2. A category row shows `<open> open · <done> done`. With `D` on, its done items give way to `D hides <n> done`.
- [ ] C3. With `idle_from = ["C-216"]` in the stub's crew config, C-216's row carries `idle work`. A `crew` event that empties `idle_from` removes the mark without a restart.
- [ ] C4. Unscheduled lists the map first, then the unscheduled task. `A` adds a closed root item.
- [ ] C5. Other releases lists the open future release and says the closed one is behind `A`. `A` adds it, newest first.
- [ ] C6. Each root's card names what it holds, with up to 12 item lines. Enter on one reveals that item in the tree.
- [ ] C7. `qa/cases/EXPLORER-002.lua` passes on the stub hub. `nvim/README.md` and the help line describe the roots and `A`.
