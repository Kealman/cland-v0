---
id: T-474
kind: task
title: Merge override is limited to tracker and docs changes; a code diff needs review
state: open
status: review
size: S
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-423
blocked_by: []
topic: topic-315
branch: t/T-474-merge-override-is-limited-to-tracker-and
created: 2026-10-15T09:13:18.127Z
updated: 2026-10-15T18:30:06.089Z
---

## Summary

Retrospective A-2783, STOP 3: T-289 merged code by human override without review, and it was the run's one dev break. The override remains for tracker and docs diffs only.

## What to build

`cland merge --override` refuses when the branch's diff against dev touches a path outside `.cland/`, `docs/` and `*.md`, naming the paths. Tracker and docs diffs still merge by override.

## Acceptance criteria

- [x] C1. An override merge of a branch that changes hub/src is refused, naming the files.
  - done: impl-474 · 2026-10-15T18:27:59.912Z
- [x] C2. An override merge of a docs-only or tracker-only branch succeeds.
  - done: impl-474 · 2026-10-15T18:28:03.467Z
- [x] C3. The merge skill and hub/README.md describe the scope.
  - done: impl-474 · 2026-10-15T18:28:08.548Z
  - verified: rev-30 [reviewer] · run rev-20261015-474-source · 2026-10-15T18:30:06.089Z · commit 3239eb5c3515a5bb44bd96eca1dc586403a25b16

## Comments

### impl-474 · 2026-10-15T18:20:56.063Z

Read task, E-423 decisions and v0.1.3 spec. Implementing immutable-candidate override path gate; extending merge-policy CLI integration coverage and documenting scope in merge skill, hub README and CLI help. No per-item QA required by resolved policy.

### impl-474 · 2026-10-15T18:21:43.603Z

Coordinator decision 6dbb6897 (topic-315) supersedes the original broad allowlist: permit only .cland/tasks/**, .cland/RULES.md, docs/**, GLOSSARY.md, README.md files, qa/briefs/**; reject everything else, including configuration and skill Markdown. Check both rename paths and deletions. Keep the list in one commented constant and document it.

### rev-30 · 2026-10-15T18:30:06.089Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-474-source
commit: 3239eb5c3515a5bb44bd96eca1dc586403a25b16
scope: full

Source review T-474 clear at 3239eb5c3515a5bb44bd96eca1dc586403a25b16, fixed point fa00e57a43857bc2a70be077cbd858cf7cc495bb. No high, medium or low findings. Both axes reviewed directly under no-delegation role.
Standards: the single commented MERGE_OVERRIDE_PATHS constant follows Coordinator 6dbb6897's narrowed scope: .cland/tasks/**, exact .cland/RULES.md, docs/**, exact GLOSSARY.md, README.md basenames and qa/briefs/**. It does not broadly admit .cland configuration or arbitrary Markdown/skill paths. Typed MergeError includes code and every refused path.
Spec: scope check runs in squashTask's immutable-candidate callback before commit preparation/refs/checkout mutation, and repeats with existing validation before landing. Paths come from base-tip to merged candidate tree. --no-renames enumerates deleted sources and added destinations, so moving code into docs or docs into code cannot hide the disallowed side; standalone deletions also count. Normal reviewed merges remain unchanged. Existing authorization, conflict, dirty checkout, lane/freshness, compare-and-swap and recovery protections remain. Reconciliation of already landed receipts is not treated as new override work.
C3 verified: merge skill, hub README and CLI help state the narrowed allowlist, human-shell restriction, named refusal and unchanged conflict/Git safety.
C1/C2 test review: integration tests cover typed frame and CLI mixed code/config/skill refusal, all paths reported, refs unchanged, root code absent and task open; both rename directions and deletion; allowed docs/GLOSSARY/nested README/QA briefs and tracker/rulebook-only merges; prior permission test now uses a genuinely allowed README. All four new tests are below five seconds. A-3254 is whole-file 12/12, zero failure/cancel/skip. Source runtime criteria C1/C2 remain unverified until accepted exact-head post-source suite evidence.
Diff whitespace passes; requester reports typecheck green. No per-item QA required. Source clear permits the requested fresh exact-head verification within Coordinator throttle. No Reviewer tests, edits, merges or provider calls.

Criteria: C3 verified.
