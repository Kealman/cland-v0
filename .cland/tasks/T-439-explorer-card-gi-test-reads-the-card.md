---
id: T-439
kind: task
title: explorer-card gi test reads the card before the cursor reaches T-11's row (1 in 5 alone on macOS)
state: closed
status: done
size: XS
rank: 2292
criterion_seq: 2
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
regression_of: T-352
topic: topic-263
branch: t/T-439-explorer-card-gi-test-reads-the-card
created: 2026-10-14T19:25:01.693Z
updated: 2026-10-14T19:38:32.132Z
closed: 2026-10-14T19:38:32.132Z
---

## Summary

`nvim/test/explorer-card.test.ts:243` ("gi reveals the thread reference without changing folds…") fails intermittently on macOS at dev ed0ea1b2. It failed in integrated cover 15888a54 (A-2525) and once in five runs of the file alone. The error is "card T-11 expects fallback human picture. / no row under the cursor". `shown(c,'T-11', …)` runs right after `gi` and reads the card before the explorer has put the cursor on T-11's row, so it is a readiness gap of the T-376/T-411 kind. The integrated dev cover fails on it, so it is a shared fix.

## What to fix

Make the test wait for the state it asserts: the explorer view, the cursor's key T-11, and the card rendered for T-11. Do it after each `gi` and `Space Space` in this test. Widen no time bound. If `gi` can leave the cursor without a row in the product, fix that instead.

## Acceptance criteria

- [x] C1. The cause is named, with a reproduction that makes the race deterministic, red before the fix and green after.
  - done: impl-439 · 2026-10-14T19:31:10.636Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-439-1 · 2026-10-14T19:34:24.481Z · commit f648da4200852700a0c825cbc4ded9172911ebc6
  - verified: rev-23 [reviewer] · run rev-2026-10-14-439-2 · 2026-10-14T19:37:57.406Z · commit f648da4200852700a0c825cbc4ded9172911ebc6
- [x] C2. The file passes 10/10 whole-file runs serially, including at least five beside a local full run.
  - done: impl-439 · 2026-10-14T19:32:54.553Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-439-2 · 2026-10-14T19:37:57.406Z · commit f648da4200852700a0c825cbc4ded9172911ebc6

## Comments

### impl-439 · 2026-10-14T19:26:49.393Z

Unmodified targeted reproduction at ed0ea1b2 on macOS: node --test --test-name-pattern='gi reveals the thread' nvim/test/explorer-card.test.ts exited 1, exact card T-11 expects fallback human picture / no row under the cursor (5.42 s). Ranked hypotheses: (1) queued gi cannot execute during shown's synchronous Lua vim.wait, (2) reveal leaves an invalid cursor, (3) delayed card follow/detail rendering. A temporary 150 ms timer queues the real gi mapping during shown to pin hypothesis 1's interleaving; deterministic red/green evidence underway. Local full holder impl-385 will supply overlap for serial whole-file repetitions; no independent full run.

### impl-439 · 2026-10-14T19:33:14.249Z

Pushed f648da4200852700a0c825cbc4ded9172911ebc6: one test-only commit, nvim/test/explorer-card.test.ts only. Final fix polls explorer view/actual cursor/rendered card after every gi and Space Space; waits for General composer/Normal-thread focus and actual T-11 token before first gi. Original assertions retained; explicit existing 5000 ms bound, no product changes. Final-source deterministic probe 2/2 green after exact no-row 2/2 red before. Ten consecutive serial whole-file passes, 150/150 cases, no skips/failures; all ten overlapped impl-385 local full f8e54b25, proved by before/after hub queue snapshots. A-2528 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2528-t-439-deterministic-gi-race-and-ten-serial-full-file-passes holds reproducible probe, full logs, source hashes and first-candidate failure diagnostics. C1/C2 done. Fetched/merged origin/dev before commit (already up to date); source review requested before exact-head local no-mode verification.

### rev-23 · 2026-10-14T19:34:24.481Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-439-1
commit: f648da4200852700a0c825cbc4ded9172911ebc6
scope: full

No high or medium Standards/Spec findings. Existing assertions and 5000 ms bounds retained. The test observes composer/thread focus and actual reference before first gi, then explorer view, actual target cursor and rendered card after both gi actions and all three returns. C1 deterministic 150 ms queued-gi reproduction red twice before/green twice after verified in A-2528. Final-source hash matches; ten serial whole-file runs pass 150/150 with zero skips, all before/after queue snapshots showing local full holder impl-385 f8e54b25. C2 repetition proof established, final mark/readiness deferred until normal same-head local verification. A-2529: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2529-t-439-source-review-observable-gi-readiness-and-serial-proof.md.

Criteria: C1 verified.

### impl-439 · 2026-10-14T19:37:25.029Z

Exact source-reviewed head f648da4200852700a0c825cbc4ded9172911ebc6 passed local no-mode verification 958ea746-44a9-44ff-b2af-1ba17c13b8c6: selected nvim-only, typecheck and 402/402 tests green, zero failures/cancellations/skips/todo, exit 0. Executor darwin arm64, Node v24.21.0, Neovim v0.12.5; suite 97.07 s, queue wait 54.01 s. Durable log A-2535: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2535-suite-958ea746-44a9-44ff-b2af-1ba17c13b8c6-auto-at-f648da4.log. Source/worktree remain clean and unchanged; final reviewer verdict pending. A-2528's matching-source ten serial whole-file passes and deterministic red/green remain applicable.

### rev-23 · 2026-10-14T19:37:57.406Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-439-2
commit: f648da4200852700a0c825cbc4ded9172911ebc6
scope: evidence

Final clear; C1/C2 done marks confirmed, unchanged clean head. Normal no-mode local 958ea746/A-2535 selects nvim-only, root typecheck and 402/402 cases pass (15 hub smoke + 387 Neovim), exit 0 with zero failures/cancellations/skips/todo. Source A-2529 retained: exact queued-gi red twice/green twice, original assertions and five-second bounds preserved. C2 A-2528 verified: ten final-source serial files, 150/150, matching source hash and every before/after queue snapshot showing local full holder impl-385 f8e54b25. No high/medium Standards/Spec findings. A-2536: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2536-t-439-final-exact-head-local-gate-and-readiness-proof.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-14T19:38:32.132Z

Merged a2f60f7a1ac1bedde02318d5a57f86807f0d9179 onto dev.
