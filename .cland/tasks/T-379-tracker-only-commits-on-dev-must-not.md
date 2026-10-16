---
id: T-379
kind: task
title: Tracker-only commits on dev must not cancel or invalidate an integrated dev run
state: open
status: review
size: S
criterion_seq: 3
labels:
  - hub
  - bug
  - ready-for-human
assignee: null
parent: E-579
blocked_by:
  - T-472
topic: topic-375
branch: t/T-379-tracker-only-commits-on-dev-must-not
created: 2026-10-14T08:41:13.625Z
updated: 2026-10-16T16:03:23.761Z
---

## What happened

Reported by cland-impl on 2026-10-14: three tracker-only commits on dev (release and question items filed by the planning session) cancelled the Coordinator's integrated dev run mid-flight, because the hub cancels a queued dev run whenever dev's head moves, tracker-only commits included. The run had to be counted as cover by hand.

## What to build

A run's identity should follow the tree it verifies, not dev's head: commits that touch only `.cland/tasks`, `docs/` or other paths outside the suite's inputs (the tree-hash result cache of T-233 already knows the inputs) neither cancel a queued or running dev run nor invalidate its result; the result then applies to the new head. Until then the rule for everyone committing on dev: check `cland verify queue` first and wait for an integrated run owned by coord with no item, or ask coord to commit the items.

## Acceptance criteria

- [x] C1. A commit on dev that changes only tracker paths (`.cland/tasks`) or the rulebook (`.cland/RULES.md`) leaves a queued or running dev run in place and its result covers the new head. Docs stay suite inputs, because tests assert their text (narrowed by the Coordinator on 2026-10-16, matching E-579 C1 and C3).
  - done: impl-379 · 2026-10-16T16:03:23.761Z
- [x] C2. The paths that count as suite inputs are the same set the tree-hash cache uses, defined once.
  - done: impl-379 · 2026-10-16T15:55:39.514Z
  - verified: rev-31 [reviewer] · run rev-20261016-379-source-2 · 2026-10-16T16:03:12.625Z · commit 1263d9bba15f2076c5961519acdbe8f1caeddc22
- [x] C3. The behaviour is covered by a hub test with a fake run.
  - done: impl-379 · 2026-10-16T15:55:40.211Z
  - verified: rev-31 [reviewer] · run rev-20261016-379-source-2 · 2026-10-16T16:03:12.625Z · commit 1263d9bba15f2076c5961519acdbe8f1caeddc22

## Comments

### coord · 2026-10-15T09:13:11.376Z

Retrospective A-2783, STOP 2: 5 of the 10 cancelled covers came from dev commits or root edits during a live cover. Prefer refusing such commits up front, at least for the integrated run's own root, over cancelling afterwards.

### impl-379 · 2026-10-16T15:50:03.967Z

Reproduced with fixture hub/fake package run: tracker-only commits while running cause exit 1 ('cancelled: submitted head ... changed ...') after successful package completion; queued admission has an independent strict-head guard. Implementing candidate-tree checks for integrated runs while preserving submitted-head provenance and strict task heads. Canonical exclusions will be .cland/tasks and .cland/RULES.md; ordinary docs/config/source remain suite inputs, per launch scope.

### impl-379 · 2026-10-16T15:55:52.818Z

Implemented and pushed b6b7639478786b7e799ea7ad7be83ac5e2db6f82. Evidence A-3938 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3938-t-379-implementation-and-pre-review-evidence.md. All C1–C3 done. Typecheck exit 0 at final head; touched files run sequentially 17/17; existing remote-delivery controls 2/2; shard lint/diff check exit 0. Source review requested from Reviewer in topic-375; verification waits for clear source verdict.

### rev-31 · 2026-10-16T15:57:59.113Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261016-379-source-1
commit: b6b7639478786b7e799ea7ad7be83ac5e2db6f82
scope: full
findings: [{"severity":"medium","text":"Integrated candidate validation still returns null if HEAD advances during hashing, even for tracker/rulebook-only commits with unchanged canonical inputs; queued/completion paths can cancel the run.","file":"hub/src/verification-tree.ts","line":21}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Spec M1 verification-tree.ts:21: captureA→hash canonicalA→tracker/rulebook commitB→finalHEAD B returnsnull although canonicalA==canonicalB. Integrated admission/completion treats null as changed/dirty and cancels. Worker also passes captured current head, so fix integrated mode/callers consistently while retaining task exact-head rejection. Add controlled commit-during-hash regression and source/docs/config/dirty rejection controls. Existing new tests finish commits before releasing work/admission, missing overlap. Standards no findings; one medium Spec finding, no highs/lows. C1 failed; C2/C3 otherwise appear implemented but unmarked. Canonical paths/provenance/task strictness/allowances reviewed; A-3938 targeted17+2/typecheck/shards support only. No verify until corrected-head source clear. Artifact A-3943: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3943-t-379-source-not-clear-administrative-commit-during-identity-hashing.md. No Reviewer edits/tests.

Criteria: C1 failed (A metadata-only commit during candidateTree hashing still causes null/changed-candidate cancellation rather than preserving the integrated run.).

### impl-379 · 2026-10-16T16:00:45.317Z

Addressed not-clear source finding rev-20261016-379-source-1 at 1263d9bba15f2076c5961519acdbe8f1caeddc22 (pushed). Controlled commit-during-hash test went red before the correction; tracker/rulebook overlaps now preserve identity while source/dirty-source and explicit-head controls reject. Evidence A-3949: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3949-t-379-review-correction-commit-during-hash-proof.md. Typecheck exit 0 at exact head; sequential targeted 13/13; shard lint/diff check 0. Fresh source review requested before verification.

### rev-31 · 2026-10-16T16:03:12.625Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261016-379-source-2
commit: 1263d9bba15f2076c5961519acdbe8f1caeddc22
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; Standards 0 findings, Spec 0 findings. A-3958 records the review. Prior M1 resolved: current-candidate hashing compares captured commit with HEAD using canonical suite inputs, then rechecks dirtiness; metadata-only commits overlapping hashing preserve identity. Integrated worker/local admission use current-candidate mode, while explicit task heads remain strict. A-3949 controlled read-tree barrier reproduces the old bug and covers tracker/rulebook preservation plus committed source/dirty source/strict-head rejection. Canonical cache/input set remains one definition (C2); hub fake-run tests cover queued/running changes, advanced-head cache reuse and remote provenance (C3). Reported exact-head targeted13/13, typecheck/shard lint; independent ref/diff check clean. C2/C3 verified. Former C1 failure is corrected; restore its done evidence and leave final execution verification for fresh same-head gate. No source change permitted without new review.

Criteria: C2 verified, C3 verified.
