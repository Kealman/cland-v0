---
id: T-1441
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.0"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1314
blocked_by: []
topic: topic-1183
branch: t/T-1441-version-bump-the-root-package-json-and
created: 2026-10-29T15:55:47.281Z
updated: 2026-10-29T15:57:11.674Z
---

## Summary

`cland release --item R-1278` refuses a version that differs from the project's, so the root `package.json` and both lockfile version fields move to 0.3.0 in an ordinary reviewed item before the dry run, as T-1185 did for 0.2.0.

## What to build

Set the root `package.json` version and the two version fields of `package-lock.json` to 0.3.0. Change nothing else, and add no dependency.

## Acceptance criteria

- [x] C1. On the branch, the root `package.json` and both `package-lock.json` version fields read 0.3.0, and `npm run typecheck` passes.
  - done: impl-1441 · 2026-10-29T15:57:10.550Z
- [x] C2. The diff touches only those version fields.
  - done: impl-1441 · 2026-10-29T15:57:11.215Z

## Comments

### impl-1441 · 2026-10-29T15:57:11.460Z

Implemented at e33eaffa6c1a01f6394cdd63874c9c1d6c25905e and pushed to origin. Local macOS npm run typecheck passed; diff/check confirms only the three requested root version fields. No new tests warranted for the metadata-only scope; no test-marked criteria. Source review next, then mode-free verification.
