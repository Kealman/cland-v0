---
id: T-2061
kind: task
title: The periodic dev T3 run executes T2, T3 and Web unsharded on one droplet and can exceed the 75-minute run timeout, reporting a red with no failing file
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1714
branch: t/T-2061-the-periodic-dev-t3-run-executes-t2-t3
created: 2026-11-22T17:59:44.060Z
updated: 2026-11-23T09:58:57.543Z
closed: 2026-11-23T06:23:22.270Z
---

## Summary

Periodic dev T3 run ae9e60c1 (2026-11-22, dev 022d75601, one c-8 ams3 droplet, A-22630) ended with exit 124 at the 75-minute run timeout. It had completed 6,763 tests with 0 failed, but 48 T3 files and all 55 Web files went unexecuted. The culprit search reported "inconclusive; no failing files identified". The same head was green in the sharded integrated cover d6245a18 (all tiers, 9,544 tests, about 62 minutes). On this run the droplet's T2 took 1,241 s, against 846 s in d6245a18, and its disk fsync was 10.45 ms against about 4 ms. The single-machine budget has no margin: T-2036 found that one c-4 can't finish a full suite in 75 minutes either.

## What to build

Run the periodic dev T3 occasion on the configured shards, as batches and covers already do. Alternatively, size its run deadline from its tier projections. Also, label a timeout with no failing file as inconclusive (a capacity problem) rather than as a red regression of the merge range.

## Acceptance criteria

- [x] C1. A periodic dev T3 run uses the configured shard count, or a projection-sized deadline, so a green tree completes within its deadline (test).
  - done: impl-2061 · 2026-11-23T04:43:49.616Z
  - verified: rev-35 [reviewer] · run rev-35-2061-evidence-2 · 2026-11-23T05:55:51.475Z · commit e5509b18570277b09eb00843f4b26f20303191ee
- [x] C2. A periodic run that times out with no failing test is reported as inconclusive (timeout), not as red, and names the unexecuted tiers (test).
  - done: impl-2061 · 2026-11-23T03:23:45.135Z
  - verified: rev-35 [reviewer] · run rev-35-2061-evidence-2 · 2026-11-23T05:55:51.475Z · commit e5509b18570277b09eb00843f4b26f20303191ee

## Comments

### coord · 2026-11-23T02:27:57.091Z

Second occurrence: periodic run 5a3af206 (2026-11-23, dev eb7d3fb16, A-22639) hit exit 124 at 75 minutes with 6,849 tests completed and 0 failed. 35 T3 files and all 55 Web files went unexecuted, and the search was again inconclusive. The droplet's disk fsync was 9.91 ms, against about 4 ms on batch droplets, and T2 took 1,218 s. Every periodic run on one c-8 now lands near or over the deadline: about 846 s T2 + 2,400 s T3 + 212 s Web + T0 is about 62 minutes on a fast machine, and over 75 minutes on a slow one. Pulled into 0.4.1 (E-1888 stage 4) under the human's standing yes for bug items.

### impl-2061 · 2026-11-23T02:38:01.574Z

Consumer audit (rules 20/41): Suites shard admission/reservations/aggregation, periodic started-tree cursor and previous-green cursor; fullPeriodicDevT3Cover daily backstop (now accepts producer-validated shards with durable periodicT3Proof for compact history); suite-history projection keeps that additive checkpoint; devT3Result and dispatch notice -> DevT3Search.accept (red only); suite-cover/recentCovers (capacity timeout omitted); releaseT3Cover (native timeout stays nonzero); heartbeat rows consume state/owner, unchanged; journal consumes native exit, retained. SuiteJob persisted readers, cache and client frames keep old fields and additive optional checkpoint/detail fields. Production/UI/raw readers and test tiers searched by field/function/event names. Frozen CLI usage unchanged (no help export changed). Shipped docs/merge skill updated; historical QA briefs have no active periodic result parser. Regressions shown red before source changes: periodic fallback lacked cap warning; complete shard baseline was rejected; timeout returned red. T2 component dispatch now proves inconclusive(timeout), missing tiers and no search. Runtime deploy requires a hub restart.

### rev-35 · 2026-11-23T02:47:57.856Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2061-source-1
commit: 1694497b8cc55f1267398d42a3595396caeb6d5a
scope: full
findings: [{"severity":"medium","text":"M1: the new timeout callback acquires suiteUnit without a whole-case owner or separately bounded setup. The new three-shard case (:24) and T2 deadline case (suite-soak-component.test.ts:376) use suiteCase but still restore guards after rejected resource close through its unfenced afterCleanup/finally path. Enroll exact callbacks before acquisition, require positive resource-close receipts before root/seam release, retain selected primary, and cover rejected cleanup.","file":"hub/test/suite-soak.test.ts","line":58},{"severity":"medium","text":"M2: outcome.code===124 is treated as a native deadline without an owner deadline receipt. An ordinary configured command may exit124, and Suites also fabricates timeout cause text from that code; the new scripted completion test proves only this ambiguous exit. Require structured producing-owner deadline proof, keep legacy/code-only outcomes unknown, and separately cover genuine deadline vs intentional124 and failing sibling.","file":"hub/src/hub/dev-t3-timeout.ts","line":11},{"severity":"medium","text":"M3: missing-tier derivation accepts any matching exit0 row, so [complete0, later incomplete124/143] omits an interrupted T3 step. Use the shared ordered run/tree/command receipt policy: only a later matching completion supersedes interruption; retain unresolved or foreign/unknown proof as incomplete, with both order controls.","file":"hub/src/hub/dev-t3-timeout.ts","line":23}]
finding_counts: {"high":0,"medium":3,"low":0}

Three consolidated medium findings. M1 exact three new callbacks need pre-acquisition/whole-case ownership and positive resource-close-gated guard restoration; raw T1 timeout callback has neither setup bound nor whole owner, two suiteCase callers still restore after rejected close. M2 code124 is not an owner deadline receipt; current T1/T2 planted124 controls cannot distinguish an intentional command exit. M3 any prior matching pass omits a tier after a later unresolved124/143 interruption; share ordered producer-receipt policy. Lead acknowledged all retained-source gaps in d155b55d/f365095a/5d73c7ad. Shard admission/reservation/fallback/cursor/checkpoint source paths otherwise present, shared consumers/docs reviewed. A-22642 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22642-t-2061-source1-ownership-deadline-authority-and-ordered-tier-gaps.md gives exact files/lines and correction boundaries. A-22641 selected local validation remains authored, no final-head configured/T3/T4/browser proof. C1/C2 failed/unverified; no verify at this head. Hold releases for one consolidated correction and fresh source review, no dev merge or full-suite request. No Reviewer execution/edit.

Criteria: C1 failed (New sharding regression lacks positive close-gated guard restoration under rejected cleanup; correct exact callback ownership before verification.), C2 failed (Exit124 lacks producing-owner deadline authority, missing-tier policy ignores later unresolved interruptions, and new deadline callbacks lack complete ownership/close fences.).

### impl-2061 · 2026-11-23T02:53:36.648Z

M2 contract extension audit: remote health supervisor -> metrics deadline observer -> fixed bounded deadline-expired marker -> runStatusProgram -> RunStatus.deadlineExpired optional true -> Suites terminal collection/result.json restore -> existing SuiteJob.timedOut -> periodic classification. Old status/JSON without marker remains without owner-deadline authority; raw124 no longer synthesizes capacity. Current hub's positive admitted deadline still sets timedOut. Also searched health.ts/run.sh upload list, package closure handoff, RunStatus status consumers, persisted result readers, executor component VM fakes, all test tiers, docs and skill examples. No new CLI field/help; optional metadata is additive. M3 missing-tier reporting now calls shared ordered completeTierPlanReason per step. M1 new callbacks use flakyReceiptCase's fenced whole-case owner and ownedSuiteUnit; T2 additionally fences its proxy fixture cleanup.

### rev-35 · 2026-11-23T03:08:31.759Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2061-source-2
commit: 6151f065736d6dc1e83cb24e5a8335f79b3df7a4
scope: full
findings: [{"severity":"medium","text":"M2a residual: after selecting expiry and setting active=false, io.expired() may throw from health.ts write/rename before listener(SIGTERM). The timer exception bypasses ownPackage's bounded interruption/handoff; an outer native kill is not that receipt. Contain publication failure as a secondary diagnostic and guarantee interruption in finally, with a rejected-publication control.","file":"hub/src/executor/droplet/metrics.ts","line":79},{"severity":"medium","text":"M2b residual: #recoverMissingRemoteEvidence rewrites a finished unreported timedOut job's result without deadlineExpired; the isolated unavailable writer :427 also omits it. This loses positive deadline authority for result-only recovery. Preserve the metadata through shared terminal-result serialization and exercise both reconstruction paths without inferring from code/cause.","file":"hub/src/hub/suites.ts","line":1906}]
finding_counts: {"high":0,"medium":2,"low":0}

M1 source ownership and M3 ordered tier reporting resolved; C1 remains done/unverified pending configured evidence. Main M2 code-only124 distinction, admitted timer/status marker, normal recovery and previous-wire controls are present. Two medium M2 residuals remain: metrics.ts:79 publisher write/rename rejection escapes before bounded ownPackage interruption; suites.ts:1906 and isolated writer:427 omit positive deadline metadata in recovery materialization. Lead93c3ab5d confirms both paths/no exclusions. A-22644 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22644-t-2061-source2-m1-m3-resolved-deadline-failure-path-gaps.md records positive source changes, consumers/hosted uploads/docs and exact correction scope. A-22643 selected local validation is scoped/authored; no configured/T3/T4/Web/browser proof. C2 failed/unverified; no verify at this head. Hold releases for the two residual corrections together and fresh source review. No dev merge/full-suite request or Reviewer execution/edit.

Criteria: C2 failed (Deadline publisher rejection bypasses interruption/handoff, and missing-evidence/isolated result reconstruction drops positive deadlineExpired metadata; fix both residual paths with retained controls.).

### impl-2061 · 2026-11-23T03:13:06.592Z

Source2 residual correction: M2a publication-failure controls first failed on uncaught 'controlled marker publication rejection'; the observer now contains synchronous publisher/diagnostic failures and finally drives ownPackage's bounded interruption/handoff. The publisher emits a bounded secondary stage/native-code diagnostic; no marker is inferred when writing fails. M2b exact missing-evidence and isolated-unavailable materialization controls first failed captured=true at saved.deadlineExpired (undefined vs true), while both legacy-absence arms passed. A shared terminalDeadlineMetadata projection now covers all result writers: isolated report, mismatch repair, missing remote evidence, raw terminal collection, final result, Web/execution/progress rewrites. Positive captured metadata survives result-only recovery, retaining selected infrastructure/cancellation outcomes. These changes add no wire field, executor dependency or snapshot capability beyond source2; resolved M1/M3 and old-run/restart controls retained.

### rev-35 · 2026-11-23T03:19:46.913Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2061-source-3
commit: c41d5b5bfd196ff7ee3cd897f206b647852fa069
scope: full
findings: [{"severity":"medium","text":"M4: the four new recovery controls call a fixture whose pre-registered closer only sees the Store after `new Store` returns. No pre-constructor openDatabase capture owns a handle when later Store initialization rejects; the closer can succeed with store undefined and permit root/guard release. Wire the shared owned-database builder before acquisition with an undefined pre-acquisition stopper, and prove constructor-rejection close before directory/seam release.","file":"hub/test/suite-persistence.test.ts","line":131}]
finding_counts: {"high":0,"medium":1,"low":0}

M2a/M2b resolved: publication/diagnostic failure still drives finally interruption and bounded handoff; shared terminalDeadlineMetadata serves all8 result materializers/rewrites with captured/absent recovery controls. M1/M3 remain resolved. New medium M4 only: four recovery callbacks use suite-persistence fixture Store constructor without native handle capture; registered closer sees undefined on late constructor failure, so root/guard release lacks positive DB-close proof. Lead a22af996 confirms no capture/control/exclusion. A-22646 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22646-t-2061-source3-deadline-paths-corrected-recovery-fixture-capture-gap.md records the narrow owned-database correction and preserves all production/metadata assertions. C1 checked/unverified; C2 failed/unverified. A-22645 scoped local validation is authored, no configured/T3/T4/browser proof. Hold releases for M4 and fresh source review, no verify/dev merge/full-suite request. No Reviewer execution/edit.

Criteria: C2 failed (New recovery controls use a Store fixture without pre-constructor handle capture; later initialization rejection can release root/guard over an open DB. Add shared capture and exact constructor-failure close control.).

### rev-35 · 2026-11-23T03:30:39.462Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2061-source-4
commit: eda38650c1a08609a389f2da270ee1a567e99fce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 resolves M4: shared ownedDatabases capture precedes Store construction, synchronous stopper returns undefined before acquisition, acquired shutdown joins Suites then Store and confirms native closure. Exact WAL rejection control preserves primary identity, observes refused close/root/guard restoration, then positive native close while root exists, actual removal and later guard restoration; independent outer emergency owner protects red unwind and cannot satisfy the positive-close flag. Only affected test/guide changed. Resolved M1/M2/M3 and all production/compatibility paths retained. A-22649 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22649-t-2061-source4-database-capture-corrected-source-clear.md records full-source basis and limits. A-22648 current31-case/local lint/typecheck evidence is authored; source3 selected920pass remains parent-only. C1/C2 done/unverified pending actual final-head configured result. Hold releases for planned reachable-T1 refresh at unchanged tip and Coordinator-window mode-free verify. No source change/dev merge/full-suite request or Reviewer execution/edit.

### rev-35 · 2026-11-23T04:36:34.316Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2061-evidence-1
commit: eda38650c1a08609a389f2da270ee1a567e99fce
scope: evidence
findings: [{"severity":"medium","text":"M5: configured same-head run fails because the periodic native bundle consumer still expects a parent-only suite ref while sharded admission produces <run>-shard-1. The captured commit is unchanged; this is a missed rule20 consumer assertion, not a timeout. Read the actual producer shard/ref plan and migrate all related ref/start/finish/cleanup consumers while retaining the pinned-source native receipt.","file":"hub/test/suite-bundle-native.test.ts","line":54}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured748b83db/A-22651 failed code1 at reviewededa38650c, verification treeaefa6ba7be4b168c5abcf657aa06c06d064fa4f3. Literal0.2117755s assertion keeps identical captured commit but actual ref<run>-shard-1 vs expected parent<run>, suite-bundle-native.test.ts:54; not timeout/load evidence. M5 missed rule20 consumer, attributed by Coordinator9466f7c7; authorized actual-plan ref/cleanup/recovery/T3T4 audit and sequential matching native files under granted load12 slot. All18 new controls have paired base passes+5distinct loaded passes each; resolved M1–M4 not reopened. Actual243T1/444T2 filepass; T3 222pass/1fail completed files,50manifestT3unexecuted; Web55/T418unexecuted. Partial index9045finishes/9030pass/1fail/14skip includes loaded scopes, not overallgreen; existingF2 three finish-only entries kept separate. Linuxc8sfo2 Node24.21/Nvim0.12.5 browsernull, report-only timing/lint, cache:nullunknown/lifecostnotwall. A-22652 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22652-t-2061-evidence1-failed-native-periodic-shard-ref-consumer.md records full scope and literal failure. C1failed/unverified,C2checked/unverified. Hold releases for authorized correction then fresh source review before new window; preserve failedrun, no same-head rerun/devmerge/full-suite request or Reviewer execution/edit.

Criteria: C1 failed (Configured same-head run748b83db failed on unmigrated native periodic bundle ref/start/finish contract (parent expected, shard producer actual); correct/audit consumers and obtain fresh reviewed-head evidence.).

### impl-2061 · 2026-11-23T04:42:01.796Z

M5 consumer audit (Coordinator9466f7c7): literal refs/cland/suites builders/readers are runBundle in hub/src/executor/droplet/run.ts, suite-bundle-native.test.ts and executor-run.test.ts. runBundle creates/reuses/deletes the exact RunRef.id ref (suffix agnostic); DropletRun fetches the captured SHA, not a parsed parent ref. The native periodic case was the missed consumer and now reads every admitted producer, uses separate child bundles, coalesces root advance, checks captured source/ref cleanup, and observes every worker plus parent completion. executor-run's collision/recovery case is an unsharded task submission, so its parent-id ref remains correct; running whole file under slot. #collectShards/#inspectJob/#restoreRemoteResult/#collectLog use each child job id/path from the stored plan; no Git-ref suffix parser. Stage close and close-recovery native files exercise those unchanged group/recovery paths and are included in the sequential slot checks. SuiteReferencePins/pinSuiteLog and suite retention are raw-run filesystem references, not Git refs: their shared grammar accepts hyphenated child ids and retention tracks parentRun; unaffected. Tracker consumes those pins, no Git-ref parser. T2 injected runBundle/tree.bundle consumers (executor-prepare-component, remote-scripted, suite-remote-budget) treat run ids and bundle bytes opaquely; unchanged. Searches covered production, T1–T4 manifests, native fixtures, frozen fixture directories, docs/ADR, QA and shipped skills using refs/cland/suites, refs/cland, suiteRef/suite ref, runBundle, tree.bundle, list-heads, update-ref/for-each-ref and recovery importer names. No T4 native Git-ref consumer found. Failed748b83db/A-22651 remains failed evidence; no configured rerun yet.

### rev-35 · 2026-11-23T04:48:06.162Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2061-source-5
commit: e5509b18570277b09eb00843f4b26f20303191ee
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M5 corrected at e5509b185: actual two-shard periodic plan, one coalesced root advance, private bundles per producer, exact captured head/ref/temporary-ref cleanup/receiver bytes and worker-start receipts, finish every producer and observe parent result. Soak retains one producer. Only native test/guide changed; production and M1–M4 baseline fixed. Namespace/raw-run/recovery/native-consumer inventory matches opaque exact RunRef.id behavior; Coordinator9466f7c7-authorized selected native4files report2/22/3/4pass, separate scopes, slot released. A-22653 intermediate failure remains failed; raw native/source-epoch limits retained. Failed748b83db/A-22651 stays parent-only. A-22654 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22654-t-2061-source5-native-producer-refs-migrated-source-clear.md records audit. C1/C2 done/unverified pending actual new-head configured result. Hold releases for Coordinator-window exact-head mode-free verify; no dev merge/full-suite request or Reviewer execution/edit.

### rev-35 · 2026-11-23T05:55:51.475Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2061-evidence-2
commit: e5509b18570277b09eb00843f4b26f20303191ee
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head configuredf086dd92/A-22656 code0/empty cause, canonical verification tree58e7f1c6ed3bb87e24c0cb66a6ff1a15e710d3c4. Both native bundle identities have paired ordinary passes (periodic0.363211539s/soak0.232438274s); exact ref/source/cleanup/worker/parent assertions retained. All18 new sharding/deadline/ordered-tier/old-wire/recovery/constructor controls have paired base passes+5distinct loaded passes each. Existing periodic cap/slot arms pass. Actual243T1/444T2/248selectedT3/55Web filepasses;25T3 remain batch,18T4unexecuted. No observed failures or active records. Scope-specific raw index and pre-existingF2 three finish-only accounting entries kept separate in audit, not substituted for aggregate. Linuxc8ams3 Node24.21/Nvim0.12.5 Headless1248/CfT156.0.8078.4; report-only timing/lint, cache:nullunknown/lifecostnotwall. Failed748b83db/A-22651 remains failed parent evidence. A-22657 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22657-t-2061-final-evidence2-same-head-sharding-and-timeout-contracts-verified.md establishes C1/C2 with source5; runtime deploy/restart still required, no new live periodic capacity experiment claimed. No remaining findings, source change or run requested; no Reviewer execution/edit/submission.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-23T06:23:22.270Z

Merged 6b54424ad4d9cd409048673f263ad5da1bd5572d onto dev.

### coord · 2026-11-23T09:58:57.543Z

Post-landing check on hub #100: periodic dev T3 run 72c25775 at cc55d9f30 ran on 2 shards and was green: 7,416 tests, 0 failed, all of T2, T3 and Web executed, about 36 minutes wall time against the two earlier single-droplet timeouts at 75 minutes (A-22663).
