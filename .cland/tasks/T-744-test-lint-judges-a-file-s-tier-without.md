---
id: T-744
kind: task
title: Test lint judges a file's tier without following its fixture and helper imports
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-454
branch: t/T-744-test-lint-judges-a-file-s-tier-without
created: 2026-10-17T16:06:54.285Z
updated: 2026-10-17T17:31:05.230Z
---

## Summary

T-690's review (2026-10-17, review message ce02a5ed) found test files the lint qualifies as T1 or T2 whose imported fixtures use forbidden resources. Native fixtures open projectHub and socket peers, remote-fixture runs git and a socket hub, and suite fixtures spawn spokes and candidate workers. The lint reads only the test file itself, so its "qualifies" tier is lower than what the test really does. Once T-684 refuses on the lint, it would accept such files at the wrong tier.

## What to build

The lint resolves a test file's local imports (hub/test helpers and fixtures, transitively, within the repo) and charges the file with every resource used along the import graph, including in-process seams marked as allowed. Cache per module so a run stays fast.

## Acceptance criteria

- [ ] C1. Planted T1 tests importing a projectHub helper and a child-spawning helper each get a reachable-resource diagnostic naming the import path, a pure helper adds none, and the direct qualifies result and findings used by admission are unchanged, proved by lint tests.
- [ ] C2. The review request lists every dev file whose reachable tier differs from its direct qualification, names the harness-initialization-only subset separately, and shows npm run test:lint under 10 s on the Mac.

## Comments

### impl-744 · 2026-10-17T17:15:17.134Z

Merged origin/dev f0036591 before implementation. Read T-690 M1–M3. C1 is tested at the public lintTests seam using planted repo files (T1, filesystem only); resource source text is never executed. Whole-module graph analysis will conservatively charge every imported module resource, including unused helper exports; inert strings/comments and declaration-only type imports remain negative cases.
