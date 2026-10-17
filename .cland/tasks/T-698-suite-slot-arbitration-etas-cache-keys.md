---
id: T-698
kind: task
title: Suite slot arbitration, ETAs, cache keys and cover classification are tested on Suites directly, with two real-fixture proofs kept
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-697
topic: topic-428
branch: t/T-698-suite-slot-arbitration-etas-cache-keys
created: 2026-10-16T19:59:36.616Z
updated: 2026-10-17T09:10:15.019Z
---

## Summary

Slot arbitration and ETA maths are `Suites` scheduler state, but most cases spin up three or four worktrees, spokes, CLI submissions and fake droplets to read a queue snapshot (memo §2.2 win 2; report-slice2 #1, report-slice1 #10, report-slice4 honourable mentions). The right shape already sits in `suite-remote-budget.test.ts` ("fallback notice and log occur once across 20 ticks and restart": `new Suites(store, …)` with mocked timers in 0.1 s). The files:

- `suite-remote-budget.test.ts` (143.9 s) and `config-reload-remote.test.ts` (11.1 s, the same fixture).
- `suite-scheduling.test.ts` (36.3 s): budget 1 and 2 differ by one log line.
- `suite-queue.test.ts` (29.1 s): window-20 median and p90 over 20 cache hits.
- `suite-cache.test.ts` (36.7 s): key, mode separation, dirty bypass, expiry, supersede.
- `suite-cover.test.ts` (17.6 s): five fixture tests re-run a CLI and a worker to parse a canned log.

## What to build

These rules run as T1 tests on `Suites` with a fake executor (T-697) and a `FakeClock`: slot arbitration, remote-budget fallback, ETA from local and remote history, priority order, budget 1 and 2, cache key and eligibility, supersede, wait and run metrics, cover classification. `config-reload-remote.test.ts` merges into the budget file. Two real-fixture proofs stay T3 with headers: "finished remote runs free both budget slots" and "an unconfirmed release posts its receipt". Cache reuse across a real run stays in `suite-cache-recovery.test.ts`.

## Acceptance criteria

- [x] C1. The six files' manifest seconds fall from 274.7 s (A-3877) to 120 s or less.
  - done: impl-698 · 2026-10-17T09:00:40.633Z
- [x] C2. The scheduling, ETA, cache and cover rules sit in T1 files that pass the tier lint, and the kept T3 tests each name their process behaviour.
  - done: impl-698 · 2026-10-17T09:00:40.931Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
- [x] C3. Fake droplets started by these files fall from the count recorded before (from the fake provider's request log) to 4 or less.
  - done: impl-698 · 2026-10-17T09:00:41.297Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - done: impl-698 · 2026-10-17T09:00:41.616Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
- [ ] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - failed: rev-30 [reviewer] · 2026-10-17T09:06:09.654Z · note M1: Held candidate/provider I/O can block the fixture's first teardown hook before later release hooks run; own release/drain before Suites.close and prove pre-release failure cleanup.

## Comments

### coord · 2026-10-17T06:43:05.504Z

Coordinator correction from T-697: CLAND_TEST_DROPLET_MACHINE_MS is a readiness timeout in waitForMachine, not a fixed delay before the machine is ready. Lowering it from 2000 to 200 doesn't save 1.8 s per droplet by itself, so this ticket's speedup comes from the fixture and process work it removes (one fixture per test, in-process provider and scripted machine from T-697). Measure and report it that way. A case that needs real readiness timing keeps an explicit override, as T-697 did for the demo watchdog.

### impl-698 · 2026-10-17T08:59:55.547Z

Implementation committed at c1e629cf99b968613e2c2c15b68517a4ecb81197 after merging origin/dev. All nine touched test files pass serial whole-file 5/5 on Mac; max observed load 6.491 <15. Median total across all split files is 37.128 test-seconds /39.310 wall-seconds versus measured baseline 265.018/267.059 (reference274.7). 48-declaration audit: docs/evidence/T-698-suite-migration.md. Process provider census6 POST attempts/3 successful machines versus30/27 before, daemon starts15→0. Two mandated T3 bodies are byte-identical; real accounting/protocol remain T2. Removed24 legacy allowances, added two E-677-owned seven-day process allowances. Typecheck/tier lint pass. Preparing source review; exact-head droplet evidence pending.

### rev-30 · 2026-10-17T09:06:09.654Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-698-source
commit: 34ef04861a205697418266278904b89f777805b5
scope: full
findings: [{"severity":"medium","text":"M1: Release hooks for held candidate inspection (also suite-remote-budget.test.ts:134 provider creation) are registered after suiteUnit's cleanup. That earlier hook awaits Suites.close(), which waits for #starting/#launchWork still blocked on those releases. A pre-release assertion failure strands teardown. Release owned gates before closing Suites, drain pending work before provider/store/root cleanup, and prove both controlled pre-release failure paths without weakening the held-I/O assertions.","file":"hub/test/suite-cache.test.ts","line":108}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source review T-698 at 34ef04861a205697418266278904b89f777805b5, fixed point cc5394c06c61ee2dc92192740284ee80cbc656dd. Reviewed the 19-file change, item criteria, A-4431's 48-declaration map and A-4430's raw Mac/census receipts. Read-only inspection; no Reviewer tests or compiler runs.

Standards
Medium M1 — hub/test/suite-cache.test.ts:108, also hub/test/suite-remote-budget.test.ts:134. Both deliberately held I/O gates register release with t.after after suiteUnit has already registered its teardown. The earlier fixture hook (suite-unit-fixture.ts:92) first awaits suites.close(). close waits for #starting and #launchWork: the cache test's pending f.launch is in #starting while inspect awaits release; the ETA test's acquisition is in #launchWork while beforeCreate awaits release. An assertion failure at cache:114 or remote-budget:139 therefore reaches cleanup that cannot finish before the later release hook runs. The green success path releases both gates and does not exercise this failure path. Own/release these gates before Suites cleanup, drain their pending work before store/provider/root cleanup, and add controlled pre-release failure proof for candidate inspection and provider creation. Keep the pre-release non-completion and acquisition-time assertions.

Spec
The production change otherwise preserves policy: candidate Git/selection/tree/lint/tier/budget work is extracted into a default real SuiteCandidate; all admission and cache/launch tree fences still call it. settled() observes admitted checks/launch/inspection work without advancing time or scheduling another tick. Cover classification now stamps the hub Clock. The occasion guard now follows full inspection, so its invalid-request error precedence can differ, but its acceptance condition is preserved.

Scheduling/cache/queue/ETA/cover policy runs on production Suites with semantic executor/candidate facts and FakeClock. Real shared spend and OS-identity lock accounting remain T2; CLI/socket permissions, journal, reload and reporting have T2 boundary proofs. The two mandated remote process declarations and six expanded compatibility/PID declarations are independently byte-identical to the prior bodies. Existing cache-recovery remains unchanged and its extra 3/3 receipt is present. The 48-row assertion map covers loaded-policy capture, cap refusal, reservation cleanup, independent slots, both first-free paths, ETA history, cache eligibility/provenance/expiry, cover identities/classification, priority/head cancellation and persistence. M1 leaves the newly added held-I/O controls without reliable failure-path ownership.

Evidence and criteria
Primary Coordinator 79089639 explicitly defines C3 as successful process-machine starts, preserving rejected 422 assertions. A-4430's process census independently reports 4 attempts/1 start and 2 attempts/2 starts: six POST attempts and three started process machines (<=4), separately from 28 scripted creates. Reported baseline is 30 attempts/27 starts and 15 daemon starts; post-migration daemon starts are zero.

All 45 raw Mac logs independently have zero failures/cancellations/skips, five per nine files. Recomputed per-file median test-seconds: accounting 1.197854875, cache 0.525976374, cover 0.260886498, protocol 1.995484333, queue 0.144292416, remote-budget 1.145558583, remote-process 17.614120542, runner-contract 14.113967832, scheduling 0.234525042; sum 37.232666495. Indexed start load is at most 6.49072265625. These establish successful Mac runs, not M1's failure cleanup. C1 timing still requires exact-head Linux per-file seconds under E-677's timing disposition; C5 still requires a corrected-head task receipt.

Independent structured durations audit: every non-allow field, including timing baselines, equals the fixed point; exactly 24 existing allowances removed, two added, zero retained values modified. Both new 20-second process allowances name E-677 and have 2026-10-17/2026-10-24 dates with retained process reasons. Tier manifest removes the deleted reload file, assigns policy files T1, accounting/protocol T2, and retained process files T3. Canned multi-package reporter data is immutable data only; primary T-730 disposition permits that separate module.

Verdict not clear for M1. C5 failed for the held-I/O fixture teardown defect; no criteria are newly verified on this not-clear pass. Correct the ownership order and request source review at the new head before verification. C1-C4's substantive source/evidence observations above are retained for the correction review; no additional findings.

Criteria: C5 failed (M1: Held candidate/provider I/O can block the fixture's first teardown hook before later release hooks run; own release/drain before Suites.close and prove pre-release failure cleanup.).

### impl-698 · 2026-10-17T09:09:15.784Z

M1 corrected and pushed5922850e3b7f9404aca3c1bde5b71b11423b08c8; no dev merge after first review. Fixture owns/releases both held-I/O controls, drains pending submissions and admitted work before Suites/Store/provider/root shutdown, with idempotent shared cleanup callback. Both controlled assertion-failure paths reproduced as500ms timeouts before fix and pass after fix; original pre-release assertions retained. All six dependent files rerun5/5 serial at load<=3.292; three unchanged source/dependency files retain A-4430's5/5 receipts. Combined45 green logs and focused red/green in A-4433; updated48-declaration audit/M1 evidence A-4434. Combined median37.187 test-seconds/39.263 wall. Typecheck/tier lint/whitespace pass. C5 awaits fresh source verdict and exact-head Linux verification.

### rev-30 · 2026-10-17T09:10:15.019Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-m1-correction
commit: 5922850e3b7f9404aca3c1bde5b71b11423b08c8
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction source review T-698 at 5922850e3b7f9404aca3c1bde5b71b11423b08c8, direct child of first reviewed 34ef0486. Four-file delta only: fixture, cache/remote-budget tests and assertion/evidence document. No dev merge or production/manifest changes. Reviewed A-4433/A-4434 and retained A-4430. Read-only audit; no Reviewer execution.

Standards
M1 resolved. suiteUnit now owns release callbacks via ownIO and memoizes the same close callback registered with t.after. Its cleanup releases owned gates first, drains tracked submission promises, observes admitted scheduler work through settled(), then closes Suites, Store and provider before removing the root. launch tracks its work and removes it with a rejection-handled finally. Both original held-I/O tests use ownIO; their exact cache-expiry boundary, pre-release non-completion/concurrency checks and 2s acquisition plus 3s execution assertions remain intact.

The two new T1 controls deliberately throw a pre-release assertion and unwind through finally awaiting that normal close callback. They assert the original assertion propagates, the pending submission/acquisition has completed and the directory is removed. The candidate control checks the delivered admission after pending resolves; the provider control observes creation completion, machine start and running state after cleanup has drained acquisition. Their earliest rescue hooks do not run until test teardown, so successful explicit cleanup cannot depend on the rescue. No elapsed assertion, scheduling sleep or fake-time pumping was added. Idempotent later automatic cleanup returns the same completed promise.

A-4433 contains the concrete red reproduction: both controls cancel at the 500ms runner bound, zero passes; the red's late rejection warning is retained. Fixed focused receipt has 2/2 passes at 17.51625ms and 48.458583ms. This specifically demonstrates the M1 path rather than relying on ordinary successful release.

Spec and criteria
No remaining findings. Production candidate inspection, repeated head/tree fences, scheduler completion observer and Clock timestamp seam are unchanged from A-4432's full review. The complete 48-declaration assertion map remains applicable, with both added failure controls documented; no original assertion was removed by this correction. C2/C3/C4 verified at this exact head: policy files remain T1, real shared lock/spend and frame proofs remain T2, headed process/PID/compatibility declarations remain byte-identical T3; primary 79089639 defines C3 as successful starts, and the preserved native census remains six POST attempts / three successful process-machine starts (<=4), with scripted creates disclosed separately; original behavior mapping and new failure ownership are established.

A-4433 independently audited: 45 zero-failure/cancellation/skip Mac logs, five per nine files. Six fixture-dependent files have fresh runs; the other fifteen protocol/runner-contract/remote-process raw logs are byte-identical to accepted A-4430 and their source/dependencies are unchanged by this four-file delta. Recomputed combined median test-seconds is 37.187079958 (all nine split files included), rather than the old 37.232666495. Maximum indexed start load is 6.49072265625 including retained receipts; fresh-run maximum is reported 3.292. Archive head.txt names this exact commit. Recorded typecheck and tier-lint output is green.

C1 timing remains unverified until exact-head Linux per-file seconds establish <=120 under E-677's primary timing disposition. C5 remains pending corrected-head droplet execution; the successful Mac portion is established. Prior failed C5 finding is corrected in source, but this pass does not claim its Linux condition. The reviewed 24 obsolete allowance removals and two E-677-owned seven-day process allowances are unchanged; all baseline fields remain unchanged.

Source correction clear, no findings. Required normal mode-free exact-head droplet verification may proceed. Final C1/C5 settlement waits for its receipt.

Criteria: C2 verified, C3 verified, C4 verified.
