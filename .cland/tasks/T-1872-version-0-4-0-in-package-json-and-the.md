---
id: T-1872
kind: task
title: Version 0.4.0 in package.json and the lockfile
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1539
blocked_by: []
topic: null
branch: t/T-1872-version-0-4-0-in-package-json-and-the
created: 2026-11-15T13:08:09.766Z
updated: 2026-11-15T13:08:52.590Z
---

## Summary

The root `package.json` and both lockfile version fields move to 0.4.0, R-1530's recorded version, so that `cland release --item R-1530` accepts the release (E-1539 C6, the `release` skill).

## What to build

Set `"version": "0.4.0"` in the root `package.json`, and the matching root package version fields in `package-lock.json` (the top-level `version` and `packages[""].version`). Change nothing else: no dependency changes, and no `npm install` that rewrites the tree. Any other workspace package that carries the release version gets the same change only if the release tooling reads it. Check which in `hub/src/` release code and its tests, and follow the precedent of the v0.3.2 and v0.2.x bump items.

## Acceptance criteria

- [ ] C1. The root `package.json` and both root lockfile version fields read 0.4.0, the lockfile has no other diff, and the release tool's version check accepts 0.4.0 (test).
