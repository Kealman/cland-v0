---
id: T-1682
kind: task
title: Native session ownership on hosts so a held remote row can be proven closed without a host recycle
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-11-04T17:55:59.351Z
updated: 2026-11-04T17:55:59.351Z
---

## Summary

T-1678 keeps a remote Claude row held, with no signal and no settlement, when an unprovable orphan or a detached new-group descendant may still be writing. Observed absence of the old process group and the listed births can't prove closure (coord decision on T-1678, 2026-11-04 17:55Z). Such rows release only through a proven host recycle (changed boot, T-1613), host revoke settlement (T-1666), or a human override.

## What to build

A native ownership and closure capability on Linux hosts, for example one cgroup per session generation, or pidfd plus subreaper ownership in the agent. Every descendant of a session's root, detached or reparented ones included, then stays provably owned, and closure is a positive receipt ("the generation's cgroup is empty"). Held rows can then settle without a host recycle, and still without inferring authority from numeric ids.

## Acceptance criteria

- [ ] C1. A descendant that double-forks into a new session or process group remains attributed to its generation, and the generation's closure receipt is negative while it lives (test, Linux).
- [ ] C2. A held unknown-authority row settles on a positive empty-generation receipt, with no signal to unowned processes (test).
