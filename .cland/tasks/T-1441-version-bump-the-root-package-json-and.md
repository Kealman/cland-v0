---
id: T-1441
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.0"
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: null
branch: null
created: 2026-10-29T15:55:47.281Z
updated: 2026-10-29T15:55:47.281Z
---

## Summary

`cland release --item R-1278` refuses a version that differs from the project's, so the root `package.json` and both lockfile version fields move to 0.3.0 in an ordinary reviewed item before the dry run, as T-1185 did for 0.2.0.

## What to build

Set the root `package.json` version and the two version fields of `package-lock.json` to 0.3.0. Change nothing else, and add no dependency.

## Acceptance criteria

- [ ] C1. On the branch, the root `package.json` and both `package-lock.json` version fields read 0.3.0, and `npm run typecheck` passes.
- [ ] C2. The diff touches only those version fields.
