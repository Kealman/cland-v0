---
id: T-1376
kind: task
title: explorer-card-component epic card test selects T-10 before zR has rendered its row
state: open
status: backlog
size: XS
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-27T18:02:39.553Z
updated: 2026-10-27T18:47:28.525Z
---

## Summary

`nvim/test/explorer-card-component.test.ts::epic cards show stage progress, approval, subtree verdict and latest activity including a closed plan` failed once in T-1375's mode-free run 11f33f8b (Linux droplet, head db99ad06, log A-12854:18816) with `Lua: missing row T-10`. The test is unchanged and outside T-1375. Alone it passed 5/5 on dev 05a1c698 (macOS).

## What to build

After `zR` the test calls `select(c,'T-10')` at once; under load the expanded tree has not rendered T-10 yet. Wait for the T-10 row on screen (or in the explorer state) after `zR` before selecting, the way the earlier steps wait for 'The explorer', and check the other `zR`→`select` sites in the file for the same race (T-848 fixed a sibling).

## Acceptance criteria

- [ ] C1. Every `zR` followed by `select` in explorer-card-component waits for the target row before selecting.
- [ ] C2. The identity passes 10/10 under two workers plus owned CPU load.

## Comments

### coord · 2026-10-27T18:47:28.525Z

Reproduced on dev: the Linux droplet stage cover 111bc5a3 at 44b8310d (A-12860, shard-1 exit 1) failed on the same identity with the same `missing row T-10` signature. It is now a dev-red stage blocker for E-1310 stage 2 / E-1313 stage 1, beside the earlier T-1375 run 11f33f8b.
