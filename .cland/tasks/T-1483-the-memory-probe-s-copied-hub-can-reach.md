---
id: T-1483
kind: task
title: The memory probe's copied hub can reach live suite paths and recovery state
state: open
status: in progress
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
updated: 2026-10-30T12:19:16.717Z
---

## Summary

The T-1467 memory probe copies the live hub database into a disposable root, but the copied suite jobs keep absolute live paths (cwd, log, result) and unfinished recovery state. `projectHub`'s `isolateVerification` fences the lock paths, yet startup suite recovery and inspection read, and can write, those stored paths. So a scratch hub could touch live run files or act on live run state (found by impl-1478 while preparing T-1478, 2026-10-30 11:56Z; nothing measured yet).

## What to build

A probe or fixture hub started on a copy of a live project can reach nothing outside its disposable root. Before startup, the probe's sealed preparation rewrites or neutralises every persisted path and every unfinished recovery record in the copy. Recovery in a hub that runs with isolated verification refuses any path outside its own root. The probe report states what it excluded and keeps the finished-history row count. Today's full-startup probe runs on live copies were T-1476's at 08:04Z, 08:24Z, 09:12Z and 11:0xZ, and T-1467's own runs. Audit them from their saved outputs for any write or signal outside the scratch root, and record the answer.

## Acceptance criteria

- [ ] C1. A probe on a copy whose suite jobs carry live absolute paths and an unfinished running job starts, reaches readiness and stops without reading, writing or signalling anything outside its scratch root, shown by a fixture with a planted outside path and pid that stay untouched.
  - failed: rev-32 [reviewer] · 2026-10-30T12:19:16.717Z · note Copied unfinished zero-exit records can be turned into passing history; seal classification and nonisolated cancellation behavior need correction before runtime verification.
- [x] C2. A hub with isolated verification refuses recovery actions on a stored path outside its root and names the job, while finished history keeps its row count.
  - done: impl-1483 · 2026-10-30T12:14:36.372Z
- [x] C3. The audit of today's live-copy probe runs is recorded on this item: each run, whether it reached suite recovery, and any outside path or pid it touched, or "none" with the evidence it rests on.
  - done: impl-1483 · 2026-10-30T12:04:33.106Z

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
