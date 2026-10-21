---
id: T-986
kind: task
title: Resume, the ring and resync
state: open
status: review
size: M
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-985
topic: topic-794
branch: t/T-986-resume-the-ring-and-resync
created: 2026-10-20T16:50:00.557Z
updated: 2026-10-21T10:49:02.923Z
---

## Summary

A reconnecting client sends `resume` with its epoch and number. It receives the missed deltas from the hub's in-memory ring, or a fresh snapshot when the ring no longer covers them or the epoch changed. A connection that falls too far behind has its model stream resynced.

## What to build

The ring holds the last 15 minutes of deltas, at most 4 MiB. A hub restart starts a new epoch. On `resume` with a number the ring still covers, the hub sends exactly the missed deltas, then the live ones. Otherwise it sends a fresh snapshot. A connection whose unsent bytes pass 4 MiB has its model stream closed with `resync`, and the client resumes from its number.

## Acceptance criteria

- [x] C1. A featured client dropped while five items change sends `resume` and receives exactly those five deltas in order, then live ones (test).
  - done: impl-986 · 2026-10-21T10:48:13.425Z
- [x] C2. A `resume` whose number the ring no longer covers, or whose epoch differs, receives a fresh snapshot in the current epoch (test, both cases).
  - done: impl-986 · 2026-10-21T10:42:57.415Z
- [x] C3. A hub restart starts a new epoch, and a client resuming across it receives a fresh snapshot (test with two hub starts).
  - done: impl-986 · 2026-10-21T10:42:57.437Z
- [x] C4. The ring keeps at most 15 minutes and 4 MiB of deltas (fake-clock test at both bounds).
  - done: impl-986 · 2026-10-21T10:42:57.462Z
- [x] C5. A connection whose unsent bytes pass 4 MiB gets `resync` on its model stream and resumes from its number (test with a stalled reader).
  - done: impl-986 · 2026-10-21T10:48:13.449Z
- [x] C6. `hub/README.md` documents `resume`, the ring's bounds and `resync`.
  - done: impl-986 · 2026-10-21T10:42:57.524Z
  - verified: rev-26 [reviewer] · run rev-20261021-986-source-2 · 2026-10-21T10:49:02.923Z · commit 869aa5cafa772d2f6275cc7f7b64e724b1b5c361

## Comments

### impl-986 · 2026-10-21T10:33:35.167Z

Confirmed T1/T2 seams with Coordinator. First T2 red→green: hello.resume replays exactly five missed item changes in sequence before the sixth live change. Local Darwin arm64 targeted file only; no suite receipt yet. Implementing retention bounds, fallback epochs and stalled-stream resync.

### rev-26 · 2026-10-21T10:45:49.129Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-1
commit: f2760a3051692855f80e433fbb1ba1959ba82441
scope: full
findings: [{"severity":"medium","text":"M1/Standards: the 2-second resync deadline starts before a paused reader and twelve sequential 700-KiB edits; it measures setup/publication plus drain and can expire before the reader is released. Arm observation first, complete/bound setup, then start the downstream receipt bound after release; keep final assertions (rule 9).","file":"hub/test/connection-resync.test.ts","line":59},{"severity":"medium","text":"M2/Spec: replacing an existing subscription during another client's synchronous publication leaves its old callback captured in core fan-out. Resume replays N, then fan-out invokes the stale callback and delivers N again. Invalidate replaced callbacks or skip removed clients; regress explicit resume of an existing later subscriber, including queued reentrant publication.","file":"hub/src/hub/dispatch.ts","line":1010}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source audit against fixed base 3da31f0f: not clear. Standards M1 at connection-resync.test.ts:59 violates rule 9's setup/receipt deadline separation. Spec M2 at dispatch.ts:1010 lacks a subscription-generation fence, allowing a replaced callback already captured by core.ts:657/:673 to duplicate replayed deltas. Existing new-client reentrant test does not cover replacement of an existing subscriber. Accepted hello.resume design/retention/queue architecture and source docs otherwise match criteria; no other findings. No Reviewer tests or execution; read-only diff check clean. A-8296 is narrative local targeted evidence, raw original receipt supplement requested with provenance limits. Full two-axis audit A-8297 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8297-t-986-source-not-clear-at-f2760a30-subscription-replacement-and-test-boundary.md. C1/C5 failed; no verification marks. Corrected head requires fresh source review before verification.

Criteria: C1 failed (M2: explicit resume can replay a delta then receive it again through the replaced subscription's captured callback.), C5 failed (M2 duplicates resumed model output through stale callbacks; M1 starts the stalled-reader receipt deadline during setup.).

### rev-26 · 2026-10-21T10:49:02.923Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-986-source-2
commit: 869aa5cafa772d2f6275cc7f7b64e724b1b5c361
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; full Standards/Spec audit A-8304 completes A-8297. M1 fixed by observing frames before publication and starting bounded resync drain after acknowledged edits and reader release, retaining final assertions. M2 fixed by subscription-generation fence; new earlier/later-subscriber regression covers both current and queued captured callbacks and exactly-once contiguous replay. Original red mismatch (task/topic duplicated) retained A-8302. No other findings, no post-review dev merge, full diff check clean. C6 documentation source-verified. C1–C5 await post-source exact-head verification. Raw local Darwin targeted receipts A-8301/A-8302 retain precommit and grouped-exit limits; A-8303 has individual command exits for hub typecheck and affected targeted 18/18 at 869aa5ca, no suite/budget/Linux/Web pass inferred. Reviewer did no tests or product execution. Mode-free verification may proceed at this exact reviewed commit.

Criteria: C6 verified.
