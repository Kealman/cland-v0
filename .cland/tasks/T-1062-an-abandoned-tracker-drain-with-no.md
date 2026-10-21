---
id: T-1062
kind: task
title: An abandoned tracker drain with no pending operations is reported as not abandoned, so stop skips the fatal-exit fallback
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-811
branch: t/T-1062-an-abandoned-tracker-drain-with-no
created: 2026-10-21T14:17:11.952Z
updated: 2026-10-21T15:46:50.830Z
---

## Summary

`serveProject.storageAbandoned` is inferred from `tracker.storageStatus().abandoned.length`. A `tracker-storage-abandoned` event with `operations: []` therefore reports false and bypasses the CLI's fatal-exit fallback. Found aside by impl-1060 while fixing T-1060, where exactly this event (`{"timeoutMs":2000,"operations":[]}`) preceded a hub that stayed alive after "stopped".

## What to build

The tracker exposes the actual abandonment flag, set whenever the background drain times out, with or without pending operations. Serve uses that flag, so a timed-out drain always takes the fatal-exit fallback.

## Acceptance criteria

- [x] C1. A background drain that times out with no pending operations reports abandoned, and the served hub takes the fatal-exit fallback and exits (test through a real `hub serve`).
  - done: impl-1062 · 2026-10-21T15:36:09.856Z
- [x] C2. A drain that completes in time reports not abandoned, and stop exits normally (test).
  - done: impl-1062 · 2026-10-21T15:36:09.872Z

## Comments

### impl-1062 · 2026-10-21T15:14:38.769Z

Prepared C1 real-process regression in daemon.test.ts before production changes, using a held conflict-retention lstat boundary outside the operation queue. It requires active=null, queued=0, an abandonment record with operations=[], durable stopped receipt, exit code 1 and reaped PID. C2 retains existing normal web-edge shutdown exit0/PID receipts and now asserts no abandonment event. No tests executed yet: Coordinator cover-quiet restriction remains in force.

### impl-1062 · 2026-10-21T15:36:18.580Z

Committed and pushed 56020bba. C1/C2 done and source review requested from reviewer in topic-811. A-8528 holds targeted Darwin arm64 red/green evidence: C1 exact symptom reproduced before production edit; full daemon.test.ts 15/15 after fix and hub typecheck pass. These are targeted development checks, not suite evidence. Mode-free exact-head verify awaits clear source verdict; Coordinator-required full pre-merge lifecycle suite remains pending.

### rev-26 · 2026-10-21T15:38:11.363Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-1062-source-1
commit: 56020bba90db872168400cf0fb4879d3a5cd6206
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8533 records full Standards/Spec audit of five files from 296a5457, tree 48dcaa98. Explicit getter exposes the existing abandonment boolean, and both serveProject paths use it; completed drains remain false. The real hub serve regression observes held background I/O, idle queue, operations=[], durable stopped, then separately bounded exit 1 and reaped PID. Normal stop retains exit 0/reaped hub+Git assertions and no-abandonment control. Docs match; no findings. A-8532 preserves original local Darwin arm64 development red/green outputs: actual red 'hub serve pid 12680 still alive after empty-operation abandonment'; green daemon file 15/15, new case 0.457730542 s. These ran at uncommitted base-tree variants without captured tree hashes, not exact-head proof. C1/C2 remain unverified until same-head mode-free task receipt plus Coordinator-owned required full lifecycle/T3 result. No reviewer execution. Mode-free verification may proceed at this head.

### impl-1062 · 2026-10-21T15:46:46.182Z

Mode-free e8a3e236-f95e-4e03-9860-7610b06621e6 GREEN at source-clear unchanged56020bba90db872168400cf0fb4879d3a5cd6206. T1/T2/Web exit0;2322 tests all pass,0fail/skip. Linux x64 6.8.0-142-generic Node24.21.0 droplet c-8 lon1, lifetime451s cost$0.0313. Host T0 gate2baeed02 reused/not repeated remotely. Lint/duration/ratchet report-only; enforced gates passed. A-8546 durable log. T3 absent from task selection; required Coordinator full1d44cd6d and final Reviewer C1/C2 settlement still pending.
