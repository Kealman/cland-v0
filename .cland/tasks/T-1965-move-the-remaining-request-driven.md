---
id: T-1965
kind: task
title: Move the remaining request-driven executor writers (#acquire, reap, prepare snapshot, shard receipts) onto T-1964's bounded run-directory helper
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: topic-1774
branch: t/T-1965-move-the-remaining-request-driven
created: 2026-11-18T08:49:27.338Z
updated: 2026-11-25T07:07:31.085Z
closed: 2026-11-25T07:07:31.085Z
---

## Summary

T-1964 (2026-11-18) stopped background lease and recovery writers from recreating a deleted project, through a bounded `runDirectory` helper that never creates anything above `.cland/run`. Per its scope decision, four request- or completion-driven executor writers still create their directories with `mkdir(..., { recursive: true })`: `#acquire`, explicit reap, prepare snapshot publication, and `releaseShardReservations` receipt creation. Each could recreate a deleted project if a request or completion arrives after the project is removed. The writers and their readers are inventoried in A-21148.

## What to build

Move each of the four writers onto `runDirectory`, so a missing project becomes a structured refusal rather than a recreated tree. Keep each writer's behaviour otherwise unchanged.

## Acceptance criteria

- [x] C1. For each of the four writers, a held-writer test deletes the project root mid-write and shows that no directory is recreated and the operation reports a structured missing-project outcome (test, red before, green after).
  - done: impl-1965 · 2026-11-25T05:17:28.813Z
  - verified: rev-35 [reviewer] · run rev-35-1965-evidence-1 · 2026-11-25T06:33:52.301Z · commit 2b848baabd2f94fe126a668bda73995dc7d96180
- [x] C2. The readers of each writer's output (A-21148) are listed with their disposition and pass unchanged (rule 41).
  - done: impl-1965 · 2026-11-25T05:01:46.670Z
  - verified: rev-35 [reviewer] · run rev-35-1965-evidence-1 · 2026-11-25T06:33:52.301Z · commit 2b848baabd2f94fe126a668bda73995dc7d96180

## Comments

### impl-1965 · 2026-11-25T04:58:21.540Z

Consumer audit before fix: searched runDirectory, leaseDir/readLease/lease.json/key.pub, readSnapshot/snapshotPath/snapshot.json/prepareSnapshot, reap.lock/reap-pending, shard-releases/releaseShardReservations across hub/src, hub/test, nvim/test, web/src, docs, qa and shipped skills. Acquisition readers: processHost createKey/armWatchdog, lease read/index/upgrade/release, machine/run/watchdog/spend. Snapshot readers: prepare/readSnapshot, droplet inspect/acquire/reserve/preparePool, run deliver, snapshot-recovery, host pool-image storage. Reap readers: acquireLockWithRetry and #reap pending checkpoint/retry. Shard receipt readers: #retryShardReleases/#finishShardRelease and suites shard-parent reporting. Disposition: unchanged paths, JSON and native ENOENT shape, no migration; snapshot error retains ENOENT in cause. Tests include executor lease-index/admission/watchdog/spend/run/prepare/snapshot/reap/deletion/safety and suite accounting/remote-budget plus host provider prepare/recovery fixtures. QA E-1532/E-1533/E-1538 and running docs remain compatible; no help/frozen usage bytes changed. Native/T3 readers deferred to exact-head verify selection. Four new held tests failed root-absence with Missing expected rejection before fix; focused green 4/4, whole prepare component 51/51 on macOS Node 24.21.0, fakes only.

### rev-35 · 2026-11-25T05:05:12.639Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1965-source-1
commit: bb5b5b035cf96d8674e62979e4e260f753f8bb40
scope: full
findings: [{"severity":"medium","text":"Four new held-writer callbacks lack a positive resource-close/restoration fence for partial setup or rejected hub/API/executor close. guardedLeaseCase has no canRestore/covering fence; caseDeadlines collects closer failures and adoptRoot gates only join; unfenced cleanup can reach releaseSeams and caller finally restores mkdir after writer settlement alone. Implementer confirms no covering control/exclusion.","file":"hub/test/executor-prepare-component.test.ts","line":42}]
finding_counts: {"high":0,"medium":1,"low":0}

Full fixed-head review at bb5b5b035 vs merged base14c7ad020: not clear, one medium M1 in A-23272. Four production runDirectory substitutions preserve paths/JSON/native ENOENT/wrapper contracts; no further production/consumer finding. New callbacks already own whole continuation, named setup/writer bounds and independent release-before-join, but positive resource closure does not gate restoration/ordinary root release after partial or rejected cleanup. Use existing fenced/required-close composition for these callers and a shared actual rejection/repair control; preserve all four held-writer assertions. C1 failed; C2 remains unverified pending actual corrected-head consumer execution. Reported119 local T2/partialT1/typecheck/lint are scoped local evidence, not configured green. Audit hold positively released for correction and Coordinator-scheduled checks; request fresh committed-head review before any configured submission.

Criteria: C1 failed (New held-writer controls can restore seams/native guard after rejected fixture close; add successful-close gating and actual cleanup rejection/repair proof.).

### impl-1965 · 2026-11-25T05:10:25.529Z

M1 corrected at 452e17079: actual and nested fixture cleanup owners fenced before acquisition; required resource closers outside memoized ancillary-hook cleanup; successful resource closure precedes ordinary root removal and final seam/native-guard release. Callback finally only releases and joins held writer. Four shared actual cleanup rejection/repair controls cover executor and nested fixture closers, normal and partial setup. Final-source preparation T2 file 55/55 pass, macOS Node 24.21.0, fakes only; whole typecheck and full test:lint exit 0, 0 lint refusals. Correction artifact A-23273; original red/green and consumer audit A-23271. Fresh source review requested; no configured verify before clear source/window.

### rev-35 · 2026-11-25T05:12:25.397Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1965-source-2
commit: 452e17079d3ea33c5bbdfe54e187fa363c124ba9
scope: full
findings: [{"severity":"medium","text":"New rejection/repair controls own only synthetic inner scope.run. The real callback's later drain/assertion/repair continuation has no encompassing owner or named setup/proof bound; beforeDirectories fallback can repair/drain inner resources without joining the complete original proof on cancellation/observation expiry. Implementer confirms no covering owner/exclusion.","file":"hub/test/executor-prepare-component.test.ts","line":66}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear, one medium M2, A-23274. Original four callbacks' M1 positive-close/restoration correction is addressed in substance through actual+nested fences, required external closers and successful-cleanup release; original held writer assertions/join remain. Production unchanged. Narrow remaining correction: wrap the COMPLETE real rejection/repair callback before acquisition in existing outer owner, with named setup/proof observation bounds and cancellation retaining/joining original continuation; keep actual drain/root/mkdir/native guard and same-owner repair assertions. No broader writer/helper redesign requested. C1 failed, C2 unverified; reported55 local cases/typecheck/lint not configured proof. Source/experiment hold positively released for this correction and Coordinator-scheduled checks; fresh committed-head review before verify.

Criteria: C1 failed (New close-rejection controls need an outer owner and named setup/proof bounds covering the complete rejection/assertion/repair continuation.).

### impl-1965 · 2026-11-25T05:17:44.478Z

M2 corrected at 2b848baab: fenced real control callback plus fixtureWork owns full original setup/rejection/assertion/repair continuation before fallback. Independent named setup/proof observers use shared bounds without global drain self-join. Actual cleanup assertions preserved. Final local macOS Node24.21.0 preparation T2 file55/55, full typecheck0, full test:lint0/0 refusals. Discarded self-joining attempt failed0/4 (A-23275), never coverage. Source round3 requested with Coordinator review-loop cap: name clear bar; refinements beyond C1/C2 route T-2096. No verify before clear/window.

### rev-35 · 2026-11-25T05:19:22.417Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1965-source-3
commit: 2b848baabd2f94fe126a668bda73995dc7d96180
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at the explicit capped C1/C2+M1/M2 bar (Coordinator a9be8970), A-23276. M1 required-successful-close fences unchanged; M2 real context fenced before acquisition, fixtureWork owns complete callback+nested proof, first real cleanup joins original work before later fallback, independent named setup/proof within bounds retain original nested continuation after expiry. Normal/signal ordering checked. Four held-writer and four actual drain rejection/repair assertions preserved. Production byte-unchanged from bb5b5b035; paths/JSON/native ENOENT and snapshot wrapper/readers remain compatible. No new findings or broader ownership bar; shared refinements go to T-2096. Reported local55/typecheck/lint are not configured proof; prior119/partial65 T1 remain earlier-source evidence. C1/C2 final verification awaits fresh exact-head configured result including named controls/readers and actual phase receipts. Source hold released; request Coordinator window before submission.

### rev-35 · 2026-11-25T06:33:52.301Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1965-evidence-1
commit: 2b848baabd2f94fe126a668bda73995dc7d96180
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; A-23304 independently audits A-23302/runa474d17b. Durable result code0/cause empty, complete T0(two)/T1/T2/T3/Web bound to exact run/tree, zero unfinished. All8 held writer/actual rejected-close repair controls base+5/5 loaded; complete prepare-component55/55. Listed reader files have positive receipts inclnative droplet/prepare/safety; conservative33 reader files421 pass+1 explicitmacOSskip, T4safety-load unexecuted. Paired9637 basepass/12skip+40loadedpass, known3F2 excluded. PositiveT1 248/T2 449/selectedT3 250/Web55;24 otherT3 deferred,18T4 unexecuted. ProvenanceLinuxx64 Node24.21/Headless1248 v156; cacheunknown, not asserteduncached. Gitccf7a121.../verificationf7d82d8... literal distinct trees at same head. C1/C2 verified; capped source bar unchanged, no new findings/source/run requested.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T07:07:31.085Z

Merged 8339b7f06be281cd3500e652bca58be8ef8dbe93 onto dev.
