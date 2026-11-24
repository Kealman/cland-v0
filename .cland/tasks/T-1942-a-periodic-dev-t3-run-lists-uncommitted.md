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
updated: 2026-11-24T10:39:25.866Z
---

## Summary

Periodic dev T3 run 15938e48 at 9143ae841 (A-20847, 2026-11-17) reported deciding files that aren't part of that commit. They are .cland/RULES.md and seven tracker files, among them .cland/tasks/T-1941-…, which was created at 10:14Z, an hour after 9143ae841. They are the root checkout's uncommitted edits. The run is full regardless ("integrated dev always runs full"), so selection was unaffected. But the run's evidence names files outside the tested commit, against rule 43, and any selection-based run made the same way would be wrong.

## What to build

An integrated run computes and reports its deciding files from the tested commit against its base only, never from the root's working tree.

## Acceptance criteria

- [x] C1. With a dirty root that has an uncommitted tracker edit, a dev integrated run at a commit reports deciding files from that commit's diff only (test).
  - done: impl-1942 · 2026-11-24T10:36:24.808Z
- [x] C2. Every reader of deciding files in integrated and batch runs is listed with its source of truth (rule 41).
  - done: impl-1942 · 2026-11-24T10:36:25.322Z

## Comments

### coord · 2026-11-17T13:33:44.312Z

Second instance, 2026-11-17: periodic dev T3 832e3775 at 1f0c614 (A-20888) lists .cland/tasks/T-1945-… as a deciding file. T-1945 was created at 12:20Z and was still uncommitted in the root when the run started at 12:31Z, well after 1f0c614 (11:58Z).

### impl-1942 · 2026-11-24T10:07:07.594Z

Consumer inventory (rule 41): selectPackageSuite produces committed merge-base diff plus working changes; suiteCandidate.inspect feeds periodic dev T3/soak and Suites.start. Suites persists/transports selection to executor and run-suite, which uses selectionFromEnv before local discovery. occasionSelection uses files for batch Web; lightBatchSelection unions files with batchMemberPaths pinned member-to-HEAD deltas for T3; batchInteractionSelection uses those pinned member deltas and may add importer tests. taskInteractionSelection, taskDurationSelection and taskImporterSelection read task files only. describeSelection and Dispatcher result counts render persisted files; shard planners read shard.files (explicit test targets), not deciding-file discovery. selectWebRepetitionFiles reads selecting paths with fetched-dev baseline. selectionTransport/selectionFromEnv, executor bundle/selection replay and stored SuiteJob readers retain existing wire shape; no field migration. Tests: suite-selection*, suite-task-selection, verification-commands, merge-batches, suite-close-component, suite-load-gate-plan; guides/QA: docs/agents/tests.md, docs/hub/running.md, per-file suite-selection guides; no nvim/web client decides paths. Dev correction excludes working-tree inputs; batch prepared checkouts remain clean and pinned deltas unchanged.
