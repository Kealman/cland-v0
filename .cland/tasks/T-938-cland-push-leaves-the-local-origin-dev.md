---
id: T-938
kind: task
title: cland push leaves the local origin/dev tracking ref stale
state: open
status: in progress
size: XS
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: t/T-938-cland-push-leaves-the-local-origin-dev
created: 2026-10-20T05:13:34.736Z
updated: 2026-10-20T05:13:45.812Z
---

## Summary

E-616's DoD demo (qa-2, run qa-2026-10-20-qa2-2; A-7030/A-7032) found that after `cland push` publishes dev to the territory (`origin`), the root's `refs/remotes/origin/dev` still shows the old commit until the next fetch. Tools that compare dev with origin/dev (merge-tree checks, QA gates) then read a stale base.

## Acceptance criteria

- [ ] C1. After a successful `cland push`, `git rev-parse origin/dev` in the root equals the pushed commit (a T2 test on a fixture territory).
- [ ] C2. A mode-free `cland verify` at the reviewed head is green.
