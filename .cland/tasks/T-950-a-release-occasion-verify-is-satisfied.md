---
id: T-950
kind: task
title: A release-occasion verify is satisfied from the cache of a local macOS stage run instead of running sharded on droplets
state: open
status: planned
size: S
labels:
  - needs-triage
assignee: null
parent: E-952
blocked_by: []
topic: null
branch: null
created: 2026-10-20T09:17:09.199Z
updated: 2026-10-20T09:41:43.857Z
---

## Summary

At release candidate 8 (7916d5f7) on 2026-10-20 ~09:16Z, `cland verify all --occasion release` returned at once as suite 7ffb2aa0, "cached from 2881edee" (A-7249). 2881edee was the local macOS stage run at the same tree. A release run is meant to be the sharded droplet release gate (E-617 C6, docs/agents/tests.md), so a cache hit from a local run of another occasion skips the Linux droplet evidence the gate exists for. The Coordinator forced a fresh run with `--fresh` (9bbe4fc1).

## Acceptance criteria

- [ ] C1. A release-occasion run reuses only a cached release (or same-executor, same-platform full) receipt at the same tree; a local macOS stage receipt never satisfies it. A T2 test with fake receipts covers both.
- [ ] C2. The cache notice names the original run's occasion and executor, so a mismatch is visible.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.
