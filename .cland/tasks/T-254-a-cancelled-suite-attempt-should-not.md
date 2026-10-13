---
id: T-254
kind: task
title: A cancelled suite attempt should not supersede green cache evidence for
  its tree
state: open
status: backlog
labels:
  - hub
assignee: null
parent: E-273
blocked_by: []
topic: null
branch: null
created: 2026-10-12T01:42:45.744Z
updated: 2026-10-12T11:35:23.911Z
---

## Parent

Found by qa-22 during the T-230 epic QA demo (topic-165, 2026-10-12 01:42Z), M7(a). Refines T-233.

## What happened

`#cached` in hub/src/hub/suites.ts takes the newest fresh attempt for a tree and mode, and that attempt alone decides the cache. A suite cancelled because its requester died (T-212) therefore supersedes an earlier green result for the identical tree, and the next verification runs the full suite again. This fails safe: nothing wrongly reuses. But a cancellation says nothing about the tree, and a needless rerun costs a full suite slot on a budget-1 queue.

## What to build

A cancelled attempt (by its requester, by requester death, or by a head change before admission) no longer supersedes green evidence for its tree. A failed attempt (a test failure, a worker crash or a timeout) still does.

## Acceptance criteria

- [ ] Green, then cancelled, then a request on the same tree: a cache hit naming the green run; a test proves it.
- [ ] Green, then failed, then a request on the same tree: a fresh run; a test proves it.
- [ ] hub/README.md's cache paragraph states the rule.
