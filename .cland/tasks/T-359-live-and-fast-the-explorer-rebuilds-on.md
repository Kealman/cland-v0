---
id: T-359
kind: task
title: "Live and fast: the explorer rebuilds on every hub event, redraws only on a visible change with the cursor kept on its item, builds a 300-item tree in under 15 ms, and is the centre view at startup"
state: open
status: in progress
size: M
criterion_seq: 7
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: E-276
blocked_by:
  - T-356
topic: topic-242
branch: t/T-359-live-and-fast-the-explorer-rebuilds-on
created: 2026-10-13T20:53:52.374Z
updated: 2026-10-14T12:23:05.227Z
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

- [x] C1. A `task` event that moves the task under the cursor from `planned` to `in progress` (to another stage group) moves its row, and the cursor and the card stay on it.
  - done: impl-359 · 2026-10-14T09:27:46.642Z
- [x] C2. Removing the item under the cursor puts the cursor on the next item of the old order. Removing the last one puts it on the previous one. Reparenting the cursor's item into a folded epic puts it on that epic.
  - done: impl-359 · 2026-10-14T09:27:47.549Z
- [x] C3. A burst of 20 `task` events for items under a folded epic, whose visible counts do not change, causes no buffer write of the tree or the card. A `task` event that changes a visible count causes exactly one.
  - done: impl-359 · 2026-10-14T09:27:48.223Z
- [x] C4. `bench()` over the 300-item fixture with every node unfolded returns medians. The test asserts the bound and prints them, and the Implementer's dev-machine run, attached as an artifact, reads under 15 ms.
  - done: impl-359 · 2026-10-14T09:27:49.218Z
- [x] C5. A workbench started with no restart snapshot and no preset opens on the explorer at the kept scope. A preset or a restart snapshot opens as before.
  - done: impl-359 · 2026-10-14T09:27:51.177Z
- [ ] C6. `startClient`'s default and the QA runner's default keep General as the start for existing tests and cases. `npm run test:nvim` is green.
  - failed: rev-23 [reviewer] · 2026-10-14T12:23:05.227Z · note Exact-head run 6a9dce81 was cancelled after a hub-machine hang and held-ps test failure; Neovim did not run, so the required green verification is absent.
- [x] C7. `nvim/README.md` describes startup, live updates, the cursor's fallback order and the bench. The help line and the GLOSSARY's Explorer entry agree with the build.
  - done: impl-359 · 2026-10-14T09:27:51.785Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-359-1 · 2026-10-14T09:33:13.764Z · commit 66350c2b0f7046e653d9d86e762608494259812f
  - verified: rev-23 [reviewer] · run rev-2026-10-14-359-4 · 2026-10-14T10:14:19.940Z · commit f769586c03293bd64b5c8c7911af09086425dfbd
  - verified: rev-23 [reviewer] · run rev-2026-10-14-359-6 · 2026-10-14T10:45:54.978Z · commit f769586c03293bd64b5c8c7911af09086425dfbd
  - verified: rev-23 [reviewer] · run rev-2026-10-14-359-7 · 2026-10-14T11:04:05.120Z · commit 0d6a85a754701b6f28a479ff43c151ccf0644e93

## Comments

### impl-359 · 2026-10-14T09:22:14.708Z

Implemented cursor removal fallback and folded reparenting, visible-only event rendering with unchanged-buffer comparisons, updated-based detail invalidation, startup explorer, harness/QA General defaults and a restorative benchmark. First explorer-file run: 18/18 pass; fully unfolded 300-item dev-machine build median 8.414542 ms, write 2.089917 ms. Benchmark artifact posted in topic-242. Checking startup compatibility before requesting source review; full suite follows a clear source verdict.

### rev-23 · 2026-10-14T09:33:13.764Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-1
commit: 66350c2b0f7046e653d9d86e762608494259812f
scope: full

No high or medium findings in the thirteen-file source pass. explorer.lua:1138–1200 preserves identity/removal order/folded ancestor and card selection; visible layout rendering keeps existing coalescing and text/highlight write comparisons. item_view.lua:118–126 refetches on changed updated/missing/failed details, with reconnect invalidation retained. bench restores preferences/selection and reports separate build/write medians; A-2309's dev build is under 15 ms. init.lua:625–628 preserves presets/snapshots; harness/QA default General and explorer opt-ins preserve startup premises. C7 documentation/help/GLOSSARY verified; C1–C6 await exact-head suite evidence. Submit cland verify nvim through queue admission at this exact head. A-2313: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2313-t-359-full-source-review-clear-at-66350c2b.md.

Criteria: C7 verified.

### rev-23 · 2026-10-14T10:04:22.007Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-2
commit: 66350c2b0f7046e653d9d86e762608494259812f
scope: evidence

Medium — nvim/lua/cland/item_view.lua:118–120: updated-only invalidation suppresses real watched hand saves retaining frontmatter updated; summary shows verified 4/4 while cached detail still shows ◐ C4. Existing criteria.test.ts:122–125 and qa/cases/ITEMS-002.lua intentionally assert this contract; preserve both and correct cache freshness while retaining duplicate-event coverage. Initial source review missed this compatibility regression. A-2318 full-expanded d4d6df89 is red (1996/1998, zero skips/cancellations); C6 failed. Corrected head needs source review before replacement verification. A-2319: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2319-t-359-full-evidence-not-clear-unchanged-timestamp-detail-cache.md.

Criteria: C6 failed (Exact-head full-expanded Neovim verification fails criteria.test.ts and ITEMS-002: unchanged-timestamp hand saves do not invalidate detailed criterion marks.).

### impl-359 · 2026-10-14T10:04:27.136Z

Verify d4d6df89 at 66350c2b widened to full, 1996/1998 pass. Both failures were a shared-cache regression for legacy item views on hand saves retaining updated; unchanged existing criteria and ITEMS-002 tests reproduced it. Fixed in pushed e4f867bd: legacy reads consume event staleness, explorer-card reads opt into updated-only caching; reconnect refresh retained. Both failing tests and duplicate-event/folded-burst explorer tests now pass. Source re-review requested before new exact-head verify.

### coord · 2026-10-14T10:05:53.448Z

Coordinator decision (2026-10-14 10:06Z, asked by rev-23): the card refetches the shown item's task.view when 'updated' changes, or when the event summary disagrees with the cached detail: criteria counts, latest verdict, verify result or head, status, or claim. A same-timestamp save that changes marks then refreshes the card, and a duplicate event with no changes costs nothing. There is still only one fetch per shown item and no refetch on every event. A test covers a watched criteria save that keeps 'updated', with the card's mark following.

### rev-23 · 2026-10-14T10:06:19.586Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-3
commit: e4f867bd7dc8fc58bad178066aff6dd7b00a72b1
scope: full

Medium — nvim/lua/cland/item_view.lua:129–130 / explorer_card.lua:100/175: updated_only still leaves Explorer detail stale after a same-timestamp criteria save, so current summary 4/4 can appear above old C4 marks. Legacy compatibility is restored and no other high/medium delta issue was found. Coordinator decision 95f11a9d amends the contract to refresh the shown item when updated changes OR summary fields disagree (criteria, latest verdict kind/result/run, verify result/head, status, claim), preserving no-fetch identical events and unshown items. Implement the prescribed watched-save card regression and request new-head source review before another suite. C6 remains failed/pending from A-2318. A-2320: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2320-t-359-corrected-cache-source-not-clear-card-summary-disagreement.md.

### impl-359 · 2026-10-14T10:13:09.879Z

Coordinator-amended card freshness implemented and pushed at f769586c. Cached details now refresh on timestamp changes or task-summary disagreement in criteria counts, latest verdict kind/result/run, verify result/head, status or claim; identical events remain fetch-free and legacy view event refresh is retained. New real-hub watched-save card regression went red then green with unchanged updated. Criteria 5/5, card 15/15, live duplicate/folded-burst 2/2, nvim TypeScript and diff checks pass. Evidence artifact A-2321 in topic-242. Source re-review requested before the next full verify.

### rev-23 · 2026-10-14T10:14:19.940Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-4
commit: f769586c03293bd64b5c8c7911af09086425dfbd
scope: full

No high or medium findings. item_view.lua content_signal now implements Coordinator amendment 95f11a9d: current summary criteria counts, last verdict kind/result/run, verify result/head, status and claim are compared with cached full detail; timestamp/reconnect/legacy event freshness remains. Both card reads deduplicate identical signals. New real-hub watched same-timestamp C4 save and exact shown-item signal-fetch tests cover the regression without changing the original failed checks; stub criteriaCounts matches full-frame shape. A-2319/A-2320 source blockers resolved; prior startup/live/cursor/bench review retained. C7 refreshed; C1–C6 await exact-head cland verify nvim, and C6's failed gate still needs successful evidence/done mark. A-2322: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2322-t-359-amended-cache-contract-source-clear-at-f769586c.md.

Criteria: C7 verified.

### rev-23 · 2026-10-14T10:34:36.762Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-5
commit: f769586c03293bd64b5c8c7911af09086425dfbd
scope: evidence

Medium — hub/test/claude-code-accounts.test.ts:107: a final session.stop answers ok:false in unchanged T-362 directory/restart coverage; the log lacks session/refusal cause. A-2325 full-expanded 33af4fd9 exits 1 before Neovim (1616/1617, zero skips/cancellations), so corrected C1–C6 run evidence remains unavailable. No new T-359 source defect established; A-2322/C7 retained. Bugs · S aside reported. Coordinator babb7ed7 requires five sequential targeted runs per dev/head plus stop-refusal diagnostics and integrated-run control before shared/own classification; no unchanged full rerun. A-2326: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2326-t-359-full-evidence-not-clear-inherited-account-stop-failure.md.

### impl-359 · 2026-10-14T10:44:43.597Z

Verify 33af4fd9 stopped before Neovim at an inherited account-stop assertion. Per Coordinator, five sequential whole-file runs each on dev 46f8370 and task f769586c are captured in A-2328. Original restart/stop test passed 5/5 on both heads; each head had one identical different signed-out polling assertion failure (2 vs 1 at line 131), with no T-359-only failure. No stop refusal recurred, so its cause remains unknown. Production head unchanged; diagnostic worktrees removed. Focused startup/live/bench checks 6/6 pass; unfolded build 7.63 ms. No unchanged full rerun; awaiting integrated control/shared blocker decision.

### rev-23 · 2026-10-14T10:45:54.978Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-6
commit: f769586c03293bd64b5c8c7911af09086425dfbd
scope: full

Source-only clearance refreshed: unchanged clean f769586c and no new high/medium source findings; A-2322 remains applicable. A-2328 records all ten sequential dev/task file runs, original stop case 10/10 but one identical signed-out count failure per head. Coordinator 698b78b0 assigns shared T-382, regression_of T-362. This is not green full evidence: C1–C6 remain unverified, failed C6 gate pending. C7 refreshed. Wait for T-382 commit, cherry-pick, take new-head delta review, then one full verify; no unchanged rerun. A-2329: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2329-t-359-unchanged-source-clear-awaiting-shared-t-382.md.

Criteria: C7 verified.

### impl-359 · 2026-10-14T11:03:18.114Z

Reviewed shared T-382 commit 53f84e47 cherry-picked cleanly with provenance onto T-359 as 0d6a85a7 and pushed. Three shared files only; no new explorer/startup delta. Single targeted account file passes 5/5, including the signed-out counting window and pending-PID stop regression. Worktree clean. Requested delta source review before one exact-head full verify, as Coordinator 698b78b0 directed.

### rev-23 · 2026-10-14T11:04:05.120Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-7
commit: 0d6a85a754701b6f28a479ff43c151ccf0644e93
scope: delta

Delta source clear; no high or medium findings. The sole commit is the T-382 cherry-pick: all added/removed lines in its three files match reviewed 53f84e47; differences between complete test/fake blobs are existing base /usage-poller context. Atomic PID/identity publication and exact pre-latch count window retain A-2338's assessment. T-359 explorer/card/startup/cache/bench source remains unchanged from A-2322/A-2329. C7 refreshed at this head; C1–C6 require complete exact-head verification. Evidence A-2339: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2339-t-359-shared-t-382-delta-source-clear-at-0d6a85a7.md.

Criteria: C7 verified.

### rev-23 · 2026-10-14T12:23:05.227Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-359-8
commit: 0d6a85a754701b6f28a479ff43c151ccf0644e93
scope: evidence

Medium — hub/test/suite.test.ts:1083 / verification evidence: A-2347 reports the live held-ps admission test failing, followed by an incomplete/hung hub-machine run; Neovim never started. Only typecheck and 37 free-phase tests completed. Coordinator a16d7167 ordered cancellation after 55 minutes of idle runner/spoke and no resubmission yet. Exit 143 is not green gate evidence. Exact assertion/cause is unclassified; no new T-359 source regression is asserted, and A-2339 remains its source assessment. C6 fails the verification gate. Bugs · S aside reported to lead; no unchanged rerun. A-2348: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2348-t-359-incomplete-verification-held-ps-failure-and-cancelled-hang.md.

Criteria: C6 failed (Exact-head run 6a9dce81 was cancelled after a hub-machine hang and held-ps test failure; Neovim did not run, so the required green verification is absent.).
