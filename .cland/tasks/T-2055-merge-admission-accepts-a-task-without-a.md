---
id: T-2055
kind: task
title: Merge admission accepts a task without a ready status or a green same-head suite receipt, so an explicit cland merge can bypass readiness
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1713
branch: t/T-2055-merge-admission-accepts-a-task-without-a
created: 2026-11-21T18:16:39.482Z
updated: 2026-11-22T01:54:26.940Z
closed: 2026-11-22T01:54:26.940Z
---

## Summary

Found by impl-2050 while fixing T-2050 (2026-11-21). `Merge.#message` and `MergeQueue.candidate` check verdicts, head and base, changed paths and timings. They don't independently require the task's ready status or a finished, passed same-head suite receipt. T-2050 makes the automatic ready transition wait for that receipt, but an explicit `cland merge T-n` can still enqueue a task whose verify is missing, in flight or red. The Coordinator's enqueue script checks this by hand today (rule 7).

## What to build

Merge admission refuses a task that isn't ready, or whose required same-head suite receipt is missing, unfinished or failed. It names the missing evidence. It applies the same dispositions as T-2050's ready gate: no test command, an empty base diff, and a same-tree cache hit counts as passed. A batch's own integrated run stays the batch's evidence and doesn't replace the member's receipt.

## Acceptance criteria

- [x] C1. `cland merge` refuses a task whose same-head verify is launching, running, failed or absent, naming the missing receipt, and accepts it once a passed same-head receipt exists (test, red before).
  - done: impl-2055 · 2026-11-22T00:10:49.249Z
  - verified: rev-35 [reviewer] · run rev-35-2055-evidence-1 · 2026-11-22T01:25:51.804Z · commit 6b2a46d3521d27c1aeabf8510a59873a60e3cd29
- [x] C2. A no-test-command project and an empty-diff evidence item enqueue as before (test).
  - done: impl-2055 · 2026-11-22T00:16:21.025Z
  - verified: rev-35 [reviewer] · run rev-35-2055-evidence-1 · 2026-11-22T01:25:51.805Z · commit 6b2a46d3521d27c1aeabf8510a59873a60e3cd29

## Comments

### impl-2055 · 2026-11-21T23:43:35.978Z

Consumer audit recorded in docs/evidence/T-2055-merge-consumers.md. Red-before: absent/launching/running/failed/cancelled accepted (true !== false); passed control green. Shared Tracker predicate now feeds ready and merge validation, with receipt recheck at final mutation. Full merge-queue T2 62/62 and merge-queue-unit T1 8/8 locally on macOS Node 24.21.0, fake-only. Native importer checks remain for authorized configured verification; no native runs started.

### rev-35 · 2026-11-21T23:56:15.725Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2055-source-1
commit: bccfb53663e371d9b6627afb3e4b34237f10e197
scope: full
findings: [{"severity":"medium","text":"M1: all new T2 admission/disposition/status/recheck callbacks and both new merge-queue-unit.test.ts:45/58 T1 callbacks lack encompassing pre-acquisition/cancellation ownership, separate setup bounds and positive-close restoration. Raw fixture shutdown/unfenced guard cannot join original body or fence partial/failed cleanup. Migrate all new callbacks to established owned scope; preserve every outcome/queue assertion.","file":"hub/test/merge-queue.test.ts","line":66}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source reviewbccfb53663e371d9b6627afb3e4b34237f10e197, Gittree21042d1a9be4f5d3e8cfb8867e0eb3c8439cce0a, againstd6f0b7da6c6ab6464948e586a0c82ff1a67af313. One medium consolidated M1 coversallnewT1/T2callbacks, lead6327c46c confirmsnoowner/exclusion. No separateproductionfinding: shared receipt predicate, finalcurrentreceipt/status checks, resolvedheadbinding, retainedbranch/base/lane/cancel/timing fences, no-command/empty/cache dispositions and override/recovery paths appearconsistent. Additivewirecodes/genericoldshape and help/docs/skill consumer migration reviewed. A-22594 local authoredchecks/targetednativepasses are not configuredproof or cleanupfailure proof. Audit A-22595 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22595-t-2055-source1-new-merge-admission-callback-ownership-gaps.md. C1/C2failed/unverified. No Reviewer execution/edit/submission. Correct allnewcallbacks after holdrelease, preserveassertions/redhistory, requestfreshsourcereviewbeforeverify; nofullrunrequested.

Criteria: C1 failed (New missing/pending/red/passed/status/recheck proof callbacks require whole-case setup/abort/positive-close ownership before their runtime evidence is safe.), C2 failed (New no-command and empty-diff proof callbacks need the same owned setup/body/teardown fence while preserving actual admission assertions.).

### rev-35 · 2026-11-22T00:07:09.707Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2055-source-2
commit: e695a3bb855703539a11dd01ccc9d350c1c7b6a9
scope: full
findings: [{"severity":"medium","text":"M1 residual: always-async Store stopper returns a Promise even before Store constructor assignment. ownedDatabases then skips captured-handle fallback after construction rejects, leaving an open handle/root/guard retained without attempting available closure. Return undefined before acquisition; keep exact constructor-rejection/close-rejection-and-repair control preserving primary reason and positive closure.","file":"hub/test/merge-queue-unit.test.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Corrected-source reviewe695a3bb855703539a11dd01ccc9d350c1c7b6a9 retains one medium M1residual, confirmedby leadde640033/noothercloser. Broad M1migration is present: all13newT2 callbacks delegatedexactly into stageCase, fencedpartialhubresourceclose before DBfallback/UI/directories, namedobservations; bothnewT1callbacks owned withconstructorcapture/queueStop. Storestopcallback signals nonexistentdelegatedowner beforeassignment and preventscleanup despitepositive retention. Productionunchanged; no newproductionfinding. Allpriorassertions retained. C2failed/unverified; C1run-dependent/unverified without independentfailureinthispass. A-22596 currentlocal74passes/shared5controls are scoped and do not coverexactcallbackshape. Audit A-22597 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22597-t-2055-source2-store-constructor-fallback-still-required.md. No Reviewerexecution/edit/submission. Correctfallback/exactcontrol afterholdrelease and requestfreshsource beforeverify; nofullrunrequested.

Criteria: C2 failed (Empty-diff candidate fixture's partial Store construction skips raw DB fallback; correct the handoff and exercise exact constructor/close failure controls.).

### rev-35 · 2026-11-22T00:14:19.421Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2055-source-3
commit: eeac3f72197819a2ddfcbd460ed8e930ba0efa37
scope: full
findings: [{"severity":"medium","text":"M1 residual: rejected-close context dispose stops at stageCase's required DB receipt before ancillary nested.fixtures directory cleanup. Root stat/refused restoration prove normal ordering, not an actual ownDirectory/guardRemoval attempt. Exercise the real registered removal path under rejected close, observe its separate refusal/root receipt, then retain repair/closed/removed/restored receipts and correct stronger docs.","file":"hub/test/merge-queue-unit.test.ts","line":117}]
finding_counts: {"high":0,"medium":1,"low":0}

Sourceeeac3f72197819a2ddfcbd460ed8e930ba0efa37, Gittree87603d31c21f78f839b64925880d23f59f45363a retainsone medium M1controlgap, confirmedleadc4a047d3. Store stopper/fallback itself corrected; exact controls retainprimary/nativeclosecounts/isOpen/repair/nativeguardretention. Production/T2ownership unchanged and allpriorfunctionalassertions retained. C2failed/unverified; C1pendingruntime. A-22598 local76passes/fullchecks do notproveunattemptedguardpath. Audit A-22599 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22599-t-2055-source3-rejected-close-needs-actual-directory-guard-attempt.md. No Reviewerexecution/edit/submission. Afterholdrelease narrowcontrol/docsfix and freshsource reviewbeforeverify; nofullrunrequested.

Criteria: C2 failed (Exact rejected-close control lacks independent attempted removal through the real directory guard; current root stat cannot establish rule42 retention proof.).

### rev-35 · 2026-11-22T00:19:35.480Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2055-source-4
commit: 6b2a46d3521d27c1aeabf8510a59873a60e3cd29
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source6b2a46d3521d27c1aeabf8510a59873a60e3cd29, Gittree6a7baac3d131ed72e6b8dd2e5abc6a619d0a6063 clears M1/residuals. Complete T2/T1 owners/bounds/partialresourceclose order retained; Store delegate leaves rawfallback beforeassignment. Exact confirmed/rejected-repaired constructorcontrols preserveprimary/closecounts/isOpen. Independent tempProject-only context capturesrealregisteredcleanup, forwardsnormalhook, invokesit underrejectedclose and observesactualguardrefusal/unchangedclosecount/openDB/root/boundary, thenpositiverepair/removed/restoredreceipts. Prior source3stat-onlyproof explicitlyretainedaslimited. Alladmission/FIFO/disposition/status/receipt/head assertions unchanged; productionunchangedfromsource1. Genericwire/help/docs/consumer audit remain aligned. C1/C2checked/unverifiedpending actualsameheadconfiguredreceipt. A-22600 currentlocal76passes/fullchecks and oldernative/T1epochs distinguished. Audit A-22601 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22601-t-2055-source4-ownership-and-independent-guard-controls-clear.md. No Reviewerexecution/edit/submission. Holdreleases; askCoordinatorwindow forone exactheadmodefreeverify; nofullrunrequested.

### rev-35 · 2026-11-22T01:25:51.805Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2055-evidence-1
commit: 6b2a46d3521d27c1aeabf8510a59873a60e3cd29
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final samehead evidenceclear:586e7509/A-22607 autoexit0 at6b2a46d3521d27c1aeabf8510a59873a60e3cd29, runtimetree0a2d40553511fc672e19cf784557f93b8b50828a distinct Gittree6a7baac3d131ed72e6b8dd2e5abc6a619d0a6063. All17newgenerated controls have pairedbasepass+5distinctpassingloadrounds each:9receiptstates,2dispositions,status/pendingvalidator,2candidate,2Storeconstructorclosure. Fullqueueunit12/12,T2queue64/64; source4actualdirectoryguard/primary/repairassertions retained. C1/C2verified. ActualT0/all243T1/all444T2/245selectedT3/all55Web green;28T3deferredbatch,18T4unexecuted. Aggregate9415tests/9403pass/12skip/0fail/cancel;17provenanceskipreceipts separate/reasonsmissing0. Linuxc8ams3 Node24.21/Nvim0.12.5 HeadlessShell1248/Chrome156.0.8078.4,workers2;timing/lintadvisoriesreport-only. Selectedduration245files1984passingidentities2379.036s phasewall excludeswait/baseonly;lifeaccountnotwall/cache:nullunknown. Exactnames/provenance A-22608 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22608-t-2055-final-evidence-all-17-controls-and-c1-c2-clear.md. Earlierred/limitedrounds retained. No Reviewerexecution/edit/submission orduplicate/fullrunrequest; livedeploymentstillrequiresupdatedhubrestart.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-22T01:54:26.940Z

Merged 0cb5b23bdbef62fd5d3e3b5ea093bfe6fef81eb9 onto dev.
