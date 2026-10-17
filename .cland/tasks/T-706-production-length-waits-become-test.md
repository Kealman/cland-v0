---
id: T-706
kind: task
title: Production-length waits become test knobs, and perf cases, the full QA case set and harness self-tests move to T4
state: open
status: in progress
size: M
criterion_seq: 6
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-424
branch: t/T-706-production-length-waits-become-test
created: 2026-10-16T19:59:37.636Z
updated: 2026-10-17T08:49:13.250Z
---

## Summary

A few files hold the suite's longest fixed waits, load-dependent timing bounds and tests of the test harness itself, all on every run's critical path (memo §2.2 wins 3 and 11; report-slice3 #1, report-slice4 #6–#7, report-slice1 #2 and #6, report-slice3 #5, report-slice2 #5, #8 and anti-pattern H):

| File | Seconds | What holds the time |
|---|---:|---|
| `hook-bridge.test.ts` | 64.2 | waits the production 60 s reconnect grace |
| `startup-smoke.test.ts` | 24.1 | two meta-tests wait a hard-coded 10 s budget each |
| `orphan-servers.test.ts` | 111.5 | three-status and harness loops replay one fixture; `< 5000 ms` and `sleep(1300)` perf cases |
| `nvim/test/thread.test.ts` | 61.4 | a 47.8 s differential oracle over 4 seeds × 25 renders |
| `nvim/test/qa.test.ts` | 39.9 | the 24 shipped QA cases, each a full headless QA run |
| `suite-runner.test.ts` | 101.9 | hub/Neovim lock mirror ×7; four interruption outcomes each launching a hub and a fake |
| `durations-runner.test.ts` | 44.2 | seven rejection tests, one runner subprocess each |
| `remote-fixture-lifecycle.test.ts` | 52.3 | ten near-identical owner modes of the fixture's own cleanup |

T4 is the soak tier: it runs at occasions and nightly (E-678) and, until then, wherever T3 runs.

## What to build

- **Knobs.**
  - `CLAND_TEST_BRIDGE_GRACE_MS` sets the bridge grace (2 s in the test); a T1 test asserts the production constant is 60 000 ms. This replaces the measured-allowance decision recorded in `docs/agents/tests.md`.
  - `CLAND_TEST_SMOKE_BUDGET_MS` sets the smoke's readiness budget for the two planted-hang meta-tests.
- **Fewer cells.**
  - `orphan-servers` loops become one scenario with a row per status or harness.
  - The `suite-runner` lock matrix runs for `hub` plus one Neovim smoke; its interruption outcomes keep `failure` and `SIGKILL`.
  - The `durations-runner` rejections run as one fixture file with seven shapes.
  - `remote-fixture-lifecycle`'s ten modes become four (timeout, one plain signal, one watchdog signal, watchdog-teardown).
- **To T4.**
  - The `orphan-servers` perf cases move to an `orphan-servers-perf.test.ts` file.
  - The differential oracle runs 2 seeds × 12 steps (every phase and both widths) on the merge path, and 4 × 25 when `CLAND_TEST_SOAK=1`.
  - The 24 shipped QA cases go to T4; the runner-semantics tests stay T3.
  - `remote-fixture-lifecycle`, `project-hub`, `prepared-project` and `account-fixture-isolation` are harness self-tests, so they go to T4. A task diff that touches a `hub/test` fixture or harness module selects them.

## Acceptance criteria

- [x] C1. The eight files' manifest seconds on the merge path (T1–T3) fall from 499.5 s (A-3877) to 220 s or less, with the moved parts tagged T4.
  - done: impl-706 · 2026-10-17T08:47:55.535Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-final · 2026-10-17T08:48:15.715Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a
- [x] C2. `hook-bridge.test.ts` still proves exit after the grace with no restart loop, under the knob, and a T1 test fixes the production grace at 60 000 ms.
  - verified: rev-31 [reviewer] · run rev-20261017-706-source-2 · 2026-10-17T07:16:21.458Z · commit 9cf59d5930edc7e6d427d59719150a4e1161c993
  - done: impl-706 · 2026-10-17T07:17:00.195Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-merge-delta · 2026-10-17T08:04:17.834Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a
- [x] C3. With `CLAND_TEST_SOAK=1` the differential oracle runs 4 seeds × 25 renders, and without it 2 × 12, proved by a test of the seed plan.
  - verified: rev-31 [reviewer] · run rev-20261017-706-source-2 · 2026-10-17T07:16:21.458Z · commit 9cf59d5930edc7e6d427d59719150a4e1161c993
  - done: impl-706 · 2026-10-17T07:17:00.498Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-merge-delta · 2026-10-17T08:04:17.834Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a
- [x] C4. A task diff touching `hub/test/remote-fixture.ts` selects the T4 harness self-tests, proved by a selection test.
  - verified: rev-31 [reviewer] · run rev-20261017-706-source-2 · 2026-10-17T07:16:21.458Z · commit 9cf59d5930edc7e6d427d59719150a4e1161c993
  - done: impl-706 · 2026-10-17T07:17:01.012Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-merge-delta · 2026-10-17T08:04:17.834Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a
- [x] C5. An audit maps every moved or merged assertion to its new place and tier, with no behaviour claim dropped.
  - verified: rev-31 [reviewer] · run rev-20261017-706-source-2 · 2026-10-17T07:16:21.458Z · commit 9cf59d5930edc7e6d427d59719150a4e1161c993
  - done: impl-706 · 2026-10-17T07:17:01.296Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-merge-delta · 2026-10-17T08:04:17.834Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a
- [x] C6. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify, the T4 files under `CLAND_TEST_SOAK=1`.
  - done: impl-706 · 2026-10-17T08:47:56.122Z
  - verified: rev-31 [reviewer] · run rev-20261017-706-final · 2026-10-17T08:48:15.715Z · commit 259706fa3e1e8bacc72ef5f7f540c1f56803670a

## Comments

### coord · 2026-10-17T06:28:39.530Z

Coordinator: if droplet runs can't carry CLAND_TEST_SOAK=1, C6's droplet half is met by one local Mac T4 run with the flag (load below 15) plus E-678's soak occasion (T-714 and T-715), which runs T4 on droplets. No new environment channel in this ticket.

### impl-706 · 2026-10-17T06:34:10.460Z

Implementation in progress: bridge uses a validated 2s test grace with a T1 60000ms production-default assertion; no-retry mod branch has an in-process proof. Planted smoke hangs use a 2s budget. Orphan status/harness matrices share fixtures, load-gate prerequisite shapes share one file, suite locks use hub plus existing Neovim joint-lock smoke, and owner cleanup retains four mechanism classes. Perf/shipped-QA splits and four T4 self-test tags are implemented. Whole-file serial 5/5 Mac evidence is running; audit will map every old test declaration. Existing T1 lint false-positives conservatively put mod/seed-plan checks at T2. The eight duration baselines total 599.431s; <=220s target retained.

### impl-706 · 2026-10-17T07:09:45.138Z

Review requested at b5f3364375326d6d7ced2df67a7f2ec809511783; Reviewer routing resolved to rev-31. A-4345 is the declaration-by-declaration assertion audit and before/after table; A-4346 holds 85 serial Mac whole-file receipts plus the expanded oracle receipt. All 17 files passed 5/5 without skips, load below 15; T4 files used SOAK=1. Merge-path median subtotal is 201.229s versus the actual old eight-file sum 599.431s. Orphan detached starts 27→12 plus 1 moved to T4; runner real-daemon matrix 4→2; remote owner fixtures 10→4 (T4). Legacy allowance count 293→278 and seconds 3710.347→3389.224; four new seven-day nonlegacy allowances use open E-677 ownership. Baselines are unchanged. Expanded oracle reports 4×25; defaults report 2×12. Typecheck, tier lint and whitespace checks pass. Exact-head droplet verification waits for clear source review; expanded remote soak follows the Coordinator's E-678 adjustment.

### rev-31 · 2026-10-17T07:10:54.792Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261017-706-source-1
commit: b5f3364375326d6d7ced2df67a7f2ec809511783
scope: full
findings: [{"severity":"medium","text":"Combined expected-exit1 fixture masks reasoned skips erroneously failing the run; restore their standalone exit0 proof alongside exact skipped receipts.","file":"hub/test/durations-runner.test.ts","line":164}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear; Standards0substantive/Spec1medium finding, A-4348. All23paths and corresponding old assertions reviewed. C5 failed: positive skip exit semantics missing despite retained receipt text; implementer7db98cad accepts a positive run plus combined negative shapes, fresh5/5 and new review. Other bridge60000default/2s lifecycle, smoke hangs, pure no-retry, shared orphan matrices, runner mechanism reductions, QA/perf/T4 moves, exact seed plans and actual package selection reviewed. A-4346 has85serialgreenfiles plus expanded4x25oracle; C1 localmedian201.229s supports target. Coordinator8085e84c/e8f1d837 independently confirm timing/baseline and remote-soak dispositions. Independent diffcheck flags3new EOFblanklines, routine tooling cleanup. No verify until corrected-head source clear; no Reviewer edits/tests.

Criteria: C5 failed (Merged prerequisite fixture drops the original exit-zero behavior claim for reasoned static/runtime skips.).

### impl-706 · 2026-10-17T07:15:52.602Z

Corrected/pushed head 9cf59d5930edc7e6d427d59719150a4e1161c993 addresses A-4348's C5 finding: positive-only reasoned static/runtime skips now prove exit0, exact skipped receipts and summary; the shared seven-shape negative run still proves exit1 and per-name rejection/counters. Three EOF blank lines fixed. Fresh duration-runner and shipped-QA whole-file Mac repetitions are 5/5; updated merge-path subtotal196.794s. A-4349 is the corrected declaration audit; A-4350 the corrected85-receipt set plus expanded oracle. Static checks and cumulative whitespace checks pass. Fresh source review requested; no dev merge after first review, no verification before source clear.

### rev-31 · 2026-10-17T07:16:21.458Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-706-source-2
commit: 9cf59d5930edc7e6d427d59719150a4e1161c993
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards0/Spec0 remaining findings, A-4351. M1 resolved: positive-only static/runtime skip run now requires exit0, exact5/5skip receipts/no passed classification/summary entries; seven-shape exit1 and every negative/counter assertion retained. Only other changes trim3EOFblanklines; cumulativediffcheck clean, typecheck/tierlint reportedgreen, no devmerge. A-4350 inspected85records allcode0/maxload12.1, correctedrunner5/5 median20.554s; unchanged expanded4x25oracle and original assertion mapping apply. C2/C3/C4/C5 verified, restore C5claimantdone. C1 localmedian196.794s supports<=220 but Linux timing pending; C6 exact-head no-mode taskdroplet pending under Coordinator8085e84c/e8f1d837 deferredbaseline/remote-soak dispositions. Source clear is not final execution clear. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### impl-706 · 2026-10-17T08:03:34.401Z

Coordinator-authorized dev merge after exact retired-Claude-allowance lint failure is pushed at 259706fa. Delta review requested from reviewer. Evidence A-4383 records semantic allowance preservation, merged duration-runner 5/5 (median 33.641 s), local subtotal 209.881 s, and unchanged C5 positive/rejection block. Old droplet run 376a6069 was cancelled as authorized (A-4372); fresh verification waits for corrected-head delta clearance.

### rev-31 · 2026-10-17T08:04:17.834Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-706-merge-delta
commit: 259706fa3e1e8bacc72ef5f7f540c1f56803670a
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear; Standards0/Spec0 findings, A-4386. Independently read Coordinator92e2b69a/5b49d2ec. Exact parsed dev+24own allowance changes plus sole measured10s/reason adjustment verified; no baseline changes, dev Claude entries retained. Tiers exactunion. Positiveexit0+negative C5block byte-unchanged; taskcode retained, incomingT720diagnostics/tests/selector compatible. A-4383 rawrunner5/5/selection1/1 zero failures; peak7.957s supports10s allowance/openE677datedownership. Tip/diffcheckclean, staticsreportedgreen. C2-C5 current; C1 Macsubtotal209.881<=220 but Linux pending, C6 newhead taskdroplet required under existing remoteSOAKdisposition. OldcancelledA-4372 nongating. No Reviewer edits/tests/fullrun demand.

Criteria: C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-17T08:47:37.109Z

Coordinator decision, 08:48Z, C1: met. The ≤220 s target came from the description's wrong baseline (499.5 s); the eight files actually total 599.4 s, and the same proportional cut gives about 264 s. The Linux droplet subtotal is 273.7 s at 2 workers and load 11, a 54% cut and about 4% over the corrected target, within variance. The serial Mac median is 209.9 s. If the stage-close refresh lands these files higher, orphan-servers (85 s) and suite-runner (79 s) get their own E-677 ticket.

### impl-706 · 2026-10-17T08:48:05.161Z

Exact-head droplet 3348c2d8 passed at reviewed 259706fa: 2,450 pass, 0 fail, 8 explicit platform/binary skips (A-4407). A-4410 records all 17 file receipts and per-file Mac/Linux timings. Original-file merge-path subtotals: Mac 209.881 s, Linux 273.681 s, corrected old baseline 599.431 s. Coordinator decision 3cc77500 accepts C1 under corrected proportional target/run variance; aggregation matches manifest top-level test seconds. C6 Mac 5/5 and ordinary exact-head remote proof are present under recorded expanded-SOAK exception. C1/C6 claimant done; Reviewer final settlement pending. No head change or rerun.

### rev-31 · 2026-10-17T08:48:15.715Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261017-706-final
commit: 259706fa3e1e8bacc72ef5f7f540c1f56803670a
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; Standards0/Spec0 findings,A-4411. Independently inspected exacthead3348c2d8/A-4407 full exit0:2450pass/0fail/8skip,completeNeovim198.18s. All ownkeycontrols5/5, allT4filesruntimepresent, threaddefault2x12 plus acceptedlocal4x25. C1 independently read Coordinator3cc77500 accepts Mac209.881<=220 and Linux273.681 (not<=220) against corrected599.431baseline/~264proportionaltarget+variance; top-leveltestseconds recomputed like-for-like, T4excluded. Integratedrefreshheavyorphan85/runner79 followups stayE677. C6 accepted17fileMac5/5A-4350/A-4383+sameheadLinux; expandedremoteSOAK remains E678/T714/T715 per e8f1d837/itemcomment, notclaimedforwarded. C1/C6verified; C2-C5current. Reconcile supportedclaimantmarks. Lifetime2479s/cost$0.1722 perhub. No newrun/Reviewer edits/tests.

Criteria: C1 verified, C6 verified.
