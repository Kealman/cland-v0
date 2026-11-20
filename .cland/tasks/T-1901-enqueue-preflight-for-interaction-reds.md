---
id: T-1901
kind: task
title: Enqueue preflight for interaction reds
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1528
  - T-1635
topic: topic-1679
branch: t/T-1901-enqueue-preflight-for-interaction-reds
created: 2026-11-16T07:29:47.119Z
updated: 2026-11-20T18:16:38.798Z
---

## Summary

Before enqueue, at the item head merged with current dev: the whole-source lints, T-1635's wording lint against post-landing state, the importer T3 subset, and an allowance check for new tests of 4 s or more on Linux. About half of the 49 red first batches were such interactions (§3.3). §7 #4.

Kind: product. Triage ticket H-13 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. Enqueue reruns whole-source lints at the item head merged with dev and refuses on a finding, naming it (test).
- [x] C3. A non-empty importer T3 subset runs before ready (test).
  - done: impl-1901 · 2026-11-20T18:13:42.397Z

## Dependencies

T-1528, T-1635

## Comments

### impl-1901 · 2026-11-20T17:37:35.296Z

Pre-change consumer audit: enqueue admission is TaskMerges.merge → checkQueuedMerge → MergeQueue.enqueue/store; batch preparation separately reuses checkQueuedMerge and mergeTreeFacts/gateMergeTree. Immutable lint consumers are immediate squash, batch repository, suite admission and standalone test lint. Projected closure policy is requireMergeClosedItemWording (batch-only today). Duration report producers are run-suite/taskDurationReport and durationAllowanceStanzas; duration budget context reads tracked manifests, which carry no platform identity. Task T3 selection uses taskDurationSelection/durationCheck, packageShards, tierSuiteSelection, suite admission/transport/cache, shared/wire and run-suite; tests include suite-task-selection (T1), suite-selection (T3), suite-duration-budget (T1), suite-t3-interactions (T2), merge-batches (T1), merge-policy (T3). Frozen help fixture pins MERGE_USAGE. Searches covered hub/nvim/web/shared/.agents/qa/docs and field/function/raw wording names. Awaiting lead boundary/enforcement decisions before tests or contract edits.

### impl-1901 · 2026-11-20T17:39:57.961Z

Lead decisions 97032ca0 and beb08638: confirmed enqueue/check-runner and task-selection/ready seams. C1/C2 refusal enforcement authorized by human triage A-19813 ask 8e3dd5ab (2026-11-16), satisfying rule27. Summary before-enqueue scope applies only to C1/C2; C3 executes in task verification before ready. C2 requires an exact-head structured Suites Linux receipt with passing identity timings; missing receipt refuses. First C3 red: durationCheck.files was undefined, expected [hub/test/native.test.ts]; green selection now reaches real package T3 targets. Configured verification and native T3 have not run.

### coord · 2026-11-20T17:40:00.379Z

C2 (refuse an unallowed new Linux identity of 4 s or more before enqueue) moved to T-2035 on 2026-11-20. It needs a durable runner-to-Suites timing receipt, which doesn't exist yet: timings are only log lines or deleted side files (impl-1901's audit). T-1901 keeps C1 (whole-source lints at the merged head, refusing) and C3 (importer T3 subset before ready).

### impl-1901 · 2026-11-20T18:07:20.172Z

C1 source now uses isolated configured check outside serialization, projected closure via prepareMergeBatch, bounded16KiB output tail, cleanup before mutation, exact pinned task head, short locked base verification-tree comparison, one changed-dev retry, then explicit refusal. Coordinator7183c2c9 established the full-check/retry boundary;531c479c authorized cancellation revision fence. Native DI consumers audited: TaskMerges constructor, DispatcherOptions, HubBaseOptions/server, serveProject/daemon, ProjectHubOptions/harness; all fake fixture boundaries include identity/checkout/command/cleanup. Wire replies unchanged, including legacy cancel false reply; new T2 frame regression asserts real queue remains empty on finding/cancellation and fresh request queues once. Suite command observer is an additive optional callback; existing supervisor tests pass191-case combined targeted run, native behavior unchanged. CLI and spoke share30-minute merge reply wait, cancellation remains60s. Rule33 exact cadence text matches roles-clauses(T1),suite-selection(T3),durations-runner(T3); passed67-case targeted plus native161+20. All237 T1 files passed2019cases on the earlier draft before final admission/lifecycle corrections; final checks pending. No Linux/browser/configured verification evidence yet.

### impl-1901 · 2026-11-20T18:16:38.798Z

Checkpoint c9b015ce3 committed/pushed to local origin; clean tree. A-22207 preserves the checked source evidence including red-on-dev sanitizer control. Coordinator f25ac661 confirmed shared redactor defect T-2038; no sanitizer patch in T-1901. C3 done. C1 remains pending its unchanged control turning green after T-2038 lands. No source-review request or configured verification has been submitted. Next: merge authorized dev shared fix, rerun exact control and affected checks, request source review, then Coordinator full verification per launch brief.
