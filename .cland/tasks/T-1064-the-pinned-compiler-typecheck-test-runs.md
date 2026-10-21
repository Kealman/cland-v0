---
id: T-1064
kind: task
title: The pinned-compiler typecheck test runs 11–15 s on Linux against its 10 s T3 budget
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-880
blocked_by: []
topic: null
branch: null
created: 2026-10-21T15:08:40.931Z
updated: 2026-10-21T15:08:40.931Z
---

## Summary

`hub/test/typecheck.test.ts::typecheck resolves pinned compilers in roots and linked worktrees` runs over its 10 s T3 test budget on Linux droplets. It measured 15.267 s (E-412 epic suite c5e57fb0, A-8429), 12.747 s (fb839f15, A-8437) and 11.467 s (68c57731, A-8510). Its baseline is 2.406 s. The gate is report-only today, so it passes silently.

## Acceptance criteria

- [ ] C1. A targeted Linux droplet run at the task head reports the test at or under 10 s, or the test carries a dated allowance with an owner and a measured reason.
- [ ] C2. The test still proves pinned compiler resolution in a root and in a linked worktree; no assertion is dropped to win time.
