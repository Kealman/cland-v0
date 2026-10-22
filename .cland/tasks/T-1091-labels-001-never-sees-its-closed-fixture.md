---
id: T-1091
kind: task
title: LABELS-001 never sees its closed fixture question under the stdio hub after T-1089
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
regression_of: T-1089
topic: topic-829
branch: t/T-1091-labels-001-never-sees-its-closed-fixture
created: 2026-10-22T02:34:06.693Z
updated: 2026-10-22T02:35:15.729Z
---

## Summary

The E-413 "fields" Linux stage cover 07c4c00a (A-8860, dev c6ee6406, T3 shard-1) fails `nvim/test/qa.test.ts` "fixture values YAML would read as structure reach the client whole, the same under the stdio hub and the stub hub": LABELS-001 under `--hub stdio` ends INCONCLUSIVE with "wait_for timed out after 10000 ms: the two fixture items". The fixture's second item is Q-2, a closed question under the open task T-1. Since T-1089 the real hub's first payload carries closed items of every kind only through parent pages, so the case never sees Q-2. The stub hub path passed earlier at the T-1089 head; the stdio path runs only in T3.

## Acceptance criteria

- [ ] C1. LABELS-001 passes under both `--hub stdio` and `--hub stub` at the task head, with Q-2's fields (closed, parent T-1, blocked_by T-1, labels) still asserted in full; the case reaches Q-2 the way the client now does (its parent page or the item view), not by restoring closed items to the first payload (test).
- [ ] C2. Every other QA case and Neovim T3 test that reads a closed item from the first payload is listed in the item topic, as checked or fixed, from a search of qa/cases and nvim/test (doc).
