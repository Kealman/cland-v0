---
id: T-429
kind: task
title: "request-guard flood test fails on Linux droplets (the other client waits 3–4x the baseline): blocks droplet verification"
state: open
status: ready
size: S
rank: 2302
criterion_seq: 3
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: topic-255
branch: t/T-429-request-guard-flood-test-fails-on-linux
created: 2026-10-14T17:14:43.503Z
updated: 2026-10-14T18:50:06.704Z
---

## Summary

`hub/test/request-guard.test.ts:76` ("a client flooding task.list does not hold up another client …") fails on Linux c-8 droplets in two of two full runs on 2026-10-14. The other client waited 708 ms against a 204 ms baseline (T-385 run b1603160, A-2465), and 622 ms against 187 ms (T-383 run ba071efd, A-2466). It passes on macOS in every integrated run, including 27503044 at be45cda. Every droplet hub run fails on it, so it blocks D28's droplet verification for every task.

## Evidence

- The runs used Linux x64 c-8 in lon1, Node v24.21.0, snapshot cland-v0-341986a75486.
- Both runs were full hub phases of about 1320–1440 s, with the hub machine phase on 4 workers.
- The bound at line 76 is `waited < max(BUDGET_MS * 2, calibrated * 2)`. On Linux the flood costs the other client about 3.3–3.8 times the calibrated baseline.

## What to fix

Find why the other client waits longer behind the flood on Linux: scheduling under 4 workers, the guard's fairness, or the baseline's calibration. Fix the product if fairness is really worse there. Otherwise fix the test's bound so that it still catches a client being starved. Do not just widen the bound.

## Acceptance criteria

- [x] C1. The cause is named with evidence, and the fix is a single commit, cherry-pickable into every open task branch (shared-fix rule).
  - done: impl-429 · 2026-10-14T17:27:17.988Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-1 · 2026-10-14T17:29:21.833Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-3 · 2026-10-14T18:40:40.284Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
- [x] C2. On macOS the file passes 5/5 whole-file runs, and the test still fails when the guard is bypassed, so it still detects a starved client.
  - done: impl-429 · 2026-10-14T17:27:21.234Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-1 · 2026-10-14T17:29:21.833Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-3 · 2026-10-14T18:40:40.284Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
- [x] C3. A `cland verify --executor droplet` of the fix branch (diff selection) is green on Linux and runs this file.
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-c3 · 2026-10-14T17:58:27.414Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
  - verified: rev-23 [reviewer] · run rev-2026-10-14-429-3 · 2026-10-14T18:40:40.284Z · commit d3071031c0fc2e646cdff77d3f42e916da5e776a
  - done: impl-429 · 2026-10-14T18:50:04.726Z

## Comments

### impl-429 · 2026-10-14T17:22:36.617Z

Red-capable minimized reproduction added at the existing Unix-socket seam: 500 cold task.list requests in one write. Before fix, 276 replays vs 499 required (224 handlers ran); macOS splits the write into chunks, whereas Linux can admit the whole burst before the first async answer. ConversationGuard remembers only completed answers, so expiry or any startup freshness invalidation reopens the burst to repeated synchronous list projections. Keeping the latency bound unchanged; implementing same-generation pending-read coalescing.

### rev-23 · 2026-10-14T17:29:21.833Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-429-1
commit: d3071031c0fc2e646cdff77d3f42e916da5e776a
scope: full

No high or medium Standards/Spec findings in all three files. Connection-local pending identical reads join only the same generation; correlated fanout uses existing peer/visibility/answer timing, failed results not cached, old completion cannot remove newer pending read, write/role invalidations retained. Cold 500-request regression and interleaved-write titles establish reduced work/correlation/freshness without changing original latency/log assertions. C1 named mechanism/single commit verified; Linux timing attribution remains inference awaiting run. C2 A-2469 five macOS whole-file 15/15 runs and guard-bypass both tests red verified. Caveat: bypass failed replay-log and cold-burst assertions, not original calibrated latency alone; no bound widening. C3 awaits green same-head no-mode droplet verify running this file. A-2471: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2471-t-429-source-review-pending-reads-correlated-fanout-and-write-freshness.md.

Criteria: C1 verified, C2 verified.

### impl-429 · 2026-10-14T17:56:22.709Z

C3 completed under Coordinator ruling ab3ea386-bd68-4fb6-a2bc-a506bbbed832: exact reviewed-head Linux c-8 run 56d039e0 / A-2481 ran all 15 request-guard cases green (lines 1033-1048); other client 78 ms vs baseline 228/142 ms. Overall run exit 1 came from unrelated executor failures at lines 1866-1897: prepare cleanup is T-432; crash-after-acquire duplicate suite ref is being filed by the Coordinator. No source changes. Coordinator requires same-head no-mode local verify for the final merge gate under the human's 17:18Z decision.

### rev-23 · 2026-10-14T17:56:29.230Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-429-2
commit: d3071031c0fc2e646cdff77d3f42e916da5e776a
scope: evidence

Medium — hub/test/executor-prepare.test.ts:137: expected422, got0 in unconfirmed builder deletion case. Medium — hub/test/executor-run.test.ts:193: crash-after-acquire recovery fails remote start because git suite ref already exists under zero-old-value update-ref. A-2481 56d039e0 auto full droplet exits1:1649pass/2fail/3macOS-only skips, Neovim not reached; Linux x64 c-8 lon1,1495s/$0.1038. T-429 fairness passes78ms vs228/142ms baseline; cold correlation/write-freshness regression passes. Source/C1/C2 stand, no causal guard defect asserted. C3 fails green overall gate. Bugs S aside each escalated; multiple failures do not authorize unchanged retry. A-2482: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2482-t-429-linux-guard-passes-complete-run-blocked-by-two-executor-failures.md.

Criteria: C3 failed (Exact-head Linux verify 56d039e0 exits 1 for two executor cases, so required green complete verification is absent despite passing request-guard tests.).

### rev-23 · 2026-10-14T18:40:40.284Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-429-3
commit: d3071031c0fc2e646cdff77d3f42e916da5e776a
scope: evidence

Final clear; C1–C3 verified at unchanged clean d3071031. Authorized local gate 42895a87/A-2519 passes root typecheck and2041/2041 (37 free,1617 hub,387 Neovim),zero failure/cancel/skip/todo; fairness67ms vs494/190ms. C3 under Coordinator ab3ea386: all15 Linux guard cases in56d039e0/A-2481 green,78ms vs228/142ms; overall red remains T-432/T-433 with3platform skips,1495s/$0.1038,not complete Linux success. A-2483 supersedes earlier C3 interpretation; human de65131f sets local merge gate. Source/C1/C2 retained: five macOS passes, bypass red controls, original bounds unchanged. No high/medium T-429 findings. A-2520: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2520-t-429-final-local-gate-and-scoped-linux-fairness-proof.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-429 · 2026-10-14T18:50:03.375Z

Restoring C3 done after Coordinator merge-gate notice 36b67357-d3ad-4b7b-8e61-ebac28b83b5a. Per 17:56Z ruling ab3ea386, A-2481 lines 1033-1048 show all 15 request-guard tests green on Linux at d3071031 (other-client wait 78 ms; baseline 228/142 ms). Unrelated Linux suite failures remain T-432/T-433. Same-head local merge-gate run 42895a87 / A-2519 passed typecheck and 2041/2041 tests.
