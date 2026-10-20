---
id: T-1015
kind: task
title: Periodic dev T3 goes red when dev moves while it bundles the root
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:26:44.017Z
updated: 2026-10-20T17:26:44.017Z
---

## Summary

The periodic dev T3 run 90717a88 (2026-10-20 17:20Z, head 7052b616) went red with "dirty or changed worktree cannot be bundled for droplet: HEAD changed": a tracker commit moved root `dev` while the run was bundling the root for the droplet. No test ran, yet the run reports red, a culprit search starts and comes back inconclusive, and General gets a red notice.

## What to build

The periodic dev T3 bundles the commit it was started for (from the object store or a detached snapshot), not the live root checkout, so later dev commits (tracker or code) cannot invalidate it. A run that cannot bundle is reported as infrastructure (not red) and is retried, with no culprit search.

## Acceptance criteria

- [ ] C1. A periodic dev T3 started at commit X still bundles X when root dev moves during bundling (test).
- [ ] C2. A bundling failure is reported as an infrastructure outcome, not red, starts no culprit search and is retried at the next eligible tip (test).
