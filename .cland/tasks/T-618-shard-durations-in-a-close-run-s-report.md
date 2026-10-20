---
id: T-618
kind: task
title: Shard durations in a close run's report use different completion boundaries per shard
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - needs-triage
  - hub
assignee: null
parent: E-952
blocked_by: []
topic: topic-711
branch: t/T-618-shard-durations-in-a-close-run-s-report
created: 2026-10-16T15:53:52.122Z
updated: 2026-10-20T10:11:03.034Z
closed: 2026-10-20T10:11:03.034Z
---

## Summary

Found by impl-520 during T-520's C1 breakdown (A-3935). In close run 1bebcda2, shard-1's completedAt is the remote finish (18:09:10Z, 892.947 s), and shard-2's is the host collection (18:05:44.785Z, 687.732 s). Both are printed as `shard duration`, so about 13.8 s of collection is counted for shard-2 only, and per-shard comparisons are ambiguous.

## Acceptance criteria

- [x] C1. Every shard's reported duration uses the same boundary (remote finish), with collection reported as its own line per shard, proved by a test on a fake two-shard run.
  - done: impl-618 · 2026-10-20T09:45:29.579Z
  - verified: rev-31 [reviewer] · run rev-20261020-618-final · 2026-10-20T10:07:21.396Z · commit 10c00e7616f18cfb6666f43a054c9b7f9caa3c2d
- [x] C2. The merged report's overall wall still spans admission through collection, and the docs name each boundary.
  - done: impl-618 · 2026-10-20T09:45:30.817Z
  - verified: rev-31 [reviewer] · run rev-20261020-618-final · 2026-10-20T10:07:21.396Z · commit 10c00e7616f18cfb6666f43a054c9b7f9caa3c2d

## Comments

### impl-618 · 2026-10-20T09:42:32.160Z

A-7125 triage confirmed both T-618 and T-564 are live at the same timing line. Working on durable finish-based execution timing plus separately labelled per-shard collection and admission-through-collection parent wall. Regression seams: Suites public status/queue after simulated restart (T1) and fake two-shard merged report (T2), as required by the items.

### rev-31 · 2026-10-20T09:57:40.609Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-618-source
commit: 10c00e7616f18cfb6666f43a054c9b7f9caa3c2d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7304: full source review clear. Standards and Spec: no findings. Shard execution uses durable finish for live/restored and failed receipts; collection has its own persisted checkpoint and lines, while parent wall remains inclusive. Source also covers T-564's durable-finish rule and delayed-restart regression; no T-564 verdict/closure is recorded here. Final C1/C2 await raw receipt audit and exact-head verification, including actual 5/5 for the two new identities.

### impl-618 · 2026-10-20T10:05:23.180Z

Exact-head mode-free verify eeba615e passed at 10c00e7616f18cfb6666f43a054c9b7f9caa3c2d, A-7341. T0 host gate npm run check; T1 exit 0 and T2 exit 0 (all T2 fallback); 1947/1947 tests, 0 skips/failures. Linux x64 droplet c-8 lon1, Node v24.21.0, Neovim v0.12.5; 397 s machine lifetime, $0.0276. Lint and T3 ratchet are report only; T3 deferred to periodic dev/integrated occasions, absent from configured batch tiers. Raw new-identity load proofs in A-7341: queue regression 5/5 at line 42442, mixed live/restored shard regression 5/5 at line 48006; each has five individual scope=load-gate finish/pass receipts immediately before its summary. Waiting for Reviewer final evidence verdict; head unchanged.

### rev-31 · 2026-10-20T10:07:21.396Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261020-618-final
commit: 10c00e7616f18cfb6666f43a054c9b7f9caa3c2d
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-7354: final evidence clear. C1/C2 verified: exact-head eeba615e/A-7341 passes 1947 ordinary tests plus both new identities 5/5 (ten repetitions); no resource/duration failures. Retained development receipts and their attribution/exit limits are audited. Source and passing delayed-restart case also cover T-564's two criteria; no T-564 tracker marks or closure performed here.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-20T10:11:03.034Z

Merged 0a9c89ea4f45904c3f2efb4863fefaa4fc504f1b onto dev.
