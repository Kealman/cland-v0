---
id: T-936
kind: task
title: First cland setup can hit a Claude .claude.json lock timeout; a delayed rerun succeeds
state: open
status: in progress
size: S
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: topic-690
branch: t/T-936-first-cland-setup-can-hit-a-claude
created: 2026-10-20T05:13:34.457Z
updated: 2026-10-20T05:13:51.178Z
---

## Summary

E-613's DoD demo (qa-676, run qa-2026-10-20-2, release candidate 824105c5; evidence A-7031, report A-7033) ran `cland setup` in an isolated HOME with real Claude Code 2.1.304. The first run failed its Claude trust step on a `.claude.json` lock timeout; the holder was not identified. One rerun about 10 s later succeeded. Setup should not fail a newcomer's first run on a transient lock.

## What to build

Find what holds the `.claude.json` lock during setup's Claude step (setup's own earlier step, the probe, or Claude Code itself) from a reproduction in an isolated HOME. Then remove the self-contention, or retry the lock with a bounded backoff and a clear message naming the lock if it still times out.

## Acceptance criteria

- [ ] C1. The lock holder during the first setup run is named from a reproduction, or the evidence says why it cannot be reproduced.
- [ ] C2. Setup's Claude trust step survives a held `.claude.json` lock that is released within its retry window (a T2 test with a fake lock holder), and reports the lock path and holder when the window runs out.
- [ ] C3. A mode-free `cland verify` at the reviewed head is green.
