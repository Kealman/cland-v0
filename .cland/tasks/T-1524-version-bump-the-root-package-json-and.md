---
id: T-1524
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.2"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
topic: null
branch: null
created: 2026-10-31T14:43:42.045Z
updated: 2026-10-31T14:43:42.045Z
---

## Summary

Move the root `package.json` and both lockfile version fields to 0.3.2 for the R-1523 release, as T-1496 did for 0.3.1.

## Acceptance criteria

- [ ] C1. The root `package.json` version and both version fields in `package-lock.json` read 0.3.2, `npm run typecheck` passes, and no other file changes.
