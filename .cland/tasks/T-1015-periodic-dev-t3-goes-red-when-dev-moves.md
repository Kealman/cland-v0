---
id: T-1015
kind: task
title: Periodic dev T3 goes red when dev moves while it bundles the root
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: null
branch: null
created: 2026-10-20T17:26:44.017Z
updated: 2026-10-24T06:46:50.310Z
---

## Summary

The periodic dev T3 run 90717a88 (2026-10-20 17:20Z, head 7052b616) went red with "dirty or changed worktree cannot be bundled for droplet: HEAD changed": a tracker commit moved root `dev` while the run was bundling the root for the droplet. No test ran, yet the run reports red, a culprit search starts and comes back inconclusive, and General gets a red notice.

## What to build

The periodic dev T3 bundles the commit it was started for (from the object store or a detached snapshot), not the live root checkout, so later dev commits (tracker or code) cannot invalidate it. A run that cannot bundle is reported as infrastructure (not red) and is retried, with no culprit search.

## Acceptance criteria

- [ ] C1. A periodic dev T3 started at commit X still bundles X when root dev moves during bundling (test).
- [ ] C2. A bundling failure is reported as an infrastructure outcome, not red, starts no culprit search and is retried at the next eligible tip (test).

## Comments

### coord · 2026-10-22T23:37:32.848Z

Recurred 2026-10-22 23:36Z: periodic dev T3 a373df37 (A-9548) at a5ec440d reported "Periodic dev T3 red" with exit 1 "dirty or changed worktree cannot be bundled for droplet: HEAD changed", because T-1139 landed (adde2c7c) while it bundled. No test ran, and the culprit search came back inconclusive with no failing files. It still posts a red headline in General for an infrastructure race.
