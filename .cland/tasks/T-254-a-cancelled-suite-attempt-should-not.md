---
id: T-254
kind: task
title: A cancelled suite attempt should not supersede green cache evidence for its tree
state: open
status: review
size: S
criterion_seq: 3
labels:
  - hub
  - v0.1.2
  - ready-for-agent
assignee: null
parent: E-273
blocked_by: []
topic: topic-269
branch: t/T-254-a-cancelled-suite-attempt-should-not
created: 2026-10-12T01:42:45.744Z
updated: 2026-10-15T03:55:12.886Z
---

## Parent

Found by qa-22 during the T-230 epic QA demo (topic-165, 2026-10-12 01:42Z), M7(a). Refines T-233.

## What happened

`#cached` in hub/src/hub/suites.ts takes the newest fresh attempt for a tree and mode, and that attempt alone decides the cache. A suite cancelled because its requester died (T-212) therefore supersedes an earlier green result for the identical tree, and the next verification runs the full suite again. This fails safe: nothing wrongly reuses. But a cancellation says nothing about the tree, and a needless rerun costs a full suite slot on a budget-1 queue.

## What to build

A cancelled attempt (by its requester, by requester death, or by a head change before admission) no longer supersedes green evidence for its tree. A failed attempt (a test failure, a worker crash or a timeout) still does.

## Acceptance criteria

- [x] C1. Green, then cancelled, then a request on the same tree: a cache hit naming the green run; a test proves it.
  - done: impl-254 · 2026-10-15T03:54:04.313Z
- [x] C2. Green, then failed, then a request on the same tree: a fresh run; a test proves it.
  - done: impl-254 · 2026-10-15T03:54:05.398Z
- [x] C3. hub/README.md's cache paragraph states the rule.
  - done: impl-254 · 2026-10-15T03:54:06.442Z
  - verified: rev-23 [reviewer] · run rev-2026-10-15-254-1 · 2026-10-15T03:55:12.886Z · commit 871876cc7f691d0a4f9bde479a8178f6c29fc39b

## Comments

### impl-254 · 2026-10-15T03:45:21.300Z

Read task and E-273. Regression seam is the epic-prescribed real hub/spoke CLI/socket harness in hub/test/suite.test.ts. Existing green→fresh-failure→request coverage proves C2; adding green→queued cancellation→request coverage before the implementation change.

### impl-254 · 2026-10-15T03:54:07.459Z

Implemented cancellation-aware cache lookup for explicit requester cancellation, requester death, and queued head changes; failed and pending attempts still invalidate older green evidence. Added CLI/socket regressions for explicit/head-change cancellation and extended requester-death coverage to prove reuse across restart. C2 remains covered by the existing green→fresh failure→fresh execution test. Validation: red reproduced at missing cached.run; focused cases 4/4 pass; node --test hub/test/suite.test.ts 69/69 pass (393.2s); npm run typecheck passes; git diff --check clean. origin/dev merged before review (2f476ae2, tracker-only).

### rev-23 · 2026-10-15T03:55:12.886Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-15-254-1
commit: 871876cc7f691d0a4f9bde479a8178f6c29fc39b
scope: full

Source clear at 871876cc7f691d0a4f9bde479a8178f6c29fc39b. Standards and Spec: no high or medium findings. Cache lookup skips explicit cancellation, requester death and queued-head-change cancellation before choosing newest same-tree/effective-mode fresh evidence; failed and pending attempts still block older green. Completion/report/artifact/age/dirty-tree checks and original expiry remain. Reviewed persisted state, cancellation outcome reconciliation and launch paths. CLI/socket regressions check original green run reuse and unchanged execution count for requester/head-change cancellations, plus requester-death reuse across restart; existing green→failed→fresh regression remains intact. C3 README rule verified. C1/C2 remain run-dependent pending exact-head no-mode --executor local gate. A-2668 records source review; A-2667 reported targeted/69-case/typecheck evidence supports it. No per-item QA required.

Criteria: C3 verified.
