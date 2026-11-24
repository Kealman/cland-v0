---
id: T-2068
kind: task
title: Bump the project version to 0.4.1 for the v0.4.1 release
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1880
blocked_by: []
topic: null
branch: t/T-2068-bump-the-project-version-to-0-4-1-for
created: 2026-11-24T02:43:23.822Z
updated: 2026-11-24T02:43:40.568Z
---

## Summary

R-1880 ships as 0.4.1 (the human's decision on ask b17eb4ec). `cland release --dry-run` refuses until the root package.json matches the item version, so the version bump is an ordinary item merged before the release, as T-967 did for 0.1.5.

## What to build

Set the version to 0.4.1 everywhere 0.4.0 is recorded as the project version. That means the root package.json and package-lock.json, plus any other file the 0.4.0 bump touched. Find that bump with `git log --oneline --grep "0.4.0"`, then `git show --stat` it. No behaviour changes.

## Acceptance criteria

- [ ] C1. `node hub/bin/cland.ts --version` prints 0.4.1, and every file the 0.4.0 bump changed now says 0.4.1; `npm run typecheck` is green.
