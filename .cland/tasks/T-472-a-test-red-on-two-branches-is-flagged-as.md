---
id: T-472
kind: task
title: A test red on two branches is flagged as a shared dev defect, so it is not chased per branch
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-470
topic: topic-356
branch: t/T-472-a-test-red-on-two-branches-is-flagged-as
created: 2026-10-15T09:13:16.499Z
updated: 2026-10-16T04:38:07.041Z
---

## Summary

Retrospective A-2783, STOP 4: 8 shared fixes were copied into 22 branches, and several implementers chased the same flake separately. When the same test fails in task runs on two different branches, the hub raises one notice to the Coordinator as a shared-defect candidate.

## What to build

The hub keeps the failing test identities of each task verify result for 72 hours. A second distinct branch failing the same `file::test` raises a `shared-defect` notice to the Coordinator, with both runs and logs and the test's last-changing commit. The Implementer clause says to hold rather than diagnose a test so flagged.

## Acceptance criteria

- [x] C1. Two task runs on different branches failing the same test produce exactly one `shared-defect` notice naming both runs, and the same branch failing twice does not.
  - done: impl-472 · 2026-10-16T04:37:09.442Z
- [x] C2. The notice names the commit that last changed the test.
  - done: impl-472 · 2026-10-16T04:37:09.659Z
  - verified: rev-31 [reviewer] · run rev-20261016-472-source · 2026-10-16T04:38:07.041Z · commit bde2582d3d63da18f0364927bdba4a07c045db26
- [x] C3. The Implementer and Coordinator clauses describe the notice and the shared-fix path.
  - done: impl-472 · 2026-10-16T04:37:09.871Z
  - verified: rev-31 [reviewer] · run rev-20261016-472-source · 2026-10-16T04:38:07.041Z · commit bde2582d3d63da18f0364927bdba4a07c045db26

## Comments

### impl-472 · 2026-10-16T04:26:33.812Z

Implementation seam: suite result publication with durable log artifacts; structured failure identities emitted by the existing package reporter. Correlation will live outside hot suites.ts/dispatch.ts. Awaiting lead confirmation of TDD seam and file-level provenance interpretation of C2.

### impl-472 · 2026-10-16T04:37:10.158Z

Implemented and pushed at bde2582d after the pre-review merge of frozen dev b4fc313b. A-3710 records design, Coordinator C2 interpretation, real receipt fixtures and red/green evidence. Targeted checks: reporter 1/1, history/parser 3/3, role snapshots 10/10, roles 8/8; root typecheck, shard lint and diff whitespace check pass. The parser uses existing spec/load-gate receipts (no runner change); ISO UTC timestamps normalize for correlation. Two-line dispatch hook, no suites.ts change. Source review requested next; fresh explicit droplet verify follows a clear source verdict. qaPolicy is none/after-stage; no per-item QA brief required.

### rev-31 · 2026-10-16T04:38:07.041Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-472-source
commit: bde2582d3d63da18f0364927bdba4a07c045db26
scope: full

Source clear against frozen dev b4fc313b. Standards: no findings. Spec: no findings. Dedicated real-receipt parser correlates normalized file::test identities; durable 72h history excludes same-branch-only/passing/cached/cancelled/integrated/unbound results. Transactional notice/history and stable IDs preserve concurrent/crash retry deduplication; core.noticeTo publishes after commit. Two-line dispatch hook renews authorization after provenance I/O. C2 verified under Coordinator 6deb0c2d's file-history-at-dev-merge-base interpretation, explicitly labelled with unavailable fallback; C3 verified in default/project clauses and targeted role checks. C1 remains pending exact-head post-source run. A-3710 targeted public reporter/core/roles evidence supports source review; no full gate claimed. Machine shard entries present, supplied typecheck/shard/diff checks green. Analysis A-3714: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3714-t-472-source-clear-at-bde2582d.md. No Reviewer edits/tests.

Criteria: C2 verified, C3 verified.
