---
id: T-1453
kind: task
title: cland verify runs the tier lint and T3 header check locally before submitting
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:56.925Z
updated: 2026-10-30T05:44:56.925Z
---

## Summary

Before admission, `cland verify` runs `npm run test:tiers` and the T3 lifecycle header check in the caller's worktree and names the cause (stale duration keys after a rename, unsorted tier rows, imports above or a missing `T3:` header), so a refusal costs seconds instead of a review round. On 2026-10-29 five submissions were refused this way (T-1445, T-410, T-1436, T-1082, T-1373). Rule batch 4 C1 (A-14151).

## Acceptance criteria

- [ ] C1. The local check reports each refusal class the hub's admission reports, with file and line, before any queue entry.
