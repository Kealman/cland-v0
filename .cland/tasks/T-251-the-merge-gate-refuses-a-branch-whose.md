---
id: T-251
kind: task
title: The merge gate refuses a branch whose hub test files aren't all classified in the shard manifest
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-251
parent: T-230
blocked_by: []
topic: topic-162
branch: t/T-251-the-merge-gate-refuses-a-branch-whose
created: 2026-10-12T00:05:36.212Z
updated: 2026-10-12T01:04:00.104Z
---

## What happened

Twice in one evening (2026-10-11), a merged item left dev with a hub test file missing from hub/test/shards.json: launch-recovery.test.ts from T-129, then termination-ownership.test.ts from T-102. Both branches predated T-215's manifest, so their own suites ran without the lint. After each merge, every full suite on dev exited at admission with "unclassified hub test" until branches added the line themselves. That cost several queue slots and needed a cross-branch coordination fix each time.

## What to build

Run the shard-manifest lint (hub/test/lint-shards.ts) on the merge candidate tree, meaning the branch merged onto dev, in `cland merge`'s preparation. Refuse with a named error that lists the unclassified files and the line to add. Run the same check in `cland verify` admission against the candidate tree, so the failure shows before the suite is queued.

## Acceptance criteria

- [x] C1. `cland merge` refuses a candidate whose merged tree has an unclassified hub test, naming each file and the line to add; a classified one merges as before.
  - done: impl-251 · 2026-10-12T00:11:37.504Z
  - verified: rev-18 [reviewer] · run rev-18-20261012-251-2 · 2026-10-12T00:17:59.923Z · commit acad7c183a8c5d361848035a0baa0c3059a0457e
- [x] C2. `cland verify` reports the same problem at submission, without taking a queue slot.
  - done: impl-251 · 2026-10-12T00:16:14.753Z
  - verified: rev-18 [reviewer] · run rev-18-20261012-251-2 · 2026-10-12T00:17:59.923Z · commit acad7c183a8c5d361848035a0baa0c3059a0457e
- [x] C3. Protocol tests cover both. `npm run typecheck && npm test` pass.
  - done: impl-251 · 2026-10-12T01:03:28.303Z
  - verified: rev-18 [reviewer] · run rev-18-20261012-251-2 · 2026-10-12T01:03:42.721Z · commit acad7c183a8c5d361848035a0baa0c3059a0457e

## Comments

### impl-251 · 2026-10-12T00:06:21.015Z

Claimed from dev fae0e78; worktree .cland/worktrees/T-251. Using existing merge.prepare / suite.run protocol seams specified by C1–C3, and reusing hubShards for lint. First isolated commit adds the exact shared termination-ownership manifest classification. QA policy is after-stage, so item requests review only.

### coord · 2026-10-12T00:06:39.076Z

Scope addition (Coordinator, 2026-10-12 00:20Z, from the T-230 brief draft): the shipped QA clause in hub/src/roles/default-roles.ts:175 still sends QA to the package scripts and /tmp/cland-suite.lock. Update it to cland verify, consistent with the qa skill, with roles.toml handover lines. T-230's C6 (docs and clauses describe cland verify) depends on it.

### impl-251 · 2026-10-12T00:11:52.359Z

Implemented and pushed head 8f592840d11ccc0c2ea6e045d0a72de0b7b190e7 after merging origin/dev b03ae7c. Merge validates immutable combined tree before checkout/refs; verification checks submitted worktree before cache/jobs/queue. Shared classifier supplies every missing file and machine line plus existing resource/missing-entry checks. QA clause and test docs updated; exact roles.toml:140 handover in A-1464 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1464-t-251-implementation-and-qa-clause-handover.md. Node 24.21.0 typecheck and six shard/runner regressions pass; both new protocol regressions reproduced failure before fix and pass afterward. Requested reviewer; C3 pending final full suite.

### rev-18 · 2026-10-12T00:14:50.618Z

verdict: review
result: not clear
by: rev-18 [reviewer]
run: rev-18-20261012-251-1
commit: 8f592840d11ccc0c2ea6e045d0a72de0b7b190e7

Medium — hub/src/hub/suites.ts:146: classification precedes captured HEAD/candidate binding, so a commit adding an unclassified test between lint and the later head reads can be queued without classification. Implementer confirms no fence in 8f59284 and is correcting immutable-head binding plus pre-publication freshness. Merge candidate lint/ref protection, all-file suggestions, shared classifier and requested QA clause handover otherwise check out. C3 remains pending full verification. Details: A-1465 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1465-t-251-review-at-8f59284-verify-classification-is-not-head-bound.md

Criteria: C2 failed (Worktree lint precedes captured HEAD; a later unclassified committed head can become a durable queued job without immutable-tree classification.).

### impl-251 · 2026-10-12T00:16:37.157Z

Corrected review finding A-1465 at acad7c183a8c5d361848035a0baa0c3059a0457e: classify captured immutable HEAD and dirty worktree, then recheck HEAD immediately before durable job publication. Both held-Git races reproduced incorrect queue admission before fix; stronger dirty-manifest-corrected cases and four admission/cache/dirty/subdirectory targets pass 6/6 afterward. Full merge protocols 45/45, initial verify protocols 44/44, shard regressions 6/6 and Node 24.21.0 typecheck pass. Origin/dev b03ae7c fetched/merged-up-to-date before final suite. Corrected evidence A-1467 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1467-t-251-corrected-verification-head-binding-at-acad7c1.md. Re-requested review; submitting full suite all, C3 pending its exact-head result.

### rev-18 · 2026-10-12T00:17:59.923Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261012-251-2
commit: acad7c183a8c5d361848035a0baa0c3059a0457e

No high or medium source findings remain. Immutable captured-head lint plus mutable worktree lint and final HEAD recheck close A-1465's confirmed bypass. Both held-Git protocol cases specifically require the immutable check/final fence, asserting no job/slot. Merge candidate/ref protection, all-file suggestions and QA clause/handover are unchanged and checked. C1/C2 freshly verified; C3 awaits exact-head managed full suite. A-1467 reports supported merge/targeted/typecheck checks, not complete full qualification. Details: A-1469 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1469-t-251-corrected-admission-review-at-acad7c1-c1-c2-clear.md

Criteria: C1 verified, C2 verified.

### impl-251 · 2026-10-12T01:03:28.458Z

Final full verification passed on exact committed head acad7c183a8c5d361848035a0baa0c3059a0457e: managed all suite 895a7480-7bf8-4f51-bc52-8049acfd092e exits 0, typecheck green, 1603/1603 tests pass with zero failures/cancellations/skips. Durable log A-1478: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1478-suite-895a7480-7bf8-4f51-bc52-8049acfd092e-all-at-acad7c1.log. C3 done; C1/C2 already reviewed clear at this head. Final C3 review verification requested; retaining claim for merge.

### coord · 2026-10-12T01:04:00.104Z

Merged 16b531cedc4055a84804040b6030895c5d97b3f1 onto dev.
