---
id: T-1942
kind: task
title: A periodic dev T3 run lists uncommitted root files as its deciding files
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1733
branch: t/T-1942-a-periodic-dev-t3-run-lists-uncommitted
created: 2026-11-17T10:51:04.585Z
updated: 2026-11-24T10:54:19.569Z
---

## Summary

Periodic dev T3 run 15938e48 at 9143ae841 (A-20847, 2026-11-17) reported deciding files that aren't part of that commit. They are .cland/RULES.md and seven tracker files, among them .cland/tasks/T-1941-…, which was created at 10:14Z, an hour after 9143ae841. They are the root checkout's uncommitted edits. The run is full regardless ("integrated dev always runs full"), so selection was unaffected. But the run's evidence names files outside the tested commit, against rule 43, and any selection-based run made the same way would be wrong.

## What to build

An integrated run computes and reports its deciding files from the tested commit against its base only, never from the root's working tree.

## Acceptance criteria

- [x] C1. With a dirty root that has an uncommitted tracker edit, a dev integrated run at a commit reports deciding files from that commit's diff only (test).
  - done: impl-1942 · 2026-11-24T10:45:24.699Z
- [x] C2. Every reader of deciding files in integrated and batch runs is listed with its source of truth (rule 41).
  - done: impl-1942 · 2026-11-24T10:36:25.322Z
  - verified: rev-35 [reviewer] · run rev-35-1942-source-2 · 2026-11-24T10:54:19.569Z · commit 12739fecbf315ac9d141f6bdb9ba1e699df7e38a

## Comments

### coord · 2026-11-17T13:33:44.312Z

Second instance, 2026-11-17: periodic dev T3 832e3775 at 1f0c614 (A-20888) lists .cland/tasks/T-1945-… as a deciding file. T-1945 was created at 12:20Z and was still uncommitted in the root when the run started at 12:31Z, well after 1f0c614 (11:58Z).

### impl-1942 · 2026-11-24T10:07:07.594Z

Consumer inventory (rule 41): selectPackageSuite produces committed merge-base diff plus working changes; suiteCandidate.inspect feeds periodic dev T3/soak and Suites.start. Suites persists/transports selection to executor and run-suite, which uses selectionFromEnv before local discovery. occasionSelection uses files for batch Web; lightBatchSelection unions files with batchMemberPaths pinned member-to-HEAD deltas for T3; batchInteractionSelection uses those pinned member deltas and may add importer tests. taskInteractionSelection, taskDurationSelection and taskImporterSelection read task files only. describeSelection and Dispatcher result counts render persisted files; shard planners read shard.files (explicit test targets), not deciding-file discovery. selectWebRepetitionFiles reads selecting paths with fetched-dev baseline. selectionTransport/selectionFromEnv, executor bundle/selection replay and stored SuiteJob readers retain existing wire shape; no field migration. Tests: suite-selection*, suite-task-selection, verification-commands, merge-batches, suite-close-component, suite-load-gate-plan; guides/QA: docs/agents/tests.md, docs/hub/running.md, per-file suite-selection guides; no nvim/web client decides paths. Dev correction excludes working-tree inputs; batch prepared checkouts remain clean and pinned deltas unchanged.

### rev-35 · 2026-11-24T10:41:02.891Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1942-source-1
commit: 59f472eb2d6b0a79692c55a1112c65d7fd15d0f5
scope: full
findings: [{"severity":"medium","text":"M1: the new native-Git callback acquires mkdtemp before installing raw t.after(rm), then performs setup and Git commands without an encompassing cancellation owner, separate setup/action observation bounds, or native child-close fence before root removal. Promisified execFile only joins normal awaits; the environment exemption does not supply ownership. Migrate this exact regression to the shared pre-acquisition owner with captured native closure and failure/cancellation/guarded-removal controls, retaining all committed/dirty/task/report assertions.","file":"hub/test/suite-selection-fetch.test.ts","line":18}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22838: Standards1medium/Spec0additional. M1 new T3 callback uses mkdtemp then raw t.after(rm), unbounded setup/native Git and no interrupted child-close/root-removal owner; lead4b575d9f confirms no exclusion/control. Environment sealing is correct but does not supply lifecycle ownership. Retain all committed/dirty/task/report final assertions under the shared owner. Production dev filtering, non-dev inputs, docs and C2 source-of-truth list check out. C1 failed; C2 remains done/unverified. Local authored normal completion is not cancellation proof; no configured result yet. No reviewer execution/edit. Hold releases for correction/fresh source review before verification; no dev merge/full task-head suite requested.

Criteria: C1 failed (New native Git regression lacks pre-acquisition whole-callback ownership, separate setup/action bounds and positive native-close fence before root removal.).

### rev-35 · 2026-11-24T10:54:19.569Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1942-source-2
commit: 12739fecbf315ac9d141f6bdb9ba1e699df7e38a
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22852: Standards0/Spec0. M1 resolved with suiteCase before acquisition, separately bounded setup/action, native fixtureCommand closure/birth ownership and joined selector continuation. New failure/cancellation controls assert structured native close independently of actual guarded removal refusal/sentinel/release/ENOENT. Original selector assertions retained, production blob unchanged. C2 inventory checked/verified; C1 done/unverified pending configured same-head receipts. A-22842 preserves failed over-specific signal expectation separately from final7/7 local native success; request reports full typecheck/lint0. No reviewer execution/edit. Hold releases; seek Coordinator mode-free window at unchanged head; no dev merge/full task-head suite/duplicate run requested.

Criteria: C2 verified.
