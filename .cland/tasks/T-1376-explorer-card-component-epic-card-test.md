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
updated: 2026-10-27T18:02:39.553Z
---

## Summary

`nvim/test/explorer-card-component.test.ts::epic cards show stage progress, approval, subtree verdict and latest activity including a closed plan` failed once in T-1375's mode-free run 11f33f8b (Linux droplet, head db99ad06, log A-12854:18816) with `Lua: missing row T-10`. The test is unchanged and outside T-1375. Alone it passed 5/5 on dev 05a1c698 (macOS).

## What to build

After `zR` the test calls `select(c,'T-10')` at once; under load the expanded tree has not rendered T-10 yet. Wait for the T-10 row on screen (or in the explorer state) after `zR` before selecting, the way the earlier steps wait for 'The explorer', and check the other `zR`→`select` sites in the file for the same race (T-848 fixed a sibling).

## Acceptance criteria

- [ ] C1. Every `zR` followed by `select` in explorer-card-component waits for the target row before selecting.
- [ ] C2. The identity passes 10/10 under two workers plus owned CPU load.
