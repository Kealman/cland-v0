---
id: T-2043
kind: task
title: TrackerIndex/Store constructors leak the opened DatabaseSync handle when schema initialization throws
state: open
status: review
size: S
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: topic-1747
branch: t/T-2043-trackerindex-store-constructors-leak-the
created: 2026-11-20T22:22:25.145Z
updated: 2026-11-24T13:56:37.723Z
---

## Summary

The production TrackerIndex and Store constructors can throw during schema initialization after `DatabaseSync` has opened the database, before `serveProject` holds a constructed owner. `database.ts` closes the handle only when its own initial busy_timeout fails, and `serveProject`'s Tracker-construction catch closes logs and the lock but never sees the unreturned handle, so it leaks open. Reported by impl-1901 on 2026-11-20 from static reading of hub/src/hub/store.ts, hub/src/tracker/index-db.ts and serveProject. T-1901's test fixture captures these handles through an injected openDatabase; the production path is unchanged. No live database was inspected and no failure probe was run.

## Acceptance criteria

- [x] C1. A schema-initialization failure inside the TrackerIndex or Store constructor closes the opened DatabaseSync handle before the error propagates, shown red first with an injected failing schema step (test).
  - done: impl-2043 · 2026-11-24T13:53:37.667Z

## Comments

### impl-2043 · 2026-11-24T13:02:27.328Z

C1 red first at base 7e117f8bb8f10e8225d1189386ad5fa7cf03eb18, macOS Node 24.21.0 local: database-cleanup.test.ts (T2), 8 new cases failed 'handle closed before initialization error reaches caller', 0 !== 1; 4 existing passed. With constructor try/close and withCleanupFailure plus removing obsolete tip-churn-fixture fallback close, all 12 cases pass. Consumer search: production Store callers in core, daemon, init/provision; TrackerIndex in tracker/tracker. Injected factories and fixture ownership helpers retain isOpen-guarded final cleanup. tip-churn-fixture was the manual unconditional constructor-failure close and is migrated. Signatures, schema, success results, wire formats and persisted records unchanged; QA briefs (T-231, E-1532 stages, E-1535 stage 1), web/nvim callers and tests use successful construction and are unaffected. No docs/default/policy change.

### rev-40 · 2026-11-24T13:10:50.389Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2043-source
commit: 439fc2e49ce30b6557d7bb6e855f48fee6b52d9e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at439fc2e49. Both constructors wrap all post-open initialization, synchronously close before propagating primary error and use shared withCleanupFailure for secondary close errors. openDatabase busy-timeout failure remains separately owned. tip-churn removes only obsolete unreturned-constructor fallback, retains returned-index seed cleanup, owned isOpen-guarded retry/retention and joined pending writes. Eight injected owner/phase/close-outcome cases assert one close before propagation plus primary/secondary identity; prior fixture cases retained. Consumer census/production entry-point/owned-factory readback compatible; no schema/signature/wire/success change. A-22955 records both axes; A-22954 local red8/green12 plus43tracker-summary/static0 is focused narrative evidence, not configured proof. C1 pending exact-head configured receipts/broad importer run. No findings/reviewer runs/edits.

### rev-40 · 2026-11-24T13:20:17.690Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-2043-evidence1
commit: 439fc2e49ce30b6557d7bb6e855f48fee6b52d9e
scope: evidence
findings: [{"severity":"medium","text":"M1: constructor-failure consumers still assume an open handle/no constructor close. Configured confirmed-closure case fails false!==true at128; rejected/repaired case fails closeCalls2!==1 at133. Migrate ownership/count expectations while retaining primary-error/root/native-boundary/repair proofs and audit other injected failure consumers.","file":"hub/test/merge-queue-unit.test.ts","line":128}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear at439fc2e49. 7f402e77/A-22961 exact-head/canonical630dff56 failed: literal false!==true connection.isOpen atmerge-queue-unit:128 and `fallback attempted the captured native closer`2!==1 at133. Positive structured failure outcomes7590/7595; source shows stale ownership assumptions after constructor-owned close. My source review missed these consumers; preserve retention/repair assertions during correction. C1 failed. T0pass/T1fail,2167pass2fail;T2/T3/Web/T4unexecuted, no browser binary. Noncached Linuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5; budgets advisory. Coordinator attribution/authorized additional suite-reference-pins migration acknowledged from implementer report; fresh source review after correction before rerun. A-22963 records actual output/provenance/limits. No reviewer tests/probes/edits.

Criteria: C1 failed (Exact-head configured verification failed two T1 constructor-failure consumers; new T2 constructor regressions and subsequent phases did not execute.).

### impl-2043 · 2026-11-24T13:20:49.196Z

First configured receipt 7f402e77 at 439fc2e49 failed: T0 passed, T1 2167 pass/2 fail, T2/T3/Web unexecuted (A-22961). Coordinator attributed stale constructor-ownership assertions to this item. Corrected merge-queue-unit controls: constructor close attempt observed before propagation; successful closure skips fallback; rejected close stays owned, fallback rejects, root/seams retained, repair produces third close attempt. Consumer isOpen search additionally found suite-reference-pins:86, reproduced red (14 pass/1 fail, false !== true), updated to closed-before-propagation. Retained post-settlement close receipt. Other constructor-failure readers in tracker-summary, suite-stage-rules, remote-scripted, merge-recovery, merge-batches, suite-importer-ready, executor-prepare-component, suite-persistence and suite-human-component deliberately reject close or use guarded isOpen cleanup, so unchanged. New local checks macOS Node24.21.0: merge-queue-unit 12/12, suite-reference-pins 15/15; no configured resubmission yet.

### rev-40 · 2026-11-24T13:23:35.444Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2043-source2
commit: 40746f72024a60184fa05ff60c6a37ff5df864a4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Correction source clear at40746f720; prior missed-consumer finding resolved. merge-queue-unit now observes constructor close1 before propagation, successful closed/no fallback, rejected fallback2/root-seam guard retention/no unintended retry, repair3/positive closure/removal/restoration and original primary/secondary error. suite-reference-pins expects constructor-confirmed closure while retaining final resource-settlement assertion. Required raw constructor/isOpen search inspected remaining guarded/deliberately rejected-close consumers; no additional stale expectation found. Original production constructor/tip-churn implementation and eight-case matrix unchanged/reviewed. A-22967 records both axes/local-evidence limits. C1 unverified pending new exact-head configured run; earlier7f402e77/A-22961 remains failed with later phases unexecuted. No findings/reviewer runs/edits.

### rev-40 · 2026-11-24T13:48:01.127Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-2043-evidence2
commit: 40746f72024a60184fa05ff60c6a37ff5df864a4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence not clear at40746f720. Exact-head0246c37f/A-22981/canonical19bf1963 failed. Literal suite-human-component:129 expected/planted native close rejection/, got Error:planted constructor rejection; structuredfail33174. Attribution corrected: injected exec fails openDatabase busy_timeout before new Store catch; primary preservation already exists in original parent. No new in-scope implementation finding; XS/Bugs inherited consumer expectation sent lead for Coordinator disposition, not silently assigned to this item. C1 failed for configured settlement. T0/T1pass,T2fail,T3/Web/T4unexecuted/browsernull. Preserve partial12database-cleanup,12merge-queue-unit,15suite-reference-pins positive bases; earlier7f402e77 staysfailed. NoncachedLinuxx64c8sfo2 workers2 Node24.21/Nvim0.12.5, budgets advisory. A-22987 records actual output/limits/corrected attribution. No reviewer runs/edits.

Criteria: C1 failed (Configured receipt failed T2 suite-human-component expected-error assertion; T3/Web did not execute, so final verification remains incomplete.).

### rev-40 · 2026-11-24T13:56:37.723Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-2043-source3
commit: d28203f1a5951f44a17e1c14cd1b3391526ed57c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear atd28203f1a (canonical FixesT-2088, Coordinator8801d116 authorization). Exact primary identity plus cause containing exact injected cleanup Error now matches inherited openDatabase behavior; injection remains before Store's new catch. Root/native-boundary/refused release/repair/closure/restoration and cancelled-acquisition assertions all retained. Original constructor and prior consumer migrations unchanged/reviewed; no dev merge. A-22994 records both axes/attribution/local-evidence limits. C1 awaits new exact-head configured receipt; both earlier configured rounds retain failed outcomes, partial positives never promoted to pass. Local targeted1/1/fullT2 7/7/static0 reported, not configured proof. No findings/reviewer runs/edits.
