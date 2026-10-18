---
id: T-703
kind: task
title: Name reservation, tracker readiness, task migration, inbox load and the ask chain run in T1 and T2 with shared fixtures
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
  - T-685
  - T-686
  - T-687
topic: topic-466
branch: t/T-703-name-reservation-tracker-readiness-task
created: 2026-10-16T19:59:37.302Z
updated: 2026-10-18T01:25:42.977Z
---

## Summary

Tracker and hub rules dominate these files, at the cost of fixture rebuilds, oversized seeds and spawned hubs (report-slice2 #9, report-slice1 #3 and #7, report-slice4 anti-pattern A):

| File | Seconds | Note |
|---|---:|---|
| `name-reservation.test.ts` | 54.3 | 63 tests; ≥12 permutations, each rebuilding the ~0.7 s `pendingAlias` fixture |
| `tracker-ready.test.ts` | 53.5 | mocks `String.prototype.replace` for a timing triple; sleeps 1100 ms past a backoff |
| `task-migrate.test.ts` | 42.1 | 11 hub starts and 44 CLI calls for a file transform |
| `inbox-workload.test.ts` | 40.0 | seeds 2000 items and 3000 messages one create at a time |
| `ask-chain.test.ts` | 39.0 | 32 spoke spawns; fake Claude Leads only for a session id |
| `ask-attribution.test.ts` | 5.8 | the same fixture as `ask-chain` |

## What to build

- **name-reservation.** Each permutation family is one test with `t.test` subcases over a fixture built once.
- **tracker-ready.** The retry and timing cases run on an injected clock with no builtin mocked; the crash-at restarts stay T3 with a header.
- **task-migrate.** Fixtures come from `preparedProject` and the migration module is called directly. Two real-hub tests stay: resolving old ids after a real restart, and an older task branch landing after migration.
- **inbox-workload.** The query-budget invariants run at 300 items seeded by one store transaction; the 2000-item run moves to T4.
- **ask-chain** takes in `ask-attribution`; Leads are fake-adapter sessions, and restarts are `projectHub` stop and serve.

## Acceptance criteria

- [x] C1. The six files' manifest seconds fall from 234.7 s (A-3877) to 120 s or less on the merge path (T1–T3), with the large-seed run in T4.
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
  - verified: rev-30 [reviewer] · run rev-20261017-703-runtime-correction · 2026-10-17T22:56:32.497Z · commit 7479109815247dfd587dafb1be7dba6654363ef7
  - verified: rev-30 [reviewer] · run rev-20261017-703-workload-delta · 2026-10-17T23:36:07.365Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-final · 2026-10-18T00:20:57.728Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - done: impl-703 · 2026-10-18T00:56:35.214Z
  - verified: rev-30 [reviewer] · run rev-20261018-703-merge-delta · 2026-10-18T00:58:27.390Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
  - verified: rev-30 [reviewer] · run rev-20261018-703-merged-final · 2026-10-18T01:25:41.695Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
- [x] C2. Their `startDaemon` call sites fall from 19 to 3 or less and `spawnSpoke` sites from 61 to 12 or less.
  - done: impl-703 · 2026-10-17T22:05:21.412Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
  - verified: rev-30 [reviewer] · run rev-20261017-703-runtime-correction · 2026-10-17T22:56:32.497Z · commit 7479109815247dfd587dafb1be7dba6654363ef7
  - verified: rev-30 [reviewer] · run rev-20261017-703-workload-delta · 2026-10-17T23:36:07.365Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-final · 2026-10-18T00:20:57.728Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-merge-delta · 2026-10-18T00:58:27.390Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
  - verified: rev-30 [reviewer] · run rev-20261018-703-merged-final · 2026-10-18T01:25:41.695Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
- [x] C3. No test in the six files mocks a builtin prototype, proved by a source check, and the moved rules pass the tier lint as T1 or T2.
  - done: impl-703 · 2026-10-17T22:05:23.051Z
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.924Z · commit 81d65861baa96fc019453da9a506184231310fb3
  - verified: rev-30 [reviewer] · run rev-20261017-703-runtime-correction · 2026-10-17T22:56:32.497Z · commit 7479109815247dfd587dafb1be7dba6654363ef7
  - verified: rev-30 [reviewer] · run rev-20261017-703-workload-delta · 2026-10-17T23:36:07.365Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-final · 2026-10-18T00:20:57.728Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-merge-delta · 2026-10-18T00:58:27.390Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
  - verified: rev-30 [reviewer] · run rev-20261018-703-merged-final · 2026-10-18T01:25:41.695Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
- [x] C4. An audit maps every moved or rewritten assertion to its new place, with no behaviour claim dropped.
  - verified: rev-30 [reviewer] · run rev-20261017-703-source · 2026-10-17T22:19:14.925Z · commit 81d65861baa96fc019453da9a506184231310fb3
  - verified: rev-30 [reviewer] · run rev-20261017-703-runtime-correction · 2026-10-17T22:56:32.497Z · commit 7479109815247dfd587dafb1be7dba6654363ef7
  - verified: rev-30 [reviewer] · run rev-20261017-703-workload-delta · 2026-10-17T23:36:07.365Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - verified: rev-30 [reviewer] · run rev-20261018-703-final · 2026-10-18T00:20:57.728Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - done: impl-703 · 2026-10-18T00:56:35.467Z
  - verified: rev-30 [reviewer] · run rev-20261018-703-merge-delta · 2026-10-18T00:58:27.390Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
  - verified: rev-30 [reviewer] · run rev-20261018-703-merged-final · 2026-10-18T01:25:41.695Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94
- [x] C5. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.
  - verified: rev-30 [reviewer] · run rev-20261018-703-final · 2026-10-18T00:20:57.728Z · commit 229bdf2b09432807cf7aff54b4be6cbe7f42914e
  - done: impl-703 · 2026-10-18T01:25:09.954Z
  - verified: rev-30 [reviewer] · run rev-20261018-703-merged-final · 2026-10-18T01:25:41.695Z · commit 671d8e9d6182b39762b6d5378346b95eb5a0be94

## Blocked by

T-685, T-686, T-687.

## Comments

### impl-703 · 2026-10-17T21:58:47.285Z

Implementation progress: ask-chain absorbs attribution (13 tests, 3.7 s); reservation peers now in-process and 12 permutations share four fixtures; inbox query invariants use 300-message transactions and a 300-item fixture, sharing the assertion body with a new 2000-item/3000-message T4 run. Readiness component rules split from native crash/Git coverage. SQLite faults/tracing now use fixture-owned openers; readiness retry scheduling and parse timing have injected seams. origin/dev remains current. Whole-file repetition and assertion audit next.

### impl-703 · 2026-10-17T22:13:40.694Z

Implementation committed as 00852eaf, then required origin/dev merged and pushed as e1d7275e5b2147721dd4a0e20b91f8b64cda5018. A-4784 contains the 35 final-source qualifying Mac receipts and 884-assertion audit; A-4786 records the corrected, green duration manifest validation. C1–C4 are done. C5 Mac 5/5 is complete for all seven test files (including successors/T4); droplet proof remains pending source review. The merge added T-755 executor-health work, without changing task test source. Rechecking checks and one full serial pass of all seven files on the merged head before requesting review.

### rev-30 · 2026-10-17T22:19:14.925Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-703-source
commit: 81d65861baa96fc019453da9a506184231310fb3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at 81d65861. Standards: no findings. Spec: no findings. A-4798 records production-default/seam review and complete 884-assertion audit. Independently recomputed Mac merge-path sum 62.074011005 s (<120); large-seed carrier T4. Three startDaemon sites, zero spawnSpoke, no builtin prototype mocks; four component files qualify T2. A-4784 raw 35 accepted whole-file runs: 605 pass, no failures/cancellations/skips, hashes match head; post-merge seven further passes A-4791. C1–C4 verified. C5 remains unverified pending exact-head droplet evidence; normal mode-free verify may proceed without source changes. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T22:49:26.022Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-703-runtime
commit: 81d65861baa96fc019453da9a506184231310fb3
scope: evidence
findings: [{"severity":"medium","text":"New existsSync fast path runs synchronously on async territory request paths; three tracker-native-boundary guard tests fail on worktree/merge/release. Use asynchronous absence observation while preserving guard assertions.","file":"hub/src/territory.ts","line":329},{"severity":"medium","text":"Owned old-branch landing container-edit=true fails migration-success assertion after killDaemon: authoritative hub/migration lock remains held. Diagnose and observe the exact offline lifecycle boundary; keep refusal and final success assertion.","file":"hub/test/task-migrate.test.ts","line":279}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear; A-4818. M1 new sync existsSync in async hasTerritory causes three tracker-native-boundary guard failures; prior source review missed this. M2 owned task-migrate container-edit=true fails at279 because offline hub lock remains held after killDaemon; exact cleanup/lock cause needs diagnosis and retained assertion proof. All seven owned files execute,26owned gates130/130pass,no hard budget errors. Whole hub2103pass/4fail/5skip,exit1; Neovim phase does not complete. Missinghealth.ts is harmless per primaryb9d49bcf, not a finding. C1–C4 source marks remain; C5 fails. Correct source, validate matching async-boundary readers/owned migration, and request fresh source review before another exact-head gate.

Criteria: C5 failed (Exact-head run83db1195/A-4817 exits1 with four assertions failing: three async-native guards from new existsSync and one owned offline migration lock-boundary failure.).

### impl-703 · 2026-10-17T22:55:00.767Z

Runtime correction 7479109815247dfd587dafb1be7dba6654363ef7 pushed. M1: awaited access preserves absent-territory optimization/native async signature and T-750 seam; three native guard failures reproduce before and pass after individually. M2: bound PID-gone observation plus explicit assertion before offline migration, keeping SIGKILL/restart and migration-success assertions. Whole native-boundary + task-migrate files each 5/5, peak Mac load 3.193; typecheck/tiers/lint green. Six allowances re-owned to E-677 per Coordinator, manifest rechecked. A-4829 contains reproduction logs, 10 full-file receipts and updated 884-original-assertion map. C1–C4 unchanged; C5 awaits new exact-head Linux evidence after source review.

### rev-30 · 2026-10-17T22:56:32.497Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-703-runtime-correction
commit: 7479109815247dfd587dafb1be7dba6654363ef7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-4831. Standards/Spec no findings. M1 uses awaited async access, preserves native signature/Git path; three guard cases red→green. M2 adds bounded PID-gone observation and final assertion before one offline migration attempt, preserving original success/restart assertions. Linux gap is not claimed reproduced on Mac. A-4829 two files5/5 raw185pass/0fail/cancel/skip, matching hashes,maxload3.193. Six allowances change owner only toE-677 perfc084b8a; limits/reasons/dates/baselines unchanged.884original map retained plus new PID assertion. C1–C4 refreshed. C5 remains failed/pending normal exact-head droplet result; positively cover all seven carriers and native-boundary guards.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-17T23:32:48.425Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-703-runtime-2
commit: 7479109815247dfd587dafb1be7dba6654363ef7
scope: evidence
findings: [{"severity":"medium","text":"Owned archive startup identity takes 8.922707492s without a hard duration allowance; A-4846 rejects it against 5s and verification exits one.","file":"hub/test/inbox-workload.test.ts","line":122},{"severity":"medium","text":"Owned 256-process/burst startup identity takes 5.165830640s without a hard duration allowance; A-4846 rejects it against 5s and verification exits one.","file":"hub/test/inbox-workload.test.ts","line":124}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear; A-4847. Exact-head A-4846 run 2c0e0ead exits one solely on two owned missing hard-duration allowances: inbox archive startup 8.922707492s and 256-process/burst startup 5.165830640s, each >5s (raw rejection lines 32642–32643). Independently confirmed all seven owned files/109 top-level cases have passing ordinary lines and timing receipts; all 26 owned new identities pass 5/5 gates (130/130). Prior native-guard and offline-migration assertion failures are absent. Hub reports 2,107 passes, zero assertion failures/cancellations, five prerequisite skips; no completed Neovim phase/smoke receipt. Known guarded health.ts diagnostics are not a finding or exit cause. C1–C4 source review remains current; C5 fails pending corrected/accepted passing gate. Any head change needs source review before another run. No per-item QA.

Criteria: C5 failed (Exact-head run 2c0e0ead/A-4846 exits one on two owned inbox-workload hard budgets (8.922707492s and 5.165830640s >5s); Neovim completion is absent.).

### impl-703 · 2026-10-17T23:35:13.721Z

229bdf2b09432807cf7aff54b4be6cbe7f42914e pushed: two hard-budget T2 identities now use representative seeds with the same assertions, while original volume is retained by shared T4 carriers. Whole inbox + soak each 5/5 serially; peak load 2.401. Revised T2 archive max0.181s, startup max0.045s; T2 total median1.367369s, T4 median4.885388s. Typecheck/tiers/lint green; no T2 tripwire mismatches. E-677-owned T4 allowance added; no T2 allowance or known-test baseline escape. A-4848 updates full 884-assertion map. C1/C4 done refreshed; C5 remains failed/pending new exact-head evidence after delta review and restart hold release.

### rev-30 · 2026-10-17T23:36:07.365Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-703-workload-delta
commit: 229bdf2b09432807cf7aff54b4be6cbe7f42914e
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear, no findings; A-4851. Primary b0ee48e7/aa6416b1 authorize representative T2 seeds with shared T4 carriers. All batching, query-count/plan, reply completion and coalescing assertions are retained in shared functions; T4 keeps original startup volumes and broader 2000/3000 archive volumes. No production change/dev merge, new processes/sleeps or T2 allowance. Both T4 allowances are measured, E-677-owned and expire 2026-10-24; only affected file timings/counts change. Independently audited ten raw A-4848 logs: 50 passes, zero fail/cancel/skip, committed test hashes match; T2 median 1.367368791s, T4 4.885388041s, all T2 cases <2s. Original 884 assertion mappings remain, prior native guard/PID fixes unchanged. Merge-path manifest total 59.308244s meets C1. C1–C4 refreshed. C5 remains failed/pending accepted exact-head Linux gate; source correction does not replace prior exit-one receipt. Submission hold remains until Coordinator says hub restarted. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-18T00:20:57.728Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-703-final
commit: 229bdf2b09432807cf7aff54b4be6cbe7f42914e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear; A-4875. Independently audited A-4874 run 41b3844b at unchanged reviewed head: all seven owned files/110 top-level cases have completed timings and positive ordinary pass lines, all 27 owned load gates pass 5/5 (135/135), zero scoped trips or hard duration failures. Revised T2 archive/startup pass at 0.355438555s/0.131182645s; retained T4 scale proofs pass within E-677 allowances. Linux T1–T3 sum 65.149513683s versus accepted Mac/manifest 59.308244s, both below 120s. Source/Mac assertion-map evidence remains applicable, including native guard and bounded PID fixes. Full hub+Neovim run exits zero: 2,499 passes, zero fail/cancel, eight unrelated prerequisite skips. Unchanged delivered-verifier query case 2.769227394s is explicitly disclosed as report-only T2 budget debt for T-745 audit; no zero-warning claim. C5 claimant done restored in cbfcdc8b. No findings; C1–C5 verified. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-703 · 2026-10-18T00:23:18.945Z

Coordinator-authorized conflict merge committed as 671d8e9d6182b39762b6d5378346b95eb5a0be94 with dev fc183873. daemon preserves openDatabase, candidate/durationContext, Git forwarding and process seams. durations files/tests maps exactly equal refreshed dev; only seven E-677-owned allowances appended. Per f2a64db9 C1 keeps previous measured59.3Mac/65.1Linux proof until integrated refresh. Typecheck/tiers/lint green; confirmed18-file scope5/5 serial now running per13babedd. Prior229bdf2b Linux receipt is not claimed for this merged head; delta review and new mode-free droplet gate will follow.

### impl-703 · 2026-10-18T00:56:36.059Z

Authorized merge671d8e9d pushed. A-4879: typecheck/tiers/lint pass, initial18-file cohort17files5/5+orphan4/5; retained single SIGKILL failure A-4878. Requested comparison clean dev10/10, task isolated10/10, task whole10/10, all serial peakload7.38. Coordinator ce468d59 assigns unresolved case T-765/E-482, stops diagnosis, directs delta review then new mode-free droplet gate. A-4880 records disposition; recurrence becomes T-703's before merge. No source changes after merge, no erased failure/weakened assertion. C1 measured proof retained by Coordinator while manifest files/tests remain exact dev baseline+7 E-677 allowances. C4map884 intact. Fresh merged-head Linux still pending.

### rev-30 · 2026-10-18T00:58:27.390Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-703-merge-delta
commit: 671d8e9d6182b39762b6d5378346b95eb5a0be94
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards/Spec source clear; A-4881, no findings. Authorized ac9ae4be merge preserves opener/full Clock plus incoming candidate/durationContext/Git/process seams. Offline migration still uses native lock liveness; bounded PID-reaped precondition/final assertion remains unchanged. All other task source/test/helper blobs retain prior reviewed bodies and 884 assertion mapping. Independently confirmed dev source/files/tests/budget baselines verbatim, exactly seven unchanged E-677 task allowances appended, unrelated allowances untouched. C1 refreshed using existing measured 59.308244s Mac/65.149513683s Linux per primary f2a64db9, not pre-migration dev timings. A-4879 raw cohort is 89/90 successful attempts: 17 files 5/5, orphan 4/5 with original SIGKILL clean-exit failure at466 retained in A-4878. Comparison dev whole10/10, task isolated10/10 and task whole10/10 all pass; dev did not reproduce. Primary ce468d59 assigns unresolved event T-765 and permits review/fresh gate; same SIGKILL recurrence becomes T-703's to fix before merge. C1–C4 refreshed; C5 awaits fresh normal mode-free merge-head gate. Parent green A-4874 is historical. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-30 · 2026-10-18T01:25:41.695Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-703-merged-final
commit: 671d8e9d6182b39762b6d5378346b95eb5a0be94
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-4883. Independently audited A-4882 run b888f346: all seven owned files/110 cases pass with ordinary lines and timing receipts, all 27 owned gates pass 5/5 (135/135), zero scoped trips or hard budgets. All16 native-boundary cases pass. All18 orphan cases pass, specifically deleted-project clean exit at 1.818797555s (ordinary line29567/timing32860), so T-765 SIGKILL does not recur. Original A-4878 failure and primary ce468d59 conditional ownership remain disclosed; no claim its cause is resolved. Full hub+Neovim exits zero: 2,504 passes, zero fail/cancel, eight unrelated prerequisite skips. Current Linux T1–T3 sum49.622350215s, T4 excluded; measured Mac59.308244s remains C1 proof under f2a64db9, dev baselines untouched. Source A-4881, complete884 assertion map and matched local file evidence remain applicable. C5 done restored in a8bdd8c2. No findings; C1–C5 verified. No per-item QA.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
