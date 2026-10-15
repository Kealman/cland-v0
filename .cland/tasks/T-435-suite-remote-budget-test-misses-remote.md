---
id: T-435
kind: task
title: suite-remote-budget test misses 'remote budget 1/1 full' on Linux after an unconfirmed acquire cleanup
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-261
branch: t/T-435-suite-remote-budget-test-misses-remote
created: 2026-10-14T18:23:17.170Z
updated: 2026-10-15T03:43:09.246Z
---

## Summary

`hub/test/suite-remote-budget.test.ts:191` ("unconfirmed acquire cleanup keeps durable remote budget reservation") failed on a Linux c-8 droplet in T-430's run 077a0297 at 564e7a4c (A-2501), after 8453 ms. At line 205 the history never contained "remote budget 1/1 full". It passes on macOS. It is one of the Linux-only failures that block clean droplet runs, with T-429, T-430 and T-432 to T-434.

## What to fix

Find whether the test samples the history before the reservation's notice is sent, or whether the product drops or delays the notice when cleanup is unconfirmed. The notice may also be affected by T-431's change to once-per-run fallback notices, so check the interaction. Wait on the real state, or fix the product, in one commit. Don't widen time bounds.

## Acceptance criteria

- [x] C1. The cause is named with evidence, with a deterministic reproduction red before the fix and green after.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-435-1 · 2026-10-14T18:31:17.177Z · commit c652394614d783ec07266c83073d4ceb940353be
  - done: impl-435 · 2026-10-15T03:13:46.546Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-435-3 · 2026-10-15T03:14:23.385Z · commit c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e
  - verified: rev-23 [reviewer] · run rev-2026-10-15-435-4 · 2026-10-15T03:43:07.977Z · commit c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e
- [x] C2. The file passes 5/5 whole-file runs serially beside a full local run.
  - done: impl-435 · 2026-10-15T03:13:47.456Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-435-4 · 2026-10-15T03:43:07.977Z · commit c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e

## Comments

### impl-435 · 2026-10-14T18:26:37.067Z

Baseline focused command node --test --test-name-pattern='unconfirmed acquire cleanup' hub/test/suite-remote-budget.test.ts reproduced the exact missing-notice assertion on macOS (0/1, 8.63s). Queue membership is not a fallback completion signal: #start persists queued before asynchronous #launchRemote/#droplet.acquire; queue displays requestedExecutor even after fallback. Fix waits for the run-specific persisted fallback notices for both callers with the existing 20s bounds, then checks the exact budget-full text. T-431's once-per-run notices remain compatible.

### rev-23 · 2026-10-14T18:31:17.177Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-435-1
commit: c652394614d783ec07266c83073d4ceb940353be
scope: full

No high or medium source findings. Old queued-membership waits precede async acquisition/fallback; new correct-topic durable executor-fallback:<run> waits establish actual state, retain one droplet/create and cleanup checks, tighten exact next warning text, preserve20s deadlines. A-2505 public integration red/green plus A-2504 deterministic scheduler interleaving establish C1. Compatible with T-431’s single persisted notice; no repeated emission dependency or product seam. C2 remains pending five serial whole-file passes beside full local run (first8/8 insufficient). Exact-head no-mode local suite follows source-clear, final needs C2 proof too. A-2512: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2512-t-435-source-review-observe-durable-fallback-before-reservation-assertions.md.

Criteria: C1 verified.

### impl-435 · 2026-10-14T18:39:30.841Z

C2 evidence at reviewed c6523946: suite-remote-budget.test.ts passed 5/5 whole-file serial invocations, 8/8 tests each. Durable logs: A-2509 (108.64s), A-2514 (121.24s), A-2516 (97.14s), A-2517 (100.80s), fifth log posted in topic-261 (75.28s). No stress loop or overlapping file runs. Queue snapshots at 18:24:38Z and 18:37:23Z show full local run 42895a87 (impl-429) holding the slot through repetitions, including final repetition's start. Exact-head inferred-mode local verification b14a97d5-30b5-4a2e-8e06-11211ae4aad8 was queued after source clear; waiting for its hub result. Working tree clean.

### impl-435 · 2026-10-15T03:11:00.337Z

Exact-reviewed-head local gate b14a97d5 (A-2654) exit 1: 1653 total, 1652 pass, sole failure executor-prepare.test.ts:137 (unconfirmed builder cleanup cause.status 0 vs expected 422). T-435 file passed. Separate Bugs S find and blocker reported to lead, decision requested on same-head rerun vs awaiting targeted fix. No source changes.

### rev-23 · 2026-10-15T03:11:48.548Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-15-435-2
commit: c652394614d783ec07266c83073d4ceb940353be
scope: evidence

Gate b14a97d5/A-2654 not clear at unchanged c6523946: root typecheck succeeds, 1652/1653 hub tests pass, exit 1; Neovim smoke not reached. Sole failure executor-prepare.test.ts:137 expects final unconfirmed cause.status 422 but sees 0, exactly the known T-432 final-deadline assumption. Compared the reviewed T-432 correction at c744a2aa: prove the same builder/lease's real 422 retry separately from final unconfirmed cause. Original fix 4b5846b824cd48fdd5f14a355f0465cb789dfe97; final evidence A-2599. Lead/claimant notified for shared-fix integration disposition, no unchanged rerun prescribed. T-435 unconfirmed reservation and both fallback cases pass; no T-435 criterion failure inferred. A-2655 records details. Source review rev-2026-10-14-435-1 remains the basis for unchanged own code; changed integrated head needs source review and a green complete gate. Final C2 raw evidence and claimant done marks also remain to be checked.

### impl-435 · 2026-10-15T03:13:36.393Z

Per Coordinator decision 6f6997cc, cherry-picked merged T-432 shared fix f020d2c9 as c7ebbb4c, cleanly; patch changes only executor-prepare.test.ts. Targeted node --test hub/test/executor-prepare.test.ts green 17/17 (88.17s), including formerly failing cleanup case. Delta review requested for c6523946..c7ebbb4c before local no-mode verification. Original budget-file source and 5/5 evidence unchanged.

### rev-23 · 2026-10-15T03:14:23.385Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-435-3
commit: c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e
scope: delta

Delta source clear at c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e. Standards and Spec: no high or medium findings. Independently compared the pick with merged T-432 f020d2c9: exact one-file patch, no conflicts or explorer-card hunk. It separates the same builder/lease's actual 422 retry proof from the final unconfirmed deadline cause, retaining release/state/snapshot/error/retry/restart/cost assertions and bounds. A-2656 full executor-prepare file 17/17 green, zero failures/cancellations/skips. T-435 own change and C1 evidence remain unchanged from A-2512; C1 refreshed. A-2657 details review. C2 raw five-run evidence and new exact-head complete gate remain pending final review; both claimant done marks now present. Earlier b14a97d5/A-2654 remains red on the corrected T-432 assertion. Submit local no-mode verification at this new source-cleared head.

Criteria: C1 verified.

### rev-23 · 2026-10-15T03:43:07.977Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-435-4
commit: c7ebbb4c9bf0259eeb8f850ae1a43fd10615f08e
scope: evidence

Final clear at unchanged source-reviewed c7ebbb4c. Standards and Spec: no high or medium findings. C1 red/green and durable run-specific fallback readiness remain established by A-2512/A-2657. Independently checked C2's five serial whole-file logs A-2509/A-2514/A-2516/A-2517/A-2518: each 8/8 passes, zero failures/cancellations/skips; chronology, recorded queue snapshots and full holder 42895a87/A-2519 establish concurrent full local load. Own budget-test blob unchanged since those runs; only exact reviewed T-432 shared patch was added. Same-head no-mode local gate bbf92e94/A-2661 passes typecheck and hub-only selected phases: 37 free hub +1616 machine hub +12 Neovim smoke =1665/1665, zero failures/cancellations/skips/todos, exit 0. Full Neovim was not selected or claimed. Earlier b14a97d5/A-2654 remains red on known T-432 assumption, resolved through Coordinator-directed f020d2c9 adoption and source review, not a flaky retry. Both claimant done marks checked. A-2663 details evidence and limits; C1/C2 verified at this head.

Criteria: C1 verified, C2 verified.
