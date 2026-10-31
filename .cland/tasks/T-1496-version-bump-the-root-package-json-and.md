---
id: T-1496
kind: task
title: "Version bump: the root package.json and lockfile at 0.3.1"
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1259
branch: t/T-1496-version-bump-the-root-package-json-and
created: 2026-10-31T02:12:50.460Z
updated: 2026-10-31T02:14:40.565Z
---

## Summary

`cland release --item R-1465` refuses a version that differs from the project's, so the root `package.json` and both lockfile version fields move to 0.3.1 in an ordinary reviewed item before the dry run, as T-1441 did for 0.3.0. The version 0.3.1 is the human's choice (R-1465 notes).

## What to build

Set the root `package.json` version and the two version fields of `package-lock.json` to 0.3.1. Change nothing else, and add no dependency.

## Acceptance criteria

- [x] C1. On the branch, the root `package.json` and both `package-lock.json` version fields read 0.3.1, and `npm run typecheck` passes.
  - done: impl-1496 · 2026-10-31T02:14:16.332Z
- [x] C2. The diff touches only those version fields.
  - done: impl-1496 · 2026-10-31T02:14:16.477Z
  - verified: rev-26 [reviewer] · run rev-20261031-1496-source-1 · 2026-10-31T02:14:40.565Z · commit adf08125cf30dbd92f21fe4ba479f4fd707c2c40

## Comments

### impl-1496 · 2026-10-31T02:14:16.949Z

Committed/pushed adf08125cf30dbd92f21fe4ba479f4fd707c2c40. Requested typecheck and test:lint each ran once in isolated macOS arm64 clone, exit 0; known report-only lint findings retained. Only three version fields changed. Source review next.

### rev-26 · 2026-10-31T02:14:40.565Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261031-1496-source-1
commit: adf08125cf30dbd92f21fe4ba479f4fd707c2c40
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-14782: full source clear, no findings. Exactly root package.json version and two root lockfile versions0.3.0→0.3.1; all other bytes/dependency fields unchanged, independently checked by diff and JSON normalization. C2 verified; C1 version fields established, typecheck/runtime remains unverified pending original exact-head configured run. No Reviewer test/install/source mutation. Submit one mode-free verify at frozenadf08125c and request final original-record evidence review.

Criteria: C2 verified.
