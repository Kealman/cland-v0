---
id: T-1317
kind: task
title: "Version bump: the root package.json and lockfile at 0.2.2"
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1277
blocked_by: []
topic: topic-1069
branch: t/T-1317-version-bump-the-root-package-json-and
created: 2026-10-26T00:03:10.910Z
updated: 2026-10-26T00:05:09.404Z
---

## Summary

R-1277 ships version 0.2.2 (the human's advance approval, 14:17Z 2026-10-25, recorded on R-1277). `cland release --item R-1277 --dry-run` would refuse because dev's package.json says 0.2.1. Bump the root package.json and package-lock.json from 0.2.1 to 0.2.2, the same way T-1272 did for 0.2.1 (179047f1).

## What to build

Set `version` to 0.2.2 in the root package.json and in the root entries of package-lock.json, and change nothing else in the lockfile. Leave web/package.json's own version alone, as T-1272 did.

## Acceptance criteria

- [x] C1. The root package.json and both root version entries in package-lock.json read 0.2.2, and `npm install --package-lock-only --ignore-scripts` leaves the lockfile unchanged (test).
  - done: impl-1317 · 2026-10-26T00:04:38.595Z

## Comments

### impl-1317 · 2026-10-26T00:03:50.985Z

Scope confirmed by Coordinator: exactly three version lines, following T-1272; no new test file. C1 evidence will be npm install --package-lock-only --ignore-scripts in a disposable sealed workspace, identical SHA-256 before/after, typecheck and later same-head mode-free verify. Cover-quiet currently prohibits local test files and verification. No shared reply/schema/policy contract changes or docs/help/skill/role behavior changes.

### rev-26 · 2026-10-26T00:05:09.404Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261026-1317-source-1
commit: cb3dff8065752ab5f07594199d4940f2859164ea
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source CLEAR; A-12201 at tree ce4730a0a836e287c47e7eb6c4ab6b400ba54dc9. Standards 0 / Spec 0 findings. Exactly package.json version and package-lock.json's two root versions change 0.2.1 to 0.2.2; no other lockfile edits, web/package.json unchanged. A-12200 reports local sealed npm lock-only install exit 0 with identical SHA-256 and typecheck exit 0; supplementary summary, not configured evidence. C1 claimant done retained; final runtime verification remains pending. Cover-quiet is active: submit the ordinary same-head mode-free verify only after Coordinator explicitly ends it, then request final evidence review. Preserve original local command outputs/exits/capture limits without transcription reruns. No new tests requested; reviewer performed reads only.
