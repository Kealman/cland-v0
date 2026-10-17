---
id: T-744
kind: task
title: Test lint judges a file's tier without following its fixture and helper imports
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: null
branch: t/T-744-test-lint-judges-a-file-s-tier-without
created: 2026-10-17T16:06:54.285Z
updated: 2026-10-17T17:12:46.352Z
---

## Summary

T-690's review (2026-10-17, review message ce02a5ed) found test files the lint qualifies as T1 or T2 whose imported fixtures use forbidden resources. Native fixtures open projectHub and socket peers, remote-fixture runs git and a socket hub, and suite fixtures spawn spokes and candidate workers. The lint reads only the test file itself, so its "qualifies" tier is lower than what the test really does. Once T-684 refuses on the lint, it would accept such files at the wrong tier.

## What to build

The lint resolves a test file's local imports (hub/test helpers and fixtures, transitively, within the repo) and charges the file with every resource used along the import graph, including in-process seams marked as allowed. Cache per module so a run stays fast.

## Acceptance criteria

- [ ] C1. A planted T1 test importing a helper that calls projectHub, and one importing a helper that spawns a child, each get the resource finding with the import path named; a helper that only exports pure functions adds none, proved by lint tests.
- [ ] C2. The review request lists every dev file whose qualification changes, and `npm run test:lint` stays under 10 s on the Mac.
