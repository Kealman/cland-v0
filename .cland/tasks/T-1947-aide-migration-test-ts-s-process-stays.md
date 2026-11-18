---
id: T-1947
kind: task
title: aide-migration.test.ts's process stays alive with its pipes open after all its tests finish, under full-suite load on macOS, so a local full run stalls for 10 minutes
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
assignee: null
parent: E-1881
blocked_by: []
topic: topic-1608
branch: t/T-1947-aide-migration-test-ts-s-process-stays
created: 2026-11-17T16:41:11.786Z
updated: 2026-11-18T04:18:05.316Z
closed: 2026-11-18T04:18:05.316Z
---

## Summary

Local macOS stage cover 4cce2ac6 at 0f36c7f38 (A-20902, 2026-11-17, workers 2, peak 1-minute load 10.77) ended "stalled: no output for 10 min". All 7 tests in hub/test/aide-migration.test.ts started and finished with outcomes, but the file-level finish never came. The runner's command stayed open with stdout and stderr open, and its tree held three node processes (pids 79705 and 83160 under 78770). Every other T2 file finished; web-upload.test.ts was the last. Alone, the file passes 5 of 5, about 2 s each. The previous local full run (249ae076, at 04d1f6a) finished this file normally, and Linux droplet runs at d040dbf pass it. So something the file starts (hubs through projectHub or inProcessSpoke, a FakeClock, or syncBuiltinESMExports patches) can outlive the last test under load.

## What to build

The file joins everything it starts before its last test returns, so its process exits on its own under load, and the runner's stall report names the process that held the pipes.

## Acceptance criteria

- [x] C1. The leaked handle or child is named, with a reproducer that holds the process open at least once in N loaded runs and fails first (test or documented loop with N stated).
  - done: impl-1947 · 2026-11-18T01:29:22.766Z
  - verified: rev-35 [reviewer] · run rev-35-1947-final-1 · 2026-11-18T02:49:14.489Z · commit 97e8c4dc18c25c25a8aaf56b5329e84100d6009f
- [x] C2. After the fix, the file's process exits within its normal time in N loaded runs, and the tests' owned hubs and timers are joined before exit (test).
  - done: impl-1947 · 2026-11-18T02:07:55.561Z
  - verified: rev-35 [reviewer] · run rev-35-1947-final-1 · 2026-11-18T02:49:14.489Z · commit 97e8c4dc18c25c25a8aaf56b5329e84100d6009f

## Comments

### impl-1947 · 2026-11-17T23:26:29.257Z

Consumer census A-20939: rg projectHub/nativeProjectHub/nativeIdentityProjectHub across hub/test, nvim/test, docs, skills and hub/src found 594 files. Return/API unchanged. All callers retain existing stop/dispose semantics; pending-startup cleanup now joins acquisition before root removal. T1 textual lint consumer: test-lint.test.ts. T3 timeout/cancellation sample planned: host-fixture-cleanup.test.ts and fixture-socket-lifecycle.test.ts under native slot. Red before fix: cleanup ownership regression failed 0 !== 1; original unmodified targeted run also stayed open after seven outcomes, first two 2000ms cancellations. Tracker FSEVENTWRAP/interval and hub servers identified by async_hooks stacks. Loaded N=10 proof pending native slot.

### impl-1947 · 2026-11-18T00:21:34.138Z

T-1951 corroborating native baseline (report from item lead, not executed by T-1947): release-item.test.ts at load11.0688 cancelled its first 5000ms case after5.6247s; remaining outcomes printed but file remained open. Owned runner PID64198 stopped by TERM after165.842s and closed143. release-item is already in A-20944 T3 deadline/cancellation census. T-1951 adjusts its setup deadline; T-1947 owns shared projectHub late-startup cleanup.

### impl-1947 · 2026-11-18T01:32:24.408Z

Implementation complete at e69f3bf359c36e1104932eadff278d169c02479b, pushed to origin. C1/C2 done. A-20991 baseline log-mkdir10/10 hangs; A-20992 fixed10/10 code0 with70 structured passing cases; A-20993 native samples14 pass and release-item deadline cancellation attributed by Coordinator to T-1951, native close6.384s (not pass). A-20987 earlier cancellation/no-leak and A-20995 unexecuted admission retained. Candidate contents passed full typecheck, full npm run test:lint (130 report-only findings,0 refusals), targeted47/47. Temporary probes/log staging removed; consumer inventories A-20939/A-20944. Source review requested next; configured verification unexecuted.

### rev-36 · 2026-11-18T01:44:49.934Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1947-source-1
commit: e69f3bf359c36e1104932eadff278d169c02479b
scope: full
findings: [{"severity":"medium","text":"Keep the startup-to-stop chain owned after its bounded observer expires. stopAfterStartup races startup against testWaitMs and calls stopFixtureHub only after that race succeeds. If startup settles after the cleanup bound, the cached beforeDirectories promise has already rejected and no continuation guarantees the eventual hub/log is stopped. A later directory guard can retry, but it is not an independent owner. This can retain a live watcher/server and reproduce the open-process symptom on the exact slow-start path being repaired. Keep the unbounded owned startup->stop work alive, bound only the observer, retain the root until that work drains, and add a late-start-after-observer-expiry control (rules 9/12). Implementer confirmed no omitted owner/disposition in 9519ce21.","file":"hub/test/harness.ts","line":483},{"severity":"medium","text":"Own both new callbacks before acquisition, with a separate named setup bound. The held-read case acquires tempProject on raw t before any caller owner; the ready-order case drains captured resource hooks but never fences/joins its full continuation. A timeout/signal can run teardown or restore the filesystem patch while later setup/body awaits are still active. within(entered/closing) bounds observations, not the complete acquisition/caller sequence. Enroll the shared normal/signal whole-case owner before acquisition, adopt the root, fence steps, join pending setup/body work before captured cleanup and mock restoration, and exercise root retention through the real guard (rules 9/12/42). Implementer confirmed both omissions in 9519ce21.","file":"hub/test/aide-migration.test.ts","line":17},{"severity":"medium","text":"Add a positively controlled native-launch guard around the two new fake-only cases. projectHub's fake harness/probe defaults and hubResources' after-disposal checks do not deny unexpected native launches; neither callback has a guard covering callback and promisify.custom routes over setup/body/cleanup. Use the shared guard with positive denial controls, restoring it only after the admitted work and cleanup drain. Implementer confirmed no earlier guard or explicit disposition in fd57c8c3 (rule 38).","file":"hub/test/aide-migration.test.ts","line":17},{"severity":"low","text":"Correct the tier column in the additive consumer inventory. Initial A-20939/A-20944 omitted Web wrapper users and QA; A-21000 now covers all 647 files in the Reviewer's declared lexical query, plus conservative transitive candidates (1098 total, including all 55 Web tests, 70 QA references and frozen fixtures). However, 21 pinned object-form manifest rows print '[object Object]' rather than their actual T3 tier. Read entry.tier, preserve the prior artifact and publish an additive correction; no runtime rerun is required. The earlier completeness claim remains superseded (rules 20/41)."}]
finding_counts: {"high":0,"medium":3,"low":1}

Full Standards and Spec review at e69f3bf359c36e1104932eadff278d169c02479b (tree 2d94a57676aa61457f7b0af7ecbfa3ce3acf933f), fixed baseline 98c597e0c1efc867c5e6e99ad789f6098223a4c3. NOT CLEAR: three medium findings and one low ledger-tier finding. A-21005 retains all source findings, 647-file pinned lexical ledger and qualified local evidence. Implementer confirms the three source/test gaps (9519ce21, fd57c8c3); no omitted owner/disposition. A-20991 retains ten interrupted baseline hangs; A-20992 has ten native code-0 closes and 70 exact positive shipped-case receipts, with hold/startup/teardown included and no speedup claim. A-21003 positively retains 9 T2 + 38 T1 cases; A-21004 preserves outer commands/cwd and explicit unavailable raw/argv/precommit-tree/birth/reap facts. These are precommit local epochs, not configured verification of this committed pin. Earlier roles-read cancellations and incomplete 0/10 admission stay retained. T3 samples 8/8 and 6/6 are positive; release-item cancellation stays failed, attributed by Coordinator 65682d62 to T-1951, with only its bounded close accepted here. A-21000 corrects omitted Web/QA/frozen consumers; 21 object-form tier cells need additive T3 correction. C2 failed; C1 remains unverified, with historical evidence preserved. No configured run exists at this head. Consolidated source/experiment hold released by this verdict: make the three source/test fixes and ledger correction, preserve assertions/history, then request fresh source review. No new stress/native run or configured verification is authorized by this review.

Criteria: C2 failed (The cleanup deadline can abandon the eventual late hub; the new controls also lack whole-case ownership and a positively controlled native-launch guard.).

### impl-1947 · 2026-11-18T02:07:56.470Z

Consolidated review correction head97e8c4dc18c25c25a8aaf56b5329e84100d6009f pushed origin, clean tree23647e074a02811369a06b1765dc8472ec601b37. All3 medium addressed with late-stop producer ownership, caseDeadlines whole-case owner/root adoption/fenced named setup, shared fakeNativeGuard. Ready stop delegation preserved. L1 inventory21-tier correction A-21006. Exact-head targeted60/60, typecheck and full test:lint exit0; raw A-21024/25/26, limits/epochs A-21027. No post-first-review dev merge and no new native/stress/configured run. Fresh source review requested next.

### rev-35 · 2026-11-18T02:18:17.008Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1947-source-2
commit: 97e8c4dc18c25c25a8aaf56b5329e84100d6009f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21029 full source clearance at97e8c4dc / Git tree23647e074a02811369a06b1765dc8472ec601b37, fixed baseline98c597e0c1efc867c5e6e99ad789f6098223a4c3; four files/four commits, no post-review dev merge. Standards0 / Spec0. Prior M1/M2/M3/L1 resolved: independently retained startup→stop producer survives bounded observer; ready direct stop/retry preserved; resource check joins producer; three controls own callbacks before acquisition/adopt late roots inside producer/fence steps; shared positive callback/custom/prototype native guard verified after cleanup, patches restored only after drainage. Actual removal guard retention/recovery tested. Optional startupCleanup consumed before serveProject delegation; no production schema, external package, tier/help change. Seven shipped tests retain all41 assertions and byte-identical suffix after intended2000→testWaitMs normalization. A-21006's21 corrected tiers match current manifest. Unchanged post-serve callback failure ordering remains explicitly outside prior/current patch scope and separately reported, not waived as safe. Current exact-head retained outputs:60 named passes(22T2+38T1), full typecheck/lint exit0 reported,0refusals/130 advisory findings; no configured/current-loaded/T3/T4/Web claim. Prior N10 baseline hangs/fixed70 passes, red/incomplete controls and T3 cancellation retain A-21004/A-21005 epochs/native limits. C1/C2 runtime verification pending same-head configured result; QA none. Hold released for Coordinator window; no extra native/stress/full task-head run requested. Reviewer static reads only.

### rev-35 · 2026-11-18T02:49:14.489Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1947-final-1
commit: 97e8c4dc18c25c25a8aaf56b5329e84100d6009f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-21040 final same-head settlement: exact source97e8c4dc / Git tree23647e074 unchanged/clean; run4104f10e/A-21034 finished/passed, delivered tree96e428115. Independently parsed224/224 T1,431/431 T2,55/55 Web positive base file envelopes;6689 ordinary tests pass,225 separate load tests pass; zero missing/nonpass/orphan/unfinished progress frames. All10 aide cases positive, filepass3.250947576s, each3new cleanup controls5/5+15load file completions pass; shared case-deadlines5/project-probes7 positive. T0/T1/T2/Web and ownerexit0;269T3/17T4 deferred/unexecuted. C1/C2 verified using qualified N10 baseline/fixed native history retained by A-21029 plus current source and configured case receipts; no final-head whole-file nativeN10 or speedup claimed. Originalfailed/incomplete epochs and T-1951 cancellation retained, preexisting post-serve path remains scoped out. ProvenanceLinuxx64 Node24.21/Nvim0.12.5, isolated CfT156.0.8078.4 HeadlessShell1248,cached:null,0skip/cancel;1361s/$0.0945 billing not wall.108warning identities exactly matchA-20996; no taskwarning;130lint/63files and budgets report-only. QA none. Reviewer static reads only.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T04:18:05.316Z

Merged 6d2b1231ae1079ca0ba2abbdd6097659150dee0c onto dev.
