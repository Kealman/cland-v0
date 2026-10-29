---
id: T-1440
kind: task
title: web Items tree claims-and-holds case times out on task.edit at 5 s once in a loaded task run
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1278
blocked_by: []
regression_of: T-1423
topic: topic-1179
branch: t/T-1440-web-items-tree-claims-and-holds-case
created: 2026-10-29T12:24:33.567Z
updated: 2026-10-29T13:54:54.780Z
---

## Summary

`web/test/items.test.ts:134 :: claims and verifier holds arrive in the task and ancestor rows` failed on T-1439's mode-free run c6ea21e7 (A-13685, Linux c-8 nyc1) with `Error: no result for task.edit within 5000ms` (harness.ts:682) after 7.7 s; its parent case failed with it. On dev at 76d63539 it passes 5/5 alone on macOS. This is the third Items-tree hub-request timeout under load: T-1419 (a verifier-hold row within 3 s) and T-1423 (`task.comment` at 5 s) were fixed per case.

## What to build

Find why a hub request from the Items-tree fixture can wait more than 5 s under a loaded Web shard: the copied live tracker, the hub's request queue, or the browser. Fix the cause for the whole file rather than per case, or bound the harness wait by the hub's observed progress. Keep every assertion.

## Acceptance criteria

- [x] C1. The claims-and-holds case passes 5/5 under two busy workers, and so do the cases fixed by T-1419 and T-1423.
  - done: impl-1440 · 2026-10-29T13:13:00.942Z
  - verified: rev-26 [reviewer] · run rev-20261029-1440-evidence-3 · 2026-10-29T13:54:54.686Z · commit 4635b36995b26f8620318c27a38077e2249bcc67
- [x] C2. The item names the cause, with a measurement of where the 5 s went.
  - done: impl-1440 · 2026-10-29T13:13:01.009Z
  - verified: rev-26 [reviewer] · run rev-20261029-1440-evidence-3 · 2026-10-29T13:54:54.686Z · commit 4635b36995b26f8620318c27a38077e2249bcc67

## Comments

### impl-1440 · 2026-10-29T13:12:46.209Z

Diagnosis: Darwin arm64 lease-backed baseline with two busy CPU workers copied 1,439 files; hub.status samples observed watch poll active for 1,402–1,918 ms with three queued requests, while mutation model rebuild maxima were 0.1–0.2 ms. Historic Linux 5 s failure was not naturally reproduced. Cause: safety metadata change triggered all-body reads/parses in one serialized tracker admission. Fix: per-path stamp maps (mtime/ctime/size/inode), changed/add/remove body reads only; explicit full rescans unchanged. Shared public frame/schema/permissions unchanged; private stamp consumers are constructor/start and safety/fallback poll. TDD red: peer changed => 2 body reads vs 1; exact pinned mtime/size/inode same-size edit retained old title without ctime. Green tracker-summary file 18/18. Coordinator accepted metadata ctime on APFS/ext4 and no periodic full audit; native notifications and explicit rescans backstop fully invisible metadata. Local baseline first two overall runs incomplete due diagnostic sampler teardown; all three semantic cases passed 5/5, last three overall runs green. Raw records will accompany final repeat artifact. No skill/role clause edits; only production file changed is hub/src/tracker/tracker.ts.

### rev-26 · 2026-10-29T13:16:17.495Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1440-source-1
commit: ac1c1b68865dd1822b82044958c3f3300bb67032
scope: full
findings: [{"severity":"medium","text":"M1: renamed tracker-summary test leaves stale exact duration identity. Reproduce unchanged guard red, migrate exact key preserving0.009473/totals/allowances; retain green and owned-reference audit.","file":"hub/test/durations.json","line":8152},{"severity":"medium","text":"M2: optional concurrent storage sampler joins after fixture resource/hub/root cleanup on failed body, raw100ms pause not cancellable. Pre-own immediately caught/bounded request+pause/acquisition, cancel/join before socket/native/root disposal on every exit with shared cleanup and failure/abort controls.","file":"web/test/items.test.ts","line":54}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source1 notclear, StandardsM1/M2, no additional product finding. A-13700 pins complete7-file diff/base/tree; per-path metadata union/missingfolderfallback/explicitrescan/read/drop/duplicate paths inspected, startup/safetypollprivateconsumers and no publiccontractchange. Native dropped-event rename/edit/add/remove, same-size pinnedmtime/size/inode ctime and unchanged-read tests retained. Coordinator2b6fd94e/ef46a93d/d2173d52 narrowproductionfix/ctimeAPFSext4 residual/noaudit authority independentlyread; docsrecordbackstops. C1correctedhead5xrepeat pending; C2baselinepoll1.4–1.9s plausiblestall, notactualhistoricLinux5sattribution; rawbaseline+incompletefirsttwooverallruns must remain explicit. ConsolidatedauditcompleteM1/M2only; reportedworkingfixoutsidehead. Correct/commit/push, freshsourcebeforeapprovedonerepeat/modefree. No runtimecriteriafailed/verified; no Reviewerworkloads. Coordinatorfullallfortracker.ts owed.

### impl-1440 · 2026-10-29T13:16:40.128Z

Source review M1/M2 corrected: exact duration key migrated, 0.009473 and all other manifest data unchanged; owning lint red before / green after. Sampler now pre-owned before webFixture, cancellable pause and immediately caught bounded request loop joined before fixture resources on every exit. Deliberate failed-body control failed only with injected error (5.6 s test including setup), census confirmed scratch hub stopped, no late sampler request or unhandled error; clean source restored. Full touched Web file with sampler enabled 8/8; typecheck green after corrections. Final load repeat remains pending fresh source clear.

### rev-26 · 2026-10-29T13:18:02.130Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1440-source-2
commit: 2b94c8973c02dae9aa14536d77243473bdff4625
scope: full
findings: [{"severity":"medium","text":"M2 remaining acquisition gap: new connectUi is awaited while pre-owned stopSampling is no-op; helper creates native socket and waits connect before cleanup registration. Reuse already-owned frame connection or shared independently bounded/cancellable/joined acquisition with omitted/pre-aborted controls.","file":"web/test/items.test.ts","line":59}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13701 full source2 notclear, soleparentac1c1b688; fullsource1 carried. M1exactdurationkeyonly migration fixed preserving0.009473. M2loop portion corrected: prewebFixtureonCleanup, immediatecatch, abortablepause, boundedrequestjoin beforefixtureteardown. Monitor acquisition itself still unowned untilconnectUi returns; postacquisitionfailedbodycontrol doesnotcoversetupfailure. No additionalproduction/specfinding; trackerperpathstamp/ctime/fullrescanbackstopunchanged. Lead proposed dispatcherUi afterthishead, needscommit/sourcecheck. No runtimecriteriafailed/verified; no Reviewerworkloads. Freshsourcebeforeapprovedonerepeat/modefree; Coordinatorfullallfortracker.ts.

### rev-26 · 2026-10-29T13:18:57.563Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1440-source-3
commit: f42e87fd91791437d0a1379c7aa3d997df29e52c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, Standards/Spec nofindings. A-13702 pins finalhead/tree/parent and carries completeinitialsourceaudit. M1exactdurationkeyfixed0.009473/noothernumericdata, oldidentity absentownedrefs. M2diagnostics useexistingpre-owneddispatcherUi(noextrasocketacquisition); prewebFixturecleanup/caughtloop/abortablepause/boundedframejoin preserve failure ordering. Semanticnativeclients/assertions/bounds retained. Productionperpathstamp/ctime/fullrescanbackstopsunchanged; CoordinatoracceptedAPFSext4residual/noaudit. C1correctedrepeatpending; C2baseline1.4–1.9swatchpollmechanismnotactualhistoricalLinux5sattribution. Rawbaselines+firsttwoincompleteoverallruns mustremainexplicit. IndependentlyreadCoordinator2b6fd94e/ef46a93d/d2173d52: existingauthorizedonerepeatfiveparentruns/twobusyCPU/sharedleases/sealedenvironment/rawsamplesandjoinrecords thenconfiguredmodefree. Runtimecriteriaunverified; Coordinatorfullallfortracker.ts separatebeforeenqueue. No Reviewerworkloads.

### rev-26 · 2026-10-29T13:21:08.011Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1440-evidence-1
commit: f42e87fd91791437d0a1379c7aa3d997df29e52c
scope: evidence
findings: [{"severity":"medium","text":"M3 admission blocker: verify-test-lint wall-clock-wait1 exceeds frozen0 for optional100ms sampler pause. Submission refused before execution; no runtime receipts. Await Coordinator disposition, no bypass/frozen allowance edit without authority.","file":"web/test/items.test.ts","line":69}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13704 records hub47ace3e5 refusal beforeexecution atsource3head; no suite ran, C1/C2notverified/no productcriterionfailureinferred. Source3didnotcatchstaticadmissionblocker; cannotclaimverification-ready. Lead reports approvedlocal5xrepeat/A-13703 retained, but originalrecords not yet reviewed in this admission-only disposition; notconfiguredLinuxproof. Lead escalatedCoordinator/remainsheld, no retry. Any correctedsource/headneedsfreshreview; Coordinatorfullallfortracker.ts separatebeforeenqueue. No Reviewerworkloads.

### impl-1440 · 2026-10-29T13:21:44.552Z

Coordinator decision 9ce6d3e3: remove timer diagnostics from shipped test; approved f42e87fd9 load repeat remains applicable because production fix/tests unchanged. New head 4635b3699 removes only diagnostics and updates guide; Web 8/8 and typecheck green. Raw baseline artifact A-13705 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13705-t-1440-baseline-raw-records-first-two-overall-incomplete), corrected repeat A-13706 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13706-t-1440-corrected-load-repeat-raw-records-5-of-5); full methodology/limitations/script in A-13703. Baseline first two overall runs incomplete; corrected five overall runs green. Fresh source review before new mode-free.

### rev-26 · 2026-10-29T13:22:40.518Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1440-source-4
commit: 4635b36995b26f8620318c27a38077e2249bcc67
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorizeddiagnostic-removal delta clear, Standards/Spec nofindings. A-13707pinshead/tree/parent; independentlyreadCoordinator9ce6d3e3 removal/noallowance/loadproofreuseauthority. Webtestexactoriginalbase(noassertion/boundchange); sampler/imports/cleanup removed, guideaccuratelypointsrecordedevidence. Trackerproduction/deterministictests/durations byte-identicaltof42e87fd9 sampledhead. M2/M3removednotwaived; M1keyfixretained. A-13705baselinefirsttwoincomplete/A-13706corrected5green/A-13703methodology forfinaloriginal-recordreview; no currentheadruntime/C1C2marks. Priorrefusedadmissionnotrun. Proceedunchangedheadmodefree/finalreview; noextraload, Coordinatorfullallfortracker.ts separatebeforeenqueue. No Reviewerworkloads.

### rev-26 · 2026-10-29T13:48:11.409Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261029-1440-evidence-2
commit: 4635b36995b26f8620318c27a38077e2249bcc67
scope: evidence
findings: [{"severity":"medium","text":"M4: C1 prior captured5x proof lacks actual CPU progress/liveness, workerjoin/lease-release/head/tree receipts; code/transcribedouterexit0 are not those observations. Coordinatorcc52fb46 authorizes one final currentheadcapturedprobe, no extra unsanctioned runs."}]
finding_counts: {"high":0,"medium":1,"low":0}

A-13715 original-record audit: A-13713 configuredc1692a00exit0 independently4144ordinary+45scopedloadpasses,no fail/cancel/skip/unfinished,T0T1allT2Webcomplete,T3T4unrun. Tracker18pass/newidentity.040188533/dropped-event.051019696; Web8pass(parent58.584454994,claims3.464909964). No new>=3sidentity;legacybudgetsreport-only. RawA-13705baseline1439files/watchpoll1.402–1.918s/upto3queued,firsttwooverallincomplete; rawA-13706corrected5childexit0/semanticpasses/samples23.1–36.3ms retained, notcompletecostorhistoricLinux5sattribution. A-13714outerexittranscription accuratelystatesmissingfacts. IndependentlyreadCoordinatorcc52fb46finalprobeauthority; C1proofpending/no runtimecriteriarefresh or productfailuremark. Source4clear unchanged, no Reviewerworkloads. Finalauthorizedcapturedproofthenreview; Coordinatorfullallfortracker.ts separatebeforeenqueue.

### impl-1440 · 2026-10-29T13:53:40.174Z

Final authorized C1 proof A-13717 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13717-t-1440-final-c1-probe-5-runs-with-complete-worker-and-lease-receipts): unchanged head4635b36995b26f8620318c27a38077e2249bcc67/tree3921f54271d6ed620c58f8549a28d9e98d91a097 recorded before/after in sealed disposable clone. Five native child close0 records and exact required parent/CLI/claims pass lines. Both busy CPU workers have start, iterations/progress ticks during each run, terminate request/result, pre-armed exit and join receipts. Both shared leases owner-verified on acquire and released; outer driver native close0 separately recorded. No optional sampler; Coordinator48daa801 explicitly excludes storage from C1. C2 diagnosis remains A-13705/A-13706/A-13703; prior failed sampler probe preserved A-13716, transcription A-13714 retained. Raw record assertions and secret scan positive control checked. Configured Linux green suite A-13713 unchanged, no source change/reverify.

### rev-26 · 2026-10-29T13:54:54.686Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261029-1440-evidence-3
commit: 4635b36995b26f8620318c27a38077e2249bcc67
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence3 clear,C1/C2verified. A-13718 carries independentA-13713Linuxaudit4144ordinary+45scopedloadpass,T0allT1/fallbackallT2/Webcomplete,zero failure/cancel/skip/unfinished,T3T4unrun,budgetsreport-only. Newidentity.040188533s/dropped-event.051019696s,18tracker/8Webpass. IndependentlyreadCoordinator48daa801exactbar; A-13717rawcurrenthead/treeunchangedsealedclone,5nativechildexit+close0,requiredparent/CLI/claims5passeseach(categoryalso5),2workerstarts/448positiveprogress/10throughchildrecords/2terminateexitjoins,2matchingleaseacquires+ownownerabsentreleases,outerclose0. M4complete,C1verifiedseparatefromLinux. C2originalA-13705/06/03 measuredwatchpoll1.4–1.9s/3queuedvsbrowser.1–.2ms andcorrected23.1–36.3mssamplemax; historicalLinux5snotfullyattributedorlocallyreproduced,Coordinatoracceptslimiteddiagnosis. Priorbaselinefirsttwoincomplete/A-13714transcription/A-13716failedsampler/refusedadmissionretainedexplicit. Source4unchanged, no Reviewerworkloads. Freshconflictcheck/readythenCoordinatorfullallfortracker.ts remainsseparatebeforeenqueue; noextrarunrequested.

Criteria: C1 verified, C2 verified.
