---
id: T-698
kind: task
title: Suite slot arbitration, ETAs, cache keys and cover classification are tested on Suites directly, with two real-fixture proofs kept
state: open
status: ready
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
updated: 2026-10-17T12:29:05.695Z
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
  - verified: rev-30 [reviewer] · run rev-20261017-698-final · 2026-10-17T10:56:45.074Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - done: impl-698 · 2026-10-17T12:26:58.848Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-merged-final · 2026-10-17T12:29:04.213Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
- [x] C2. The scheduling, ETA, cache and cover rules sit in T1 files that pass the tier lint, and the kept T3 tests each name their process behaviour.
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
  - verified: rev-30 [reviewer] · run rev-20261017-698-phase-merge · 2026-10-17T10:07:14.312Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-final · 2026-10-17T10:56:45.074Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-check-merge · 2026-10-17T11:27:14.326Z · commit 5139daac886c1270942cf1dbd5ff62d59de52de3
  - done: impl-698 · 2026-10-17T12:26:59.219Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-allowance-delta · 2026-10-17T12:29:03.274Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
  - verified: rev-30 [reviewer] · run rev-20261017-698-merged-final · 2026-10-17T12:29:04.213Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
- [x] C3. Fake droplets started by these files fall from the count recorded before (from the fake provider's request log) to 4 or less.
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
  - verified: rev-30 [reviewer] · run rev-20261017-698-phase-merge · 2026-10-17T10:07:14.312Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-final · 2026-10-17T10:56:45.074Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-check-merge · 2026-10-17T11:27:14.326Z · commit 5139daac886c1270942cf1dbd5ff62d59de52de3
  - done: impl-698 · 2026-10-17T12:26:59.512Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-allowance-delta · 2026-10-17T12:29:03.274Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
  - verified: rev-30 [reviewer] · run rev-20261017-698-merged-final · 2026-10-17T12:29:04.213Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-698-m1-correction · 2026-10-17T09:10:15.019Z · commit 5922850e3b7f9404aca3c1bde5b71b11423b08c8
  - verified: rev-30 [reviewer] · run rev-20261017-698-phase-merge · 2026-10-17T10:07:14.312Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-final · 2026-10-17T10:56:45.075Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - verified: rev-30 [reviewer] · run rev-20261017-698-check-merge · 2026-10-17T11:27:14.326Z · commit 5139daac886c1270942cf1dbd5ff62d59de52de3
  - done: impl-698 · 2026-10-17T12:27:00.041Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-allowance-delta · 2026-10-17T12:29:03.275Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
  - verified: rev-30 [reviewer] · run rev-20261017-698-merged-final · 2026-10-17T12:29:04.213Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261017-698-final · 2026-10-17T10:56:45.075Z · commit 87aa55d71340b2efd11c9bad9202533eb036de9d
  - done: impl-698 · 2026-10-17T12:27:00.405Z
  - verified: rev-30 [reviewer] · run rev-20261017-698-merged-final · 2026-10-17T12:29:04.213Z · commit e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca

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

### impl-698 · 2026-10-17T10:01:50.423Z

Exact reviewed-head droplet98ee3395 (A-4446) failed deterministic suite-tiers phase expectation0/5 and three native runner-contract duration budgets. All nine migration files' assertions passed; first Linux summed86.860668189 test-seconds. Comparison: dev601d9cde passes, task5922850e isolated snapshot reproduces exact five retag moves/deleted reload path mismatch. Corrected phase expectation preserves frozen legacy contract separately and checks all current live tier membership; legacy-shards fixture byte-identical. Added three8s E-677-owned allowances (2026-10-17 to2026-10-24) for unchanged native cross-process proofs measured5.617/5.591/5.528s. Coordinator74997981 explicitly authorized origin/dev merge under rule11; merged601d9cde afterfix, preserving dev's unmodified duration entries/baselines and sorted tiers. Typecheck/tier lint/whole corrected tier file pass. Ten-file serial5/5 is running before delta review; no new verification yet.

### impl-698 · 2026-10-17T10:05:46.225Z

Correction and authorized merge are pushed at 87aa55d71340b2efd11c9bad9202533eb036de9d. Phase fixture unchanged; frozen legacy compatibility and live current-tier phase membership now pass separately. Three unchanged native >5s cases have scoped 8s E-677 allowances expiring 2026-10-24. Fixed in a70d0d45, then merged authorized dev601d9cde in2996a800; retained every unmodified dev duration entry/baseline and both sorted tier sets. All ten task files pass fresh serial whole-file5/5 (50 green logs), median total36.004694419 test-seconds/38.106870625 wall, max load2.810. Typecheck/tier lint/whitespace green. A-4448 contains task/dev red-green comparison and all50 receipts; A-4449 updated assertion audit and Linux86.861s nine-file observation from red A-4446. Requesting one delta review covering fix+merge before next exact-head verification.

### rev-30 · 2026-10-17T10:07:14.312Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-phase-merge
commit: 87aa55d71340b2efd11c9bad9202533eb036de9d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction and authorized merge source review T-698 at 87aa55d71340b2efd11c9bad9202533eb036de9d. Origin matches. Delta from reviewed 5922850e: correction a70d0d45, merge2996a800 with dev601d9cdec32ea385d3e72fb23bc8e0ca57ae6ef5, then evidence documentation. Primary Coordinator 40a23949 owns the failed phase test/budgets; 74997981 explicitly authorizes this full rule-11 merge, manifest reconciliation, serial checks, one delta review and new exact-head verification. Reviewed A-4446/A-4448/A-4449. Read-only audit; no Reviewer execution.

Standards
No findings. The frozen hub/test/fixtures/legacy-shards.json Git blob is unchanged. The corrected legacy test builds a scratch project containing that fixed declared file set and legacy manifest, then compares packageShards to explicit historical free/machine targets, one/four workers and the Neovim package target. Its filesystem cleanup owns no process writers. A separate live-tree test independently compares the complete manifest key set with globbed test files, then compares the full planner result to current T1/free versus T2–T4/machine placement, workers1/4 and the unchanged Neovim phase. It no longer equates deliberately migrated files with an obsolete partition. Both historical compatibility and current live coverage/phase claims remain asserted.

The three scoped8s allowances preserve unchanged native contract assertions: two-phase lease metadata and UTC/legacy holder identity. A-4446 measures5.617244231 /5.591393930 /5.527962421s respectively. Each allowance names the native boundary, measured run, E-677 owner, added2026-10-17 and expiry2026-10-24. Existing two20s remote-process allowances are unchanged.

Independent merge audit: all sixteen previously reviewed own patches outside documentation, manifests and the new suite-tiers correction are normalized-zero-context identical relative to their old/new incoming dev. This includes SuiteCandidate, Suites, Clock classification, scripted machines, every migrated fixture/test, M1's release/drain controls and retained process bodies. tiers.json exactly equals incoming dev plus the already reviewed task delta and is sorted. durations.json equals incoming dev in every non-allow field and retained allowance, with exactly24 prior removals and five task additions (two reviewed20s plus three new8s); no extra modification or timing-baseline refresh. Incoming T-729 lint and T-696/T-701 changes remain intact.

Spec and evidence
A-4446 is retained red evidence, not a qualifying final run: one ordinary failure plus0/5 phase-plan identity and three hard duration budgets. The isolated task snapshot reproduces precisely the five migrated T1 moves and removed config-reload path; the isolated dev case passes. The corrected phase file passes8/8 in its focused receipt. Thus the correction addresses the demonstrated mismatch without changing the captured fixture or hiding current coverage.

A-4448 independently audited: fifty raw whole-file Mac receipts, ten files x5, each zero failures/cancellations/skips. Indexed run-boundary loads are <=2.55517578125 across1/5/15minute windows (stricter than the request's conservative2.810 summary). Recomputed median test-second sum is36.004694419 including the newly touched tier file, versus37.187079958 for the preceding nine-file round. The ten medians are accounting1.221027208, cache0.511765208, cover0.241586836, protocol1.944922374, queue0.119409626, remote-budget1.177041293, remote-process17.388307041, runner-contract13.077897, scheduling0.205092624, tiers0.117645209. Static typecheck/tier-lint logs are green; whitespace check is reported green. No new native process is introduced by the two phase checks; the accepted six POST attempts/three successful process starts census remains applicable.

C2/C3/C4 source verification refreshed: lower-tier policy and headed native proofs; successful-start census<=4 under primary79089639; complete48-declaration map plus M1 controls and corrected legacy/live phase checks. No behavior claim is dropped. C1 timing and C5 final execution remain pending a green exact-head Linux receipt. The prior nine-file86.860668189s observation belongs to failed5922850e and does not settle those criteria at87aa55d7.

Delta source clear, no findings. Required mode-free exact-head droplet verification may proceed.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-698 · 2026-10-17T10:55:45.213Z

Run 3e7b9f43 at unchanged reviewed 87aa55d7 is accepted as exact-head Linux evidence by Coordinator disposition9fdd9730. All ten task files passed (68 tests, total82.925098850 test-seconds <=120). Overall receipt A-4467 is red solely for the known out-of-diff T-733 behavioral defect; the T-701 verifier-routing budget line is report-only. Coordinator directs retaining head and batch integration after cover23e61e03. C5 now done; all criteria checked. A-4468 records exact per-file Linux timings, platform/lifetime/cost and disposition. Requesting Reviewer final same-head evidence verdict; no source/head change or new verification.

### rev-30 · 2026-10-17T10:56:45.075Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-final
commit: 87aa55d71340b2efd11c9bad9202533eb036de9d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence review T-698 at unchanged source-clear 87aa55d71340b2efd11c9bad9202533eb036de9d (A-4450 / rev-20261017-698-phase-merge). Origin and hub record match. Reviewed exact-head droplet3e7b9f43-7266-4fb7-a05e-2654456e9cc0 / A-4467 and A-4468. Read-only audit; no Reviewer execution.

Gate disposition
The overall receipt is red, exit1:2090 pass,one fail,five skips. Its sole behavioral failure and0/5 load identity are lead-routing-process's unchanged “long idle and death climb…” native FakeClock death wait. Primary Coordinator decision9fdd9730-c17d-442e-99e3-3664f1f281ca explicitly accepts this receipt as T-698's exact-head Linux evidence, classifies that failure as the known T-696×T-701 defect fixed on dev by T-733/20e71b3e, directs keeping this head and obtaining the final verdict, and assigns the combined tree to batch cover after23e61e03. The additional verifier-routing-process5.351s budget line is outside this diff and is explicitly accepted as report-only in that disposition. These are accepted external exceptions, not a claim that this run is green.

Standards
No task findings. All ten owned files pass ordinarily (68 cases), and every one of their38 load-gated identities passes5/5,190/190 repetitions. This includes M1's two controlled pre-release cleanup proofs, the separate frozen-legacy/current-live phase proofs, cache/ETA/reload/accounting/cover semantics and unchanged native worker/PID contracts. The first red98ee3395/A-4446 remains the historical deterministic phase/budget diagnosis; this is the corrected-head execution.

Spec and criteria
C1 verified under E-677's primary timing policy. Independent exact-head ordinary Linux sums:
cache4.776763394; cover2.641544746; queue1.115568441; scheduling1.697939196; remote-budget4.982158219; accounting3.745529770; protocol7.661804917; runner-contract26.647888028; remote-process29.058091198; tiers0.597810941 seconds.
All ten files total82.925098850 (<120), conservatively including every extracted companion plus the newly touched tier file. Accepted A-4448's fifty serial whole-file Mac logs total36.004694419 median test-seconds /38.106870625 wall, all ten files x5, zero failures/cancellations/skips; independently audited in A-4450 with maximum recorded boundary load2.55517578125. No partial duration baseline rewrite is claimed.

C5 verified from those fifty current-source Mac logs and all ten files' passing exact-head Linux execution under the primary gate exception. Linux case counts are10cache,9cover,2queue,5scheduling,14remote-budget,5accounting,7protocol,6runner-contract,2remote-process,8tiers=68; no owned case skips. C2/C3/C4 remain source-current and are refreshed: T1 policy with real shared lock/spend/protocol T2 and headed native T3; accepted process census six POST attempts/three successful process-machine starts<=4; complete48-declaration assertion map plus M1 and phase controls. The three measured8s and two20s E-677-owned seven-day native allowances retain all process assertions; baseline fields remain unchanged.

Execution limits
Hub free117/117 and machine1979 total/1973 pass/one fail/five skips reconcile to2096 tests,2090 pass,one fail,five skips. Neovim smoke did not execute because the hub phase stopped; it is not claimed complete. The explicit batch-cover disposition supplies combined-tree follow-through. Host typecheck succeeds/reuses candidate-tree receipt4a739f209795f111b0e66f86dd674c2ea3e93ed3. Linux x64 c-8 lon1,Node24.21.0/Neovim0.12.5,two workers; suite2747.82s,peak1m load10.53,load-gate extra wall55.32s,lifetime2823s,cost$0.1960.

Final review clear under primary9fdd9730, no task findings; C1-C5 verified at this exact head. No new task run or head change requested.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-698 · 2026-10-17T11:25:50.788Z

Authorized conflict merge pushed at5139daac886c1270942cf1dbd5ff62d59de52de3 (parents87aa55d7 and dev6111e325), per Coordinator8fd9f1d4 and52c22ed8. Resolved suites.ts overlap with candidate.tree + dev suiteCheckCommand/log and lint report imports; manifests exactly equal incoming dev plus unchanged reviewed task changes (24 removals/five additions in allowances; ten tier key changes, sorted). No other manual changes. Typecheck/test:tiers/whitespace pass; suite-check, scheduling, cover, candidate, candidate-remote, dry-run and tiers whole-file5/5 serial,35 green logs, max observed load4.973145. A-4477 raw evidence and structured manifest audit. Delta source review requested; new exact-head droplet run follows clear verdict per52c22ed8, superseding manifest-only no-rerun disposition.

### rev-30 · 2026-10-17T11:27:14.326Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-check-merge
commit: 5139daac886c1270942cf1dbd5ff62d59de52de3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Conflict/code-integration delta review T-698 at 5139daac886c1270942cf1dbd5ff62d59de52de3, merge parents prior final-clear87aa55d71340b2efd11c9bad9202533eb036de9d and incoming dev6111e325. Origin matches. Primary8fd9f1d4 authorizes conflict merge; primary52c22ed8 explicitly extends it to suites.ts, supersedes the manifest-only no-rerun disposition, prescribes serial checks and requires fresh exact-head droplet verification. Reviewed A-4477. Read-only audit; no Reviewer execution.

Standards
No findings. The suites.ts resolution composes the previously reviewed candidate seam with incoming test-check integration. #hostGate still obtains the candidate tree through #candidate.tree, then selects the command with incoming suiteCheckCommand, logs the actual npm command and records that same command/code/tree after child close. Old candidate packages retain run typecheck; candidates exposing test:lint/check use run check. Existing failure/cancellation and before-droplet gate behavior remains. Dry-run retains incoming lintTests/testLintReport output, and suiteSummary retains incoming report-lint lines. The obsolete direct exec/Git/candidate/lint imports remain removed because unchanged SuiteCandidate owns committed/worktree tier inspection and candidate facts. Both tier lint calls and every previously reviewed head/tree fence remain.

Relative to prior reviewed suites.ts, additions are exactly incoming lint/check imports, summary lines, dry-run report and host-command/log selection. Relative to incoming dev, the remaining changes are the already reviewed candidate/clock/settled migration. Independent normalized-zero-context comparison confirms every other own patch outside the two manifests unchanged relative to old/new incoming dev. M1 gate-release/draining ownership, assertion map, phase correction and native process contracts are intact.

Independent structured manifest audit: durations.json equals incoming dev plus exactly the same29 task-key changes (24 removals,five additions), with all retained dev values and all non-allow fields preserved. tiers.json equals incoming dev plus exactly the same10 task-key changes (nine additions/modifications,one removal), with both complete entry sets and sorted keys. No new allowance or partial timing-baseline refresh is introduced by the merge.

Spec/evidence
A-4477 independently contains35 raw zero-failure/cancellation/skip Mac logs: suite-check,suite-scheduling,suite-cover,suite-candidate,suite-candidate-remote,suite-dry-run,suite-tiers each5/5. Its head.txt pins5139daac; reported maximum load4.973145<15. The checks exercise candidate tree/admission, check CLI and old-package fallback, report summaries, dry-run and phase composition. Static typecheck and tier-lint logs are green; clean tree/whitespace check is reported. These are the serial matching-file proofs prescribed by52c22ed8.

C2/C3/C4 source freshness is refreshed: lower-tier scheduling/cache/cover policies and headed native proofs, successful-machine census<=4 under primary79089639, and the complete preserved assertion map plus corrected phase/cleanup controls. C1 timing and C5 runtime are pending the new exact-head Linux run. A-4467/A-4469 remain accepted prior-head measurements under9fdd9730; they are not execution of this code merge and the no-rerun exception does not carry forward.

Delta source clear, no findings. C2/C3/C4 verified. Submit the required normal mode-free exact-head droplet verification; final C1/C5 settlement awaits its receipt.

Criteria: C2 verified, C3 verified, C4 verified.

### impl-698 · 2026-10-17T12:27:00.699Z

Pushed durations-only e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca: three8s retained native runner allowances, E-677 owner,2026-10-24 expiry, measured Linux reasons. No source/test/baseline change. Typecheck/test:tiers/whitespace pass; runner-contract fresh5/5 serial, maxload2.791. Coordinator f0015a3c accepts e08d5116 evidence across allowance-only child and directs no rerun; external budget follow-up remains Coordinator-owned. Coordinator87ff1db6/909ad94d settle C1 by allten Mac serial medians, with overloaded Linux disclosed. A-4505 reconciles50 green Mac logs, summedmedian37.258769833s; A-4507 records Linux132.370394780s, name-reservation2.8098x inflation and platform/lifetime/cost. All68 owned cases and190/190 gated repetitions pass on Linux. Criteria marked done; requesting allowance-only delta and final evidence review at this head.

### rev-30 · 2026-10-17T12:29:03.275Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-allowance-delta
commit: e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Manifest-only delta clear, A-4510. Exactly three8s native runner allowances authorized by primaryf0015a3c; each E-677 owner,2026-10-17→24 and reason names actual retained process proof plus Linux observation5.319881623/6.510349738/5.401820478s. Existing allows and non-allow sections unchanged; parent5139daac, no source/test/baseline mutation. Prior A-4478 source assessment/C2–C4 refreshed. Final C1/C5 evidence assessed separately under primary acceptance of e08d5116 across this manifest-only child; no rerun.

Criteria: C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T12:29:04.213Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-698-merged-final
commit: e91cf99b4e98ea723ccdffa5d5c9ffd6bcce3aca
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear under primary Coordinatorf0015a3c/87ff1db6/909ad94d; full audit A-4510. A-4504/e08d5116 at source-parent5139daac:2089tests/2084pass/0fail/5skip; all68 owned ordinary cases and190/190 owned gated repetitions pass. Exit1 budget-only: three own cases now covered by reviewed8s-only allowances; external claude/OpenCode/verifier lines explicitly accepted as shared follow-up. No overall-green or Neovim-executed claim. Primary accepts receipt across e91cf99b and directs no rerun. C1: independently recomputed all-ten Mac5/5 median sum37.258769833<120 from50 raw TAP logs; C5 whole-file evidence zero fail/cancel/skip. Linux all-ten132.370394780 disclosed (>120, nondecisive per primary); name-reservation152.549/54.292=2.809787814×, no causal normalization. Prior C2–C4 source/census/assertion audit unchanged and refreshed. Linux2workers,c-8lon1,peak10.21,suite3312.24s,lifetime3399s,cost$0.2360. All C1–C5 verified at current exact head.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
