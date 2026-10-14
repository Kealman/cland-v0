---
id: T-356
kind: task
title: "The roots: Categories with their counts, top three, N more, the done count D hides and the idle-work mark from idle_from; Unscheduled with the maps; Other releases with A for the closed ones; and a card for each root"
state: open
status: ready
size: M
criterion_seq: 7
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-355
topic: topic-236
branch: t/T-356-the-roots-categories-with-their-counts
created: 2026-10-13T20:53:52.040Z
updated: 2026-10-14T09:12:07.329Z
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

- [x] C1. The Categories root row names each category with its open count. A category with five open items shows its top three by rank and `2 more`, which unfolds into the other two.
  - done: impl-356 · 2026-10-14T05:50:12.061Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.716Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C2. A category row shows `<open> open · <done> done`. With `D` on, its done items give way to `D hides <n> done`.
  - done: impl-356 · 2026-10-14T05:50:13.822Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.716Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C3. With `idle_from = ["C-216"]` in the stub's crew config, C-216's row carries `idle work`. A `crew` event that empties `idle_from` removes the mark without a restart.
  - done: impl-356 · 2026-10-14T05:50:15.014Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.716Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C4. Unscheduled lists the map first, then the unscheduled task. `A` adds a closed root item.
  - done: impl-356 · 2026-10-14T05:50:15.680Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.717Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C5. Other releases lists the open future release and says the closed one is behind `A`. `A` adds it, newest first.
  - done: impl-356 · 2026-10-14T05:50:16.628Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.717Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C6. Each root's card names what it holds, with up to 12 item lines. Enter on one reveals that item in the tree.
  - done: impl-356 · 2026-10-14T05:50:18.257Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.717Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
- [x] C7. `qa/cases/EXPLORER-002.lua` passes on the stub hub. `nvim/README.md` and the help line describe the roots and `A`.
  - done: impl-356 · 2026-10-14T05:50:19.162Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-356-5 · 2026-10-14T09:12:03.717Z · commit 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff

## Comments

### impl-356 · 2026-10-14T05:47:08.127Z

Implemented category counts/top-three/N more, hidden done placeholders, live idle_from marks, maps-first Unscheduled and archived releases, and glyph/reference root cards. Targeted real-hub and stub-screen tests pass; EXPLORER-002 is being checked through the headless QA runner. Typecheck passes. Full verification will follow the source review.

### rev-23 · 2026-10-14T05:53:39.039Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-356-1
commit: 6176764737073a1970ae813965f50c77609b3f89
scope: full

No high/medium findings across all eight changed files. Counts/top-three/more/D placeholder, live crew marks, maps/version/archive ordering, virtual-card reference cap/colours and reveal match C1–C7; category messaging retains T-355. Existing fold assertion distinguishes preview text from actual item rows with exclusion retained. Frame/readiness/registered-key coverage and EXPLORER-002 are present. C1–C7 remain run-dependent pending exact-head ordinary verification. A-2252: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2252-t-356-complete-explorer-roots-source-review-clear.md. Source clear only; no per-item QA scope.

### rev-23 · 2026-10-14T06:24:18.996Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-356-2
commit: 6176764737073a1970ae813965f50c77609b3f89
scope: evidence

Medium — hub/test/executor-droplet.test.ts:158: acquire fails with fake API 404 before watchdog survival is exercised. Medium — hub/test/verifier-routing.test.ts:199: queued observer wait hits known T-369 readiness race. A-2258 exits 1 with 1611/1613 hub cases; Neovim/EXPLORER-002 not reached, zero skips/cancellations. These inherited files are outside T-356 source delta; no individual explorer criterion falsely failed, all C1–C7 remain unverified. Adopt authorized shared routing fix and diagnose watchdog/dev comparison before new-head review/run. A-2259: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2259-t-356-full-evidence-not-clear-two-inherited-hub-failures.md.

### rev-23 · 2026-10-14T06:26:43.412Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-356-3
commit: 2e2ffce1bc71c29eb418bc7fb99ccb21ac4e38cd
scope: delta

No high/medium delta findings. Entire four-line test patch exactly matches final-reviewed/landed T-369 e5bd6b89; assertions and 5s waits retained, explorer/production source unchanged. Complete source A-2252 retained. C1–C7 remain unverified; old full A-2258 remains red. Coordinator a5f8d3e8 holds replacement verification until shared watchdog correction; request changed-head review when adopted. A-2263: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2263-t-356-shared-observer-readiness-delta-source-clear.md.

### rev-23 · 2026-10-14T08:28:19.134Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-356-4
commit: 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
scope: delta

No high or medium findings. Combined T-375/T-376 shared delta retains all landed additions/removals and the prior task source assessment. The shared additions/removals match exactly. Four files are byte-identical to the landed references; explorer.test.ts retains its previously reviewed T-356 expanded actual-row and folded Unscheduled-preview assertions. The new readiness barriers coexist with those assertions. Explorer implementation and eight roots tests are unchanged. C1–C7 await exact-head full verification, including the QA case. One full cland verify may now run at this exact head through the queue. A-2297: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2297-t-356-combined-shared-fix-delta-source-clear.md.

### rev-23 · 2026-10-14T09:12:03.717Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-356-5
commit: 68fb9a70dce19d759b599a14d2c2aad3ee2ddfff
scope: evidence

No high or medium findings. Exact source-reviewed head is clean and unchanged. A-2304 full c974cd00 passes typecheck and all phases: 1989/1989, zero failures/cancellations/skips/todo, exit 0. Real-hub category summaries, top-three/more/counts/D, live crew idle work, Unscheduled/Other releases/archive ordering, root-card cap/reveal and EXPLORER-002 headless QA runner all pass. A-2252/A-2297 source assessments remain applicable; C1–C7 verified. A-2305: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2305-t-356-final-exact-head-evidence-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified.
