---
id: T-1872
kind: task
title: Version 0.4.0 in package.json and the lockfile
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by: []
topic: topic-1525
branch: t/T-1872-version-0-4-0-in-package-json-and-the
created: 2026-11-15T13:08:09.766Z
updated: 2026-11-15T13:12:57.359Z
---

## Summary

The root `package.json` and both lockfile version fields move to 0.4.0, R-1530's recorded version, so that `cland release --item R-1530` accepts the release (E-1539 C6, the `release` skill).

## What to build

Set `"version": "0.4.0"` in the root `package.json`, and the matching root package version fields in `package-lock.json` (the top-level `version` and `packages[""].version`). Change nothing else: no dependency changes, and no `npm install` that rewrites the tree. Any other workspace package that carries the release version gets the same change only if the release tooling reads it. Check which in `hub/src/` release code and its tests, and follow the precedent of the v0.3.2 and v0.2.x bump items.

## Acceptance criteria

- [x] C1. The root `package.json` and both root lockfile version fields read 0.4.0, the lockfile has no other diff, and the release tool's version check accepts 0.4.0 (test).
  - done: impl-1872 · 2026-11-15T13:11:06.920Z

## Comments

### impl-1872 · 2026-11-15T13:11:32.480Z

C1 done: exactly three version replacements in two files; acceptance test A-19671 failed red on production release-version 0.3.2 versus v0.4.0, then passed green after edits with fake Git and copied manifests on macOS Node24.21.0. Release reads only root package.json; existing release.test.ts committed-dev-version and release-item.test.ts mismatch regressions inspected. Precedents T-1524/T-1317 read. No installer/dependency/native Git test/network/SQLite/browser. origin/dev merged once before first source review; head 65b0c6869ea9406ee6a72cfddc5f2c257ae0f863 pushed. Configured verification follows source review.

### rev-35 · 2026-11-15T13:12:57.359Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1872-source-1
commit: 65b0c6869ea9406ee6a72cfddc5f2c257ae0f863
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-19673. Exactly three root version replacements across package.json/package-lock.json; independent parsed comparison confirms no other semantic diff. Release's committed-dev root package check and item version owner inspected; neither hub/web workspace carries a version or supplies one to release validation. Existing native release regressions unchanged/unexecuted in this review. A-19671 supplemental production-releaseGit fake-boundary test inspected; A-19672 is narrative red/green evidence, not retained raw producer/native completion logs. C1 final verification pending exact-head mode-free configured result; source clearance releases hold, not release/publication authority. No QA criteria, no Reviewer runtime/install/release command.
