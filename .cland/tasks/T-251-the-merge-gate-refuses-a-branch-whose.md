---
id: T-251
kind: task
title: The merge gate refuses a branch whose hub test files aren't all classified in the shard manifest
state: open
status: in progress
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-251
parent: T-230
blocked_by: []
topic: topic-162
branch: t/T-251-the-merge-gate-refuses-a-branch-whose
created: 2026-10-12T00:05:36.212Z
updated: 2026-10-12T00:06:21.015Z
---

## What happened

Twice in one evening (2026-10-11), a merged item left dev with a hub test file missing from hub/test/shards.json: launch-recovery.test.ts from T-129, then termination-ownership.test.ts from T-102. Both branches predated T-215's manifest, so their own suites ran without the lint. After each merge, every full suite on dev exited at admission with "unclassified hub test" until branches added the line themselves. That cost several queue slots and needed a cross-branch coordination fix each time.

## What to build

Run the shard-manifest lint (hub/test/lint-shards.ts) on the merge candidate tree, meaning the branch merged onto dev, in `cland merge`'s preparation. Refuse with a named error that lists the unclassified files and the line to add. Run the same check in `cland verify` admission against the candidate tree, so the failure shows before the suite is queued.

## Acceptance criteria

- [ ] `cland merge` refuses a candidate whose merged tree has an unclassified hub test, naming each file and the line to add; a classified one merges as before.
- [ ] `cland verify` reports the same problem at submission, without taking a queue slot.
- [ ] Protocol tests cover both. `npm run typecheck && npm test` pass.

## Comments

### impl-251 · 2026-10-12T00:06:21.015Z

Claimed from dev fae0e78; worktree .cland/worktrees/T-251. Using existing merge.prepare / suite.run protocol seams specified by C1–C3, and reusing hubShards for lint. First isolated commit adds the exact shared termination-ownership manifest classification. QA policy is after-stage, so item requests review only.
