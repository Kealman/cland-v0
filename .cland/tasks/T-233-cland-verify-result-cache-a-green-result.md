---
id: T-233
kind: task
title: "cland verify result cache: a green result keyed by the candidate tree, reused for the same tree and accepted by the gate"
state: open
status: backlog
labels:
  - v0.1.1
  - ready-for-agent
assignee: null
parent: T-230
blocked_by:
  - T-232
topic: null
branch: null
created: 2026-10-11T17:48:35.341Z
updated: 2026-10-11T17:48:36.198Z
---

## What to build

A result cache for `cland verify`, keyed by the candidate tree (the git tree hash of the head being verified, plus the mode). A green result for a tree is reused when the same tree is requested again: a re-request after a tracker-only dev merge, or a rebase that reproduces the same tree. The merge gate accepts the cached result for that exact tree. Any change in the tree runs again. Cached results expire after a configurable age, and `--fresh` bypasses the cache.

## Acceptance criteria

- [ ] The same tree and mode return the cached green result without running, naming the original run; a different tree runs.
- [ ] The gate accepts a cached result only for the identical tree; T-209 head binding holds for the verified head.
- [ ] `--fresh` and expiry force a run.
- [ ] `npm run typecheck && npm test` pass.
