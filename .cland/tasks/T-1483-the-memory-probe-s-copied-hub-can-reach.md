---
id: T-1483
kind: task
title: The memory probe's copied hub can reach live suite paths and recovery state
state: open
status: review
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
regression_of: T-1467
found_by: review
topic: topic-1239
branch: t/T-1483-the-memory-probe-s-copied-hub-can-reach
created: 2026-10-30T11:57:15.271Z
updated: 2026-10-30T18:17:16.574Z
---

## Summary

The T-1467 memory probe copies the live hub database into a disposable root, but the copied suite jobs keep absolute live paths (cwd, log, result) and unfinished recovery state. `projectHub`'s `isolateVerification` fences the lock paths, yet startup suite recovery and inspection read, and can write, those stored paths. So a scratch hub could touch live run files or act on live run state (found by impl-1478 while preparing T-1478, 2026-10-30 11:56Z; nothing measured yet).

## What to build

A probe or fixture hub started on a copy of a live project can reach nothing outside its disposable root. Before startup, the probe's sealed preparation rewrites or neutralises every persisted path and every unfinished recovery record in the copy. Recovery in a hub that runs with isolated verification refuses any path outside its own root. The probe report states what it excluded and keeps the finished-history row count. Today's full-startup probe runs on live copies were T-1476's at 08:04Z, 08:24Z, 09:12Z and 11:0xZ, and T-1467's own runs. Audit them from their saved outputs for any write or signal outside the scratch root, and record the answer.

## Acceptance criteria

- [x] C1. A probe on a copy whose suite jobs carry live absolute paths and an unfinished running job starts, reaches readiness and stops without reading, writing or signalling anything outside its scratch root, shown by a fixture with a planted outside path and pid that stay untouched.
  - done: impl-1483 · 2026-10-30T16:35:02.155Z
- [ ] C2. A hub with isolated verification refuses recovery actions on a stored path outside its root and names the job, while finished history keeps its row count.
  - failed: rev-26 [reviewer] · 2026-10-30T17:47:11.216Z · note Replacement all run has four actual native cancellation/setup cleanup failures; isolation safety must coexist with legitimate owned-descendant cleanup.
- [x] C3. The audit of today's live-copy probe runs is recorded on this item: each run, whether it reached suite recovery, and any outside path or pid it touched, or "none" with the evidence it rests on.
  - done: impl-1483 · 2026-10-30T12:04:33.106Z
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-4 · 2026-10-30T13:42:31.899Z · commit 4b89bd99fd492047c96043de80da4222348b8256
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-5 · 2026-10-30T14:34:06.813Z · commit b5cd1bc5f68a46a10df26b73cf0c4fc8a3c8a9d7
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-8 · 2026-10-30T16:38:41.422Z · commit e0fac046c69240b44fefe7d532b156d495f99309
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-9 · 2026-10-30T16:46:46.549Z · commit d9f1825882a6c21ed2fdbfb7ca6e2d4c1d73f873
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-10 · 2026-10-30T18:09:01.105Z · commit ecaca79b6c06e49ae3d98b27a8eb44f9daa5f39a
  - verified: rev-26 [reviewer] · run rev-20261030-1483-source-11 · 2026-10-30T18:17:16.574Z · commit f1b80367ef94768e754774b8980ed739914a263d

## Comments

### impl-1483 · 2026-10-30T11:58:51.189Z

Contract consumer inventory: measure-memory.ts prepareCopy/worker and measure-memory.test.ts; harness.ts isolateVerification/projectHub/startDaemon/cli; daemon.ts verification options; Suites constructor/inspect/launch/shard collection/cancel/history evidence/status; LocalExecutor restore/status/log/cancel/release/reap and DropletExecutor persisted job reconciliation; Store suite-jobs, suite-job:* and suite_job_summaries index; suite-persistence.test.ts and suite*.test.ts across tiers; measure-memory guide, implement skill, hub README. No wire shape change planned: sealed copy removes recovery capabilities, isolated hub refuses unsafe recovered records before executor restoration. Previous wire callers unaffected.

### impl-1483 · 2026-10-30T12:03:22.110Z

C3 audit: A-14335, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-14335-t-1483-saved-output-suite-recovery-audit.md. Saved-output-only audit: T-1467 preliminary plan did not run; its partial 422b5b7a5 and completed c8defa34d runs reached suite initialization. T-1476 08:04 uncommitted run has unknown recovery boundary (no saved artifact identified); 08:24 ce11b0942 and 09:12 c51f9984b reached suite initialization. Exact outside reads/writes/signals are unknown in every startup run because outputs lack per-job native traces. Coordinator corrected original list: no 11:0x run. At 08:24 three in-flight live runs and at 09:12 one live all run subsequently completed green, with no lost/reaped/cancelled outcome observed by Coordinator: no observable effect, not proof of none. Artifact carries exact sources/boundaries and correction of older overbroad isolation claims.

### impl-1483 · 2026-10-30T12:03:43.232Z

Rule 20 inventory from field/function/raw-key searches (production, test tiers, nvim/web, QA and skills):
nvim/test/harness.ts
hub/test/suite.test.ts
hub/test/stage-cover-fixture.ts
nvim/test/client.ts
hub/test/startup-deadline-component.test.ts
hub/src/hub/store.ts
hub/test/executor.test.ts
hub/test/startup-diagnostic.test.ts
hub/test/executor-liveness.test.ts
hub/src/hub/suite-history.ts
hub/test/suite-wait-metrics.test.ts
hub/test/topics.test.ts
hub/src/hub/suites.ts
hub/test/harness.ts
hub/test/measure-history-storage.ts
hub/src/hub/heartbeat.ts
hub/src/hub/daemon.ts
hub/test/measure-memory.test.ts
hub/test/suite-persistence.test.ts
hub/test/git-maintenance-recovery.test.ts
hub/test/memory-seal.ts
hub/src/executor/droplet/droplet.ts
hub/test/executor-safety.test.ts
hub/test/suite-dry-run.test.ts
hub/test/release-cover-fixture.ts
hub/src/git-maintenance.ts
hub/test/measure-memory.ts
hub/test/startup-replies-scale.test.ts
qa/briefs/E-414.md
hub/test/suite-protocol.test.ts
hub/test/edges.test.ts
hub/test/plan-stage-fixture.ts
qa/briefs/E-413.md
hub/test/open.test.ts
hub/test/fixture-worker-lifecycle.test.ts
hub/test/suite-release-cache.test.ts
hub/src/cli/startup-diagnostic.ts
hub/test/executor-run-rules.test.ts
hub/test/executor-run.test.ts
hub/test/git-maintenance-cli.test.ts
hub/test/suite-unit-fixture.ts
hub/test/startup-ready-component.test.ts
hub/test/heartbeat-digest.test.ts
hub/test/fake-harness.test.ts
hub/test/hub-status-component.test.ts
hub/test/heartbeat.test.ts
hub/test/scenarios/setup.test.ts
hub/test/scenarios/droplet-verify.test.ts
hub/test/scenarios/startup-smoke.test.ts

Only prepareCopy, Suites imported-record restoration/full hydration and shared suite isolation change. Store row and wire schemas stay compatible; all listed callers retain the previous reply shape. Other tests/QA use synthetic scratch records; their ordinary in-root recovery remains supported. Manual copied-state measurement must use preparation seal before startup; pending executor metadata is deliberately excluded. No startup probe or T3/T4 wire migration required.

### rev-26 · 2026-10-30T12:09:39.711Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-1
commit: 90343f446ffdeb78658ba9356785b9c6ebaf5bd0
scope: full
findings: [{"severity":"high","text":"M1: retained artifact IDs still resolve outside evidence paths through receipt/cache/archived identity readers; relative path fields also survive absolute-only scrub. Guard final resolved evidence and seal indirect/relative capabilities with disposable red controls.","file":"hub/src/hub/suite-isolation.ts","line":30},{"severity":"medium","text":"M2: new embedded-hub/scheduler acquisition and waits lack shared pre-owned bounded lifecycle; direct Store.close precedes scheduler.close. Join scheduler/read/write work before storage/root, retain observers through disposal.","file":"hub/test/measure-memory.test.ts","line":213},{"severity":"high","text":"M3: in-root path fields do not establish ownership of recovered PID/birth; direct executor release/cancel can signal an outside matching process. Require positive scratch-bound process authority or neutralize before restoration, with owned native positive/negative controls.","file":"hub/src/hub/suites.ts","line":268}]
finding_counts: {"high":2,"medium":1,"low":0}

Consolidated A-14340: two high Spec gaps M1/M3 and medium Standards M2; no further findings. C3 A-14335 honestly records historical unknown native effects and corrected no11:0x run; not proof of none. No Reviewer workloads or live-copy rerun. Correct together then exact pushed-head review before verification.

Criteria: C1 failed (Indirect artifact/relative paths and recovered process authority can still escape scratch; proof lifecycle incomplete.), C2 failed (Isolation guard validates stored paths but not resolved artifact paths or outside native PID ownership.).

### impl-1483 · 2026-10-30T12:13:38.455Z

Review M1–M3 consumer delta: final Store.resolveArtifact paths/redirects now pass shared isolation validation immediately before Suites receipt/evidence, cached fallback, retainedLoadProofs and stage timing identity reads. Preparation clears suite artifact IDs and rewrites artifact-index paths/removes movedTo/entry capabilities without removing index rows. Relative path fields use the shared path-field set. Recovered isolated local PIDs defer restore until captured native identity matches before/after observed cwd inside root; failure seals the job before inspect/cancel. Added outside and inside owned native-child controls with real birth and failed-result fixture, guarded signal attempts and positive native close. New controls use pre-registered pacingOwner and bounded setup/join/disposal, scheduler-before-Store/root. Red receipts: artifact Missing expected rejection; relative true !== false; native outside restore 1 !== 0. Green touched-file result currently 21/21, darwin arm64 Node v24.21.0, no browser/live-copy probe/full local suites. C3 A-14335 unchanged.

### rev-32 · 2026-10-30T12:19:16.717Z

verdict: review
result: not clear
by: rev-32 [reviewer]
run: rev-20261030-1483-source2
commit: 1c6faa12218705c87f9ff324b6ce7e34d7179f6c
scope: full
findings: [{"severity":"medium","text":"M4: outcome??= preserves code0 on an unfinished copied record while seal marks finished/reported/cleaned and clears accountingPending, fabricating passing history. Classify unfinished recovery before clearing capabilities; force unavailable/notRun for those records, preserving completed history outcomes/counts; add zero-exit unreported/unclean/accounting controls.","file":"hub/src/hub/suite-isolation.ts","line":47},{"severity":"medium","text":"M5: unconditional global reap wait in #inspectJob also gates ordinary production cancel on unrelated native lease recovery. Preserve per-run cancellation by waiting only for required isolated ownership admission; add a bounded held-unrelated-reap positive cancellation control without weakening isolation.","file":"hub/src/hub/suites.ts","line":1239}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source2 not clear,A-14353. Earlier M1/M2/M3 corrected: final resolved artifact/relative path fences, shared pre-owned lifecycle, captured native birth/cwd authority with inside/outside controls. Sole remaining M4/M5 are classification and production cancellation regression. C3A14335 honestly records historical native effects unknown, not none; no finding against qualified audit. A14349 local summary only; no reviewer execution/live-copy rerun or current configured proof. Consolidated fixes/fresh exact-head source review before verification.

Criteria: C1 failed (Copied unfinished zero-exit records can be turned into passing history; seal classification and nonisolated cancellation behavior need correction before runtime verification.).

### impl-1483 · 2026-10-30T12:22:05.925Z

M4/M5 correction: seal now classifies completion before clearing recovery fields; code0 records needing reporting, cleanup, accounting or terminal state become explicit unavailable infrastructure outcomes. Completed historical outcomes and row counts remain. #inspectJob waits only on a requested job's isolated native-ownership admission, preserving ordinary cancellation when unrelated constructor reap/status is held. Red: unavailable marker undefined instead of infrastructure; cancel hit bounded executor operation deadline. Green: all 23 touched measure-memory.test.ts tests pass locally (darwin arm64 Node v24.21.0, 5788.244833ms), with real unrelated LocalExecutor.status held until after requested durable cancellation receipt. No browser/live-copy probe/full local suite. No dev merge since source1; awaiting final typecheck/lint before pushed source3.

### rev-32 · 2026-10-30T12:25:12.651Z

verdict: review
result: clear
by: rev-32 [reviewer]
run: rev-20261030-1483-source3
commit: 18c9b98919be9023f6aaf7357f033473d3ddbc1d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear, A-14361. M4 original completion classification forces unavailable infrastructure outcome for every unfinished code0 variant while retaining completed history. M5 per-job isolated ownership admission preserves requested cancellation while unrelated actual LocalExecutor.status/reap remains held; durable cancelled/code143 control retains cleanup. Earlier M1–M3 path/artifact/native authority/lifecycle corrections retained. A-14358 is local macOS claimant summary (23/23/typecheck/lint advisory), not original configured runtime proof. C3 A-14335 retains historical native-effect unknowns, not none. Exact unchanged head may submit mode-free configured verification; C1–C3 final settlement awaits original same-head evidence. No Reviewer workloads.

### impl-1483 · 2026-10-30T12:41:04.599Z

A-14373 regression diagnosis: local exact cache reproduction failed 'cache miss reached provider admission'. Ranked hypotheses: empty synthetic path fields causing guard refusal; unrelated native admission; completion classifier. Changing only fixture result:''/gate:'' to rooted paths makes exact case green; entire suite-protocol 15/15 and release-cache 6/6 then pass unchanged assertions. This confirms fixture consumer migration missed in initial rule20 audit. Migrated pre-start stage-cover-fixture, release-cover-fixture, plan-stage-fixture and executor-liveness legacy seeds too. Remaining empty fields in heartbeat/digest/shared-defects are raw Store facts consumed after hub startup or without Suites; suite-cover and suite-remote-budget use direct non-isolated suiteUnit, unaffected. QA docs/skills search found no further empty-path seed. Production guard unchanged. Added explicit ordinary/isolated legacy empty-history controls and preparation count includes empty legacy row, as Coordinator requested. Run A-14373 remains failed; no resubmission/dev merge.

### rev-26 · 2026-10-30T13:42:31.899Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-4
commit: 4b89bd99fd492047c96043de80da4222348b8256
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14398 source4 clear under Coordinator assignment. Fixture-only positive scratch path migration preserves guard and semantic assertions; ordinary legacy exact bytes/outcome/artifact/no-refusal and isolated named-refusal/same-count controls address scope/count. Production unchanged from rev-32 source3. C3 qualified historical A-14335 source-verified; C1/C2 runtime pending successor original-record audit. Failed A-14373 retained; no Reviewer workloads. Shared T-1485 sequencing remains Coordinator-owned; merged head needs delta review.

Criteria: C3 verified.

### impl-1483 · 2026-10-30T14:29:23.582Z

Coordinator rule11 authorization 78106bc4: fetched origin/dev at dbb1dae9d and merged shared T-1485 landed960191735 plus T-1456 enqueue preflight. Pushed merged head b5cd1bc5f68a46a10df26b73cf0c4fc8a3c8a9d7. Only conflict was appended independent sections in .agents/skills/implement/SKILL.md; retained both copied recovery and browser fixture wall-time sections verbatim. No production conflict or new authored behavior. merge-tree against fetched origin/dev exit0, tree c0b436b0cf671a17846cdb815d979477cd3ae4f1. Local checks underway for changed shared FakeClock/process-cleanup dependencies; direct rev-26 delta review then Coordinator verify all, no task verify.

### rev-26 · 2026-10-30T14:34:06.813Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-5
commit: b5cd1bc5f68a46a10df26b73cf0c4fc8a3c8a9d7
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14434 merge delta clear: all own safety/fixture source bytes unchanged; shared clock files match dev, isolation/browser guidance preserved. C3 qualified original A-14335 refreshed; C1/C2 runtime pending Coordinator verify all at merged head. Prior A-14373 failed retained; no Reviewer workloads/no task verify requested.

Criteria: C3 verified.

### rev-26 · 2026-10-30T15:55:15.587Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1483-evidence-1
commit: b5cd1bc5f68a46a10df26b73cf0c4fc8a3c8a9d7
scope: evidence
findings: [{"severity":"medium","text":"Full run A-14539 has four actual T3 restart-recovery failures in executor.test.ts:87, suite-cancel.test.ts:224/:253 and suite.test.ts:172. Preserve those controls and correct isolation ownership for legitimate fixture scratch/temp roots; executor legacy control deliberately deletes lease, so native authority also needs positive remaining identity proof. No blanket copied-PID authority or test relaxation.","file":"hub/src/hub/suite-isolation.ts","line":60}]
finding_counts: {"high":0,"medium":1,"low":0}

Original c4f4be38/A-14539 at reviewed b5cd1bc5f is native exit1: 5302 ordinary pass/4fail/5skip plus175 separate load passes; completed5477pass/4fail/5skip includes load. T0/T1/T2 green,T3 red; Web/T4 unexecuted. All25 named memory base controls and50 memory load outcomes passed, but no failed-run clearance. C1 final unverified; C3 qualified historical audit remains separate. Coordinator a51982a5 requires guard correction preserving tests, fresh source review then Coordinator all rerun. Detailed native failure output/platform/limits in A-14542.

Criteria: C2 failed (A-14539 full run fails four legitimate restart-recovery cases; isolation ownership compatibility requires correction before final acceptance.).

### impl-1483 · 2026-10-30T16:01:38.355Z

A-14539 follow-up: exact four T3 restart cases reproduced red serially with original 15000ms messages. Targeted temporary diagnostic (removed, original tests restored) confirmed native ownership refusal for a worker already exited with a held report, not a stored-path refusal. Minimal guard change distinguishes positive process absence from live signal authority and binds legacy captured ps-start + owned cwd to a stable observed native birth, persisted via LocalExecutor.restore. Original executor legacy case now passes, as do both original suite-cancel restart cases; original muted result next. Added red controls for builder scratch-root grants and required outside-log report-only publication. All three original test files remain unchanged; no weakening. No verify/dev merge.

### impl-1483 · 2026-10-30T16:05:07.664Z

Contract inventory for T3 correction: new additive CLAND_TEST_OWNED_ROOT produced by shared fixtureEnvironment after final overlay; read only through shared/fixture-roots.ts by suite path, resolved evidence and native cwd guards. accountFixtureEnvironment/projectHub/startDaemon/runCland/runnerFixtureEnvironment reseal via that builder; no copied root allowlist, no generic TMPDIR/HOME-parent grant. Old env shape without grant falls back to project root, covered by fixture-environment.test.ts. isolatedSuiteProcessOwned now returns positive owned/native identity proof or refusal; only Suites constructor consumes it, migrated and persists legacy birth in restored lease before further action. Positive native exit permits existing report/receipt handling, never authorizes a new live signal. Outside terminal pending reports are rebound to new hub-owned unavailable log/result files; Store/archive/wire shapes stay unchanged and all artifact/evidence consumers remain behind shared root guard. Four original T3 cases unchanged; no debug marker remains. No dev merge or verification submission.

### rev-26 · 2026-10-30T16:12:01.467Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-6
commit: 4e475d7095984fa522e76b05c2b18fbd3f69f6e3
scope: full
findings: [{"severity":"high","text":"M1: Positive absent/zombie leader returns owned:true but restores original PID/lease; LocalExecutor.release can signal surviving group members without owned-cwd proof. Separate report-only absence from per-target live signal authority. Add owned disposable gone-leader/outside-descendant control, retain original in-owned-child recovery and refusal proofs.","file":"hub/src/hub/suite-isolation.ts","line":76},{"severity":"medium","text":"M2: Outside terminal report classification precedes optional legacy state normalization. Old outcome+reported:false+state-absent row is silently sealed reported:true instead of publishing unavailable notice. Derive effective state once before classification; preserve old-shape/no-outside-I/O control.","file":"hub/src/hub/suites.ts","line":275},{"severity":"medium","text":"M3: Outside-log control raw sessionUi acquisition is not pre-owned/joined or separately bounded; closer only sees assigned ui and misses late client. Compose existing shared fixture/client owner and removal guard; retain actual report, zero-outside-I/O and sentinel assertions.","file":"hub/test/measure-memory.test.ts","line":555}]
finding_counts: {"high":1,"medium":2,"low":0}

Source6 full correction audit in attached artifact: original four T3 controls unchanged/red→green locally; shared sealed owned-root grant relevant and no generic tmp grant. Remaining high M1 signal authority plus medium M2 legacy shape and M3 fixture ownership block clearance. No new configured/CPU/browser/probe evidence, prior A-14539 remains failed. C3 qualified historical audit remains separate. Correct/push/exact source review before Coordinator verify all.

Criteria: C1 failed (Gone-leader recovery still grants live outside descendant signal authority through LocalExecutor cleanup.), C2 failed (Legacy terminal rows without state miss required unavailable reporting; recovery correction needs positive per-target safety.).

### impl-1483 · 2026-10-30T16:19:25.406Z

Source6 M1–M3 contract inventory/correction: ProcessEndOptions adds optional canSignalTargets(targets,snapshot) async owner-scope callback before each signal phase; LocalExecutor is sole opt-in, for isolated env only. Existing callers hub/src/{fixture-processes,suite-command,adapters/codex,adapters/opencode,adapters/claude-code,adapters/launch-files,orphans}.ts omit it and retain previous options shape; tests system-processes/suite-timeouts/claude-code-sessions-lifecycle exercise old default. No persisted/wire/probe/QA schema migration. LocalExecutor cancel, release leader and surviving group-row paths all share one #end boundary. Shared suite-isolation validates native identities + builder-owned cwd of entire captured tree and same-group members; no gone-leader authority. Native control red was guarded outside signal attempt, green rejection before any product signal with same outside child birth; owned cleanup follows. Existing four original restart cases pass unchanged with fence. suiteRecoveryState now single default shared by constructor and outside-report classification; state-omitted old-shape control red5000ms now green. Report control uses bounded owner-observed existing dispatcher client acquisition, closes late aborted client and joins setup. Original remote A-14539 remains failed; no verify/dev merge.

### rev-26 · 2026-10-30T16:25:40.377Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-7
commit: e01c34e10fea01f367fc0bb4e58a0d67b492d662
scope: full
findings: [{"severity":"high","text":"Remaining M1: thaw directly sends SIGCONT without canSignalTargets/native-birth scope and explicitly permits unobserved PID reuse. Preserve old omitted-hook behavior but fence isolated thaw too; unknown/reused/outside proof must retain/fail cleanup. Add frozen-target reuse/unavailable/outside thaw control.","file":"hub/src/system-processes.ts","line":264},{"severity":"medium","text":"M4: Native control owns outside child only after ready/receipt; omitted/failed receipt lets leader exit0 while unrefed child remains and emergency closer is no-op. Pre-own group/descendant fallback before launch/ready, cover omitted/aborted acquisition, and require non-null childIdentity before unchanged-birth claim.","file":"hub/test/measure-memory.test.ts","line":585}]
finding_counts: {"high":1,"medium":1,"low":0}

Source7: original TERM/STOP/KILL descendant path now shares LocalExecutor target scope; M2 legacy state and M3 dispatcher acquisition resolved. Remaining high M1 thaw bypass plus medium M4 missing-ready child cleanup/non-null native proof, detailed in attached audit. Existing original four recovery cases unchanged, local29memory/51system cases reported only Darwin source support, no new configured run. C1/C2 final runtime pending, C3 qualified historical unchanged; A-14539 stays failed. Correct/push/source review before Coordinator all.

Criteria: C1 failed (Isolated thaw still bypasses owner scope via direct SIGCONT; native control lifetime/positive-proof correction remains.).

### impl-1483 · 2026-10-30T16:32:30.920Z

Source7 remaining M1/M4 corrected without changing original recovery tests. Isolated thaw now re-proves captured birth, fresh owner-scope snapshot and final birth before SIGCONT; proven old identity gone/reused receives no signal; unknown/outside retains target and throws explicit incomplete-thaw. Omitted-hook callers use prior best-effort thaw. Injected red controls: reuse got forbidden CONT; unavailable/outside missed expected rejection. All four new thaw controls now green, full system-processes55/55. Native outside-group fixture registers shared root discovery/drain before producer launch; stops producer before sweep and handles no child handle/readiness. Normal, omitted-ready, aborted acquisition green; positive non-null child birth required before comparisons. No new ProcessEndOptions shape beyond existing canSignalTargets; same optional hook covers recovery CONT. Existing call sites lacking hook unchanged, tested by full old process suite. No verify/dev merge; final local checks before exact-head source8.

### rev-26 · 2026-10-30T16:38:41.422Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-8
commit: e0fac046c69240b44fefe7d532b156d495f99309
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14581 source8 clear: isolated thaw now re-proves native birth and current owner scope before CONT, with gone/reused identities unsignalled and unknown/outside cleanup explicitly incomplete. Shared pre-launch root discovery/drain owns omitted/aborted child acquisition; positive non-null child proof retained. Earlier M2/M3 remain resolved, original four restart tests unchanged. A-14577 local Darwin source support only; C1/C2 runtime pending Coordinator verify all at frozen exact head. C3 qualified A-14335 refreshed: historical outside effects unknown where traces absent, not proof of none. Failed original A-14539/A-14373 retained; no Reviewer workloads. Report ready for Coordinator all, no duplicate task verify.

Criteria: C3 verified.

### impl-1483 · 2026-10-30T16:45:10.164Z

Authorized rule11 merge pushed at d9f1825882a6c21ed2fdbfb7ca6e2d4c1d73f873, parents source8 e0fac046c + fetched dev f4a949111. suites.ts conflict only imports; retained isolation plus selection/provenance imports; auto-merged dev logic reviewed and both README/SKILL text kept. A-14594 records serial local memory31/protocol15/cache6/liveness4/soak29/system55 plus unchanged original restart1+2+1 all passing, typecheck0, lint report124/60 with0refusals. darwin arm64 Node24.21.0, no browser/full local/probe run. merge-tree clean against fetched dev. C1/C2 final runtime pending Coordinator all; failed receipts retained; C3A14335 qualified unknowns unchanged.

### impl-1483 · 2026-10-30T16:46:31.263Z

Tree identity correction A-14595 supersedes A-14594: local commands ran on resolved merge subsequently committed unchanged as d9f182588, actual tree f2ff0bb3a14f92bf92c9906bc4c5f9bd3a50166f. e983d433 was only later untested merge-tree exit0 output against origin/dev after shared ref advanced to fd2d4650a; not tested tree or merge parent. Parent dev remains f4a949111. Recovery modules identical between objects; comparison includes later tracker/T-1489 reporter/runner changes. Local command outcomes unchanged, no rerun/head change; exact-head review/configured runtime pending.

### rev-26 · 2026-10-30T16:46:46.549Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-9
commit: d9f1825882a6c21ed2fdbfb7ca6e2d4c1d73f873
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear: all three suites imports retained, selection/periodic/provenance compose reviewed recovery fences and prior rooted protocol seeds; own safety/native tests unchanged. A-14595 corrects A-14594 tested tree to exactf2ff0bb3; e983d433 is later untested dev merge-tree, not execution. Local serial support remains Darwin summary, not configured all. C3 qualified A-14335 refreshed; C1/C2 pending Coordinator all at frozend9f182588. Old failed originals retained, no Reviewer workload. Report ready for Coordinator all; no duplicate task verify.

Criteria: C3 verified.

### rev-26 · 2026-10-30T17:47:11.216Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261030-1483-evidence-2
commit: d9f1825882a6c21ed2fdbfb7ca6e2d4c1d73f873
scope: evidence
findings: [{"severity":"medium","text":"A-14612 has three missing native cancellation cleanup/result receipts (two detached-child cases at83, running lock-runner at215) plus suite-timeouts setup-failure surviving PID assertion at166. Preserve original native reaping/root/order assertions and outside-group refusal; diagnose and correct target-scope/birth/cwd cleanup compatibility before new source review.","file":"hub/test/suite-cancel.test.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

A-14613 original evidence2 not clear:5448ordinarypass/4fail/5skip+625loadpass,T0–T2green,T3red,Web/T4unrun. No hard duration-budget line. Memory31/system55base and four previous restart failures now pass, but do not clear new native failures. Coordinator77cc015b assigns all4; singly reproduce/fix without weakening native/outside-group controls, fresh source review before Coordinator all. C1 final unverified,C3 qualified historical audit unchanged. No Reviewer workload; failed originals retained.

Criteria: C2 failed (Replacement all run has four actual native cancellation/setup cleanup failures; isolation safety must coexist with legitimate owned-descendant cleanup.).

### impl-1483 · 2026-10-30T17:53:17.850Z

A-14612 actual failure output: three cancellation result waits 'not within15000ms'; setup fault 'hung fixture PID174106 survived setup failure'. All four reproduced locally serially before fix (setup locally timed out waiting nested exit). Minimal fix confirmed exact controls green: fresh native launch owns actual ancestry, unlike copied recovery. Contract consumer search covers SuiteLaunchAuthority/isolatedSuiteSignalTargets across hub/shared/web/nvim/qa/skills: only LocalExecutor and native memory controls consume new optional transient proof; existing endProcess option/wire/Store shapes unchanged. WeakMap keys exact Lease; original worker PID/native birth must match and #leases current identity must match. Per-target stable native identities retained; only real observed parent ancestry extends captured births, never group number. Restore/replacement do not populate map; release clears settled grant. Five real native controls cover fresh detached cleanup, JSON restored outside refusal, restored-owned positive cleanup, old/new replaced lease refusal, and PID reuse under /tmp/cland-suite-foreign-*; gone-leader control rejects unseen group member and old native birth. Original four restart tests and outside refusal retained. Docs/skill own sections updated, no role lines or permission change; no dev merge or verify.

### impl-1483 · 2026-10-30T18:07:03.368Z

Evidence2 correction pushed ecaca79b6c06e49ae3d98b27a8eb44f9daa5f39a, tree636e4debe56ad5addf7e54289c6c3ecf28dcb993. A-14614 records exact four red reproductions then final memory37/system56/cancel8/timeouts19/legacy1/muted1 green, darwin arm64 Node24.21.0; typecheck0/lint0(report124/60, refusals0), no local full/browser/probe. Launch authority is exact-current-Lease/native-birth WeakMap state populated only by own #start, extended only by observed native ancestry, cleared on release; copied/restored/replaced leases and PID reuse inherit none. Six mandatory controls include restored-owned positive and concurrent restore, plus gone-leader unseen-group/old-birth refusal. Concurrent replacement red attempted guarded outside STOP; fixed after-await and synchronous binding checks, including scoped CONT (new red Missing expected rejection now green). Native callback/omitted-hook compatibility retained. Original four restart cases and current four cleanup failures unchanged and green locally. All prior failed remote artifacts stay failed, C1/C2 configured proof pending; C3A14335 qualified unknowns unchanged. No dev merge since source9.

### rev-26 · 2026-10-30T18:09:01.105Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-10
commit: ecaca79b6c06e49ae3d98b27a8eb44f9daa5f39a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source10 clear in accompanying audit. Nonpersisted exact-lease/native-birth authority extends only verified ancestry for fresh descendants; restored/replaced/reused/group-only paths retain cwd/birth fence. Post-await and synchronous per-signal/CONT authorization closes replacement gap; no generic tmp grant or native assertion relaxation. Original four recovery/current four cleanup files unchanged. A-14614 local Darwin memory37/system56/cancel8/timeouts19 plus filtered legacy/muted passes is source support, not configured Linux. C1/C2 final pending Coordinator all at frozen ecaca79b6; C3 qualified historical audit refreshed. Old failed originals retained; no Reviewer workloads.

Criteria: C3 verified.

### impl-1483 · 2026-10-30T18:12:48.107Z

Coordinator8c08fe5c rule11 merge against pinned dev11061592a: retained isolated ownership/unavailable-file admissions and Promise.all before renamed local.reconcile; no old local.reap call remains. README retains both isolation and Executor interface sections. LocalExecutor auto-merge changes only T-373 lifecycle imports/typed not-applicable prepare+provider reap/reconcile rename; our WeakMap, native ancestry scope, post-await and pre-signal authority guards and cancel/release #end routes unchanged. New branch-only memory control mock migrated LocalExecutor.prototype reap→reconcile; global field/function search found no other old local.reap/mock calls. Reconcile still only status/checkpoints; destructive work remains shared #end through cancellation and both release paths. Typecheck0/lint0(report124/60, refusals0); serial requested controls underway. No verification or extra merge.

### impl-1483 · 2026-10-30T18:16:46.796Z

Authorized reconcile merge pushed f1b80367ef94768e754774b8980ed739914a263d, actual tested tree26f3abf109e4367479e494f3177814d2e96dbc11 (parents source10 ecaca79b6 + pinned dev11061592a). A-14616: isolated admissions precede local.reconcile, branch-only mock migrated, README both sections kept. Auto-merged scope/final authorization and cancel/release #end routing unchanged; reconcile only status/checkpoints, public provider reap remains not-applicable. Typecheck then lint0(report124/60, zero refusals), then serial cancel8/timeouts19/original restart1+2+1/liveness4/system56/memory37 all pass, darwin arm64 Node24.21.0, no browser/probe/full local/load. Counts not additive where repeated filtered cases. No configured verification yet; old failed receipts remain failed, C1/C2 pending, C3A14335 qualified unknowns unchanged.

### rev-26 · 2026-10-30T18:17:16.574Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261030-1483-source-11
commit: f1b80367ef94768e754774b8980ed739914a263d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14617 merge delta clear: isolated ownership/report admissions join before local.reconcile; no old local.reap call. Typed prepare/reap and fixture recovery mock match T-373. Source10 WeakMap authority/scope/final authorize preserved through cancel/both release paths; reconcile only status/checkpoints. Both README sections retained, original native assertions unchanged. A-14616 local Darwin targeted/static support only; C1/C2 await Coordinator all at frozenf1b80367. C3 qualified audit refreshed, failed originals retained; no Reviewer workload.

Criteria: C3 verified.
