---
id: T-849
kind: task
title: "accounts: a retained Reviewer pool reuses the old member after a same-size roles.toml rewrite (Linux batch run)"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-19T07:31:31.466Z
updated: 2026-10-19T07:31:31.466Z
---

## Summary

`hub/test/accounts.test.ts` 'a retained Reviewer pool reuses only the same account and keeps its original directory' failed once on Linux, in merge batch e1ed96eb (run 892bfedf, A-5860, tree a43a190c, droplet c-8 lon1, peak load 6.96). The assertion at accounts.test.ts:197 (`next.sessionId !== p.sessionId`) failed: the launch after rewriting `.cland/roles.toml` from account codex-b to codex-a reused the old pool member, so the hub had not yet seen the new roles file.

## Problem

The batch members (T-664, T-663, T-669) do not touch account or pool code; T-664 only adds keys to the applied list in configuration.ts. The test rewrites roles.toml with a same-size body (`codex-b` → `codex-a`) and launches immediately. Change detection in `ProjectConfiguration.fresh()` compares a `dev:ino:size:mtimeMs:ctimeMs` stamp. With the size unchanged, the change rests on mtime/ctime alone, and the coarse kernel timestamp granularity or a reload racing the non-atomic writeFile may leave the launch on the old roles. Whether the product misses a real edit or only the test races is to be established.

## Acceptance criteria

- [ ] C1. The root cause is established and recorded in the commit: either a product defect in roles.toml change detection (fixed, with a regression test that fails without the fix) or a test race (the test waits on an observed reload boundary instead of timing). Every existing assertion stays.
- [ ] C2. accounts.test.ts passes 20/20 serially on the Mac, whole file and alone, and the mode-free task verify passes at the reviewed head.
