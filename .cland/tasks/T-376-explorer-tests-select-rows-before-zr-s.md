---
id: T-376
kind: task
title: Explorer tests select rows before zR's expanded rows land (explorer-card missing row T-10 under load)
state: open
status: ready
size: XS
criterion_seq: 4
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-352
topic: topic-238
branch: t/T-376-explorer-tests-select-rows-before-zr-s
created: 2026-10-14T06:45:48.305Z
updated: 2026-10-14T07:07:35.462Z
---

## Summary

`nvim/test/explorer-card.test.ts:194` presses `zR` and then selects row T-10 through the RPC select helper, with no wait for the expanded rows to be drawn. Under suite load the selection runs first and fails with `missing row T-10`. This is the readiness class the T-340 sweep fixed (an action before its snapshot lands), in a test T-352 added after that sweep.

## Evidence

- T-347's full run f7a73045 at e116b78e (A-2268), macOS under suite load, failed 1973/1974. The only failure was explorer-card.test.ts:194, `missing row T-10` right after `zR`. The test uses a stub hub, and T-347 does not change it.
- Run alone at the same head, it passes 1/1 in about 0.8 s.

## Acceptance criteria

- [x] C1. Every `zR`/`zM`/`za` followed by a row selection or a screen assertion in the explorer and card tests waits for the expected rows (for example `waitScreen` on the row) before acting, with no other assertion changed.
  - done: impl-376 · 2026-10-14T06:55:09.482Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-376-2 · 2026-10-14T07:07:32.611Z · commit d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea
- [x] C2. The same sweep covers T-350..T-359's other new explorer tests for actions taken before their rows land, applying the same readiness wait.
  - done: impl-376 · 2026-10-14T07:06:22.703Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-376-2 · 2026-10-14T07:07:32.612Z · commit d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea
- [x] C3. The fix is one test-only commit, so it can be cherry-picked into every live branch.
  - done: impl-376 · 2026-10-14T06:55:14.333Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-376-2 · 2026-10-14T07:07:32.612Z · commit d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea
- [x] C4. The touched Neovim test files pass 20 consecutive targeted runs under four parallel CPU workers on macOS.
  - done: impl-376 · 2026-10-14T07:06:23.104Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-376-2 · 2026-10-14T07:07:32.612Z · commit d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea

## Comments

### impl-376 · 2026-10-14T06:48:36.310Z

Read T-376, R-228, E-276 including its Coordinator comments, and D24/D27. Baseline real-hub card test passes 1/1 (node --test --test-name-pattern='the explorer card reads parsed body from a real hub' nvim/test/explorer-card.test.ts, 1.93 s). Known failure is recorded in A-2268. Sweep found seven immediate zR→select sites in explorer-card, two root-fold buffer reads in explorer, immediate card-focus reads, and a D→preference capture. Added readiness waits with original assertions retained; other new explorer/summary/compose and board/category/live tests inspected for this class.

### impl-376 · 2026-10-14T06:55:16.948Z

Implementation pushed as the single test-only commit 4fd9452ac2eefc77243bc4dcfdc927cc419826de. Typecheck and both individual files green; 13/20 stress rounds green so far. Stress file hashes match this committed head. Scope evidence A-2273. Waiting for all 20 rounds before source review request.

### impl-376 · 2026-10-14T06:57:51.430Z

C4 complete at 4fd9452ac2eefc77243bc4dcfdc927cc419826de: 40/40 targeted single-file invocations, 20 consecutive rounds for each touched file, 540/540 test cases, zero failures/skips; four CPU-bound Node processes alive throughout on macOS 27.0.1 arm64, Node v24.21.0; elapsed 445.254 s. Workers stopped. Exact driver, per-run logs, host/load evidence, source hashes/patch: A-2274 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2274-t-376-20-round-macos-cpu-stress-evidence. Final fetch confirms origin/dev equals parent (ahead 1, behind 0). npm run typecheck and git diff --check pass. One test-only commit pushed; no required QA scope or brief.

### rev-23 · 2026-10-14T07:00:28.582Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-376-1
commit: 4fd9452ac2eefc77243bc4dcfdc927cc419826de
scope: full

Medium — nvim/test/vboard.test.ts:355–357: all · proves filter selection but can land before zR expansion; subsequent full row-inventory equality can race. C2's T-350..T-359 sweep must add actual expanded-row readiness while preserving equality and recheck similar boundaries. Changed explorer/card waits preserve all assertions and matching-hash A-2274 twenty-run evidence is green (540 cases), but added file requires its own twenty-run coverage. Amend single commit and request new-head source review before full. A-2275: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2275-t-376-source-review-not-clear-all-filter-expansion-readiness.md.

Criteria: C2 failed (vboard.test.ts:355–357 waits only for all-filter header after 6zR, then reads unfolded inventory without row readiness.).

### impl-376 · 2026-10-14T07:03:09.697Z

Review A-2275 C2 correction: the all-filter header did not prove zR finished expansion before row inventory reads. Added panel-row readiness for every fixture item before both unchanged inventory equalities; archived-scope 6zR/ezR waits now include descendants; zo helper waits for its rendered open marker before moving to the next group; done→board waits for the board header too. Amended the single commit to d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea and lease-updated only this task branch in origin. vboard first targeted run 24/24; final-head vboard 20-run CPU stress underway, first two rounds green. Original card/explorer stress hashes match this head. Typecheck green; no full verify before new review.

### impl-376 · 2026-10-14T07:06:23.627Z

A-2275 correction complete at pushed d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea, still one test-only commit. vboard 20/20 targeted stress runs under four CPU workers on macOS, 480/480 cases in 190.332 s, no failures/skips; workers stopped. A-2277 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2277-t-376-added-board-stress-and-final-head-proof) contains all logs, driver/load evidence and final-head hashes/patch. A-2274's unchanged card/explorer sources match the final head exactly, so together 60/60 file runs, 1020/1020 cases. Typecheck/diff check green. Final fetch ahead 1/behind 0 against origin/dev. Requesting new source review before verification.

### rev-23 · 2026-10-14T07:07:32.612Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-376-2
commit: d1d0ff41ad8b06ed2e0bb5aadce3e2b2317d77ea
scope: full

No high/medium findings remain. Complete inventory barriers wait for every actual left-panel item, archived/group/focus/filter boundaries target their next-read state, all original assertions retained. C1–C3 verified; C4 A-2274/A-2277 covers twenty complete-file runs per touched file, final hashes match, 60/60 invocations and 1020/1020 cases under four CPU workers, no skips/retries, workers stopped. Ordinary exact-head full gate remains pending. A-2280: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2280-t-376-amended-readiness-sweep-source-clear.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
