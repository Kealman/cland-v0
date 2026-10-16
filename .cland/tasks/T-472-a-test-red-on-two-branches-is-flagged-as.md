---
id: T-472
kind: task
title: A test red on two branches is flagged as a shared dev defect, so it is not chased per branch
state: open
status: ready
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
updated: 2026-10-16T05:30:43.694Z
---

## Summary

Retrospective A-2783, STOP 4: 8 shared fixes were copied into 22 branches, and several implementers chased the same flake separately. When the same test fails in task runs on two different branches, the hub raises one notice to the Coordinator as a shared-defect candidate.

## What to build

The hub keeps the failing test identities of each task verify result for 72 hours. A second distinct branch failing the same `file::test` raises a `shared-defect` notice to the Coordinator, with both runs and logs and the test's last-changing commit. The Implementer clause says to hold rather than diagnose a test so flagged.

## Acceptance criteria

- [x] C1. Two task runs on different branches failing the same test produce exactly one `shared-defect` notice naming both runs, and the same branch failing twice does not.
  - done: impl-472 · 2026-10-16T04:37:09.442Z
  - verified: rev-31 [reviewer] · run rev-20261016-472-final · 2026-10-16T05:28:35.991Z · commit bde2582d3d63da18f0364927bdba4a07c045db26
  - verified: rev-31 [reviewer] · run rev-20261016-472-merge-delta · 2026-10-16T05:30:42.760Z · commit c2d68becc06cd9e4f8e7e7d6324ccf91a1427df2
- [x] C2. The notice names the commit that last changed the test.
  - done: impl-472 · 2026-10-16T04:37:09.659Z
  - verified: rev-31 [reviewer] · run rev-20261016-472-source · 2026-10-16T04:38:07.041Z · commit bde2582d3d63da18f0364927bdba4a07c045db26
  - verified: rev-31 [reviewer] · run rev-20261016-472-merge-delta · 2026-10-16T05:30:42.760Z · commit c2d68becc06cd9e4f8e7e7d6324ccf91a1427df2
- [x] C3. The Implementer and Coordinator clauses describe the notice and the shared-fix path.
  - done: impl-472 · 2026-10-16T04:37:09.871Z
  - verified: rev-31 [reviewer] · run rev-20261016-472-source · 2026-10-16T04:38:07.041Z · commit bde2582d3d63da18f0364927bdba4a07c045db26
  - verified: rev-31 [reviewer] · run rev-20261016-472-merge-delta · 2026-10-16T05:30:42.760Z · commit c2d68becc06cd9e4f8e7e7d6324ccf91a1427df2

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

### rev-31 · 2026-10-16T05:27:57.825Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-472-evidence-1
commit: bde2582d3d63da18f0364927bdba4a07c045db26
scope: evidence

A-3742/17f364e5 exact-head Linux gate exits1:1900 pass/1 ordinary failure/4 skips. All five new shared-defect/parser/history/role cases pass normally and each5/5 load. Sole failure task-prefixes.test.ts:200 returns old build/T-2 plan where replacement invalid epic requires null; exact existing Bugs/S T-574, confirmed against item. No own source finding or failed criterion mark. C1 execution verification remains pending qualifying gate/disposition; C2/C3 source marks remain current. No Neovim completion claimed. Await Coordinator shared-fix/disposition, no unchanged retry requested. Analysis A-3743: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3743-t-472-first-linux-gate-known-t-574-failure.md. No Reviewer edits/tests.

### rev-31 · 2026-10-16T05:28:35.991Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-472-final
commit: bde2582d3d63da18f0364927bdba4a07c045db26
scope: evidence

Final clear under independently confirmed Coordinator14aa3c33 item-specific disposition. Exact-head Linux A-3742/17f364e5 has1900pass/1 known T-574 failure/4skip, exit1; it is not relabelled an all-green run. Coordinator explicitly accepts this receipt: T-574 fails3/3 alone on dev, proven test-observation race/test-only fix coming, hub-only owes no Neovim phase, no new run/pick. C1 verified: public reporter assertions establish no same-branch candidate, one distinct-branch notice naming both runs/logs, no third-branch duplicate; all five own cases ordinary green and5/5 load, including persistence/expiry/concurrency/parser/clauses. C2/C3 source marks current from A-3714; all three criteria verified. No source findings or per-item QA. A-3743 gate uncertainty resolved by explicit decision. Artifact A-3745: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3745-t-472-final-clear-under-explicit-t-574-gate-disposition.md. No Reviewer edits/tests.

Criteria: C1 verified.

### rev-31 · 2026-10-16T05:30:42.760Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-472-merge-delta
commit: c2d68becc06cd9e4f8e7e7d6324ccf91a1427df2
scope: delta

Merge delta clear. Parents final-reviewed bde2582d and fetched dev d6af3812. All eleven task source/clause/test/fixture/shard blobs byte-identical to prior final head. Parsed manifest equals exact dev plus unchanged own5.216s reporter allowance/reason; all shared entries retained. Standards/Spec no findings, diff check clear; parse/duration lint/shards reported green. Coordinator ec8f2093 explicitly authorizes merge-only review/no new suite. Prior A-3714 source and A-3745 final/A-3742 evidence remain under independently confirmed14aa3c33 T-574 exception; historical receipt remains exit1, own five cases ordinary/5-of-5 green, accepted hub-only scope owes no Neovim phase. C1/C2/C3 reverified at merge head. Artifact A-3751: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3751-t-472-merge-delta-clear-at-c2d68bec.md. No Reviewer edits/tests.

Criteria: C1 verified, C2 verified, C3 verified.
