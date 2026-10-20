---
id: T-1031
kind: task
title: web-auth.test.ts needs a built web/dist when run standalone and fails with ENOENT
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-20T20:55:47.339Z
updated: 2026-10-20T20:55:47.339Z
---

## Summary

`node --test hub/test/web-auth.test.ts` run on its own fails with `ENOENT scandir <worktree>/web/dist/` when the web bundle has not been built: the test scans the built bundle for the hub secret but neither builds it nor says that a build is needed. Inside `cland verify` the pre-step builds web/dist first, so suites pass; a targeted run in a fresh worktree (E-412 stage QA, 2026-10-20) does not.

## Acceptance criteria

- [ ] C1. Run standalone in a worktree without web/dist, web-auth.test.ts either builds the bundle once through the shared web-build helper or fails with one clear line naming `npm run build --workspace web` (test).
