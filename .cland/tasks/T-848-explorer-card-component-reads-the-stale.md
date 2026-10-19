---
id: T-848
kind: task
title: explorer-card-component reads the stale-evidence card before its row is under the cursor
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - flake
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-19T06:58:09.511Z
updated: 2026-10-19T06:58:09.511Z
---

## Summary

`nvim/test/explorer-card-component.test.ts` › "empty and stale card evidence stays explicit, and live suite states come from task summaries" failed once on a droplet, in T-843's run 8a94e492 at d2e38ce7 (A-5849, lines 44305–44307). Card T-10 expected "Old proof" but found no row under the cursor, and the test took 5.684 s against its 5 s bound. T-843 doesn't touch the explorer card. The case passed 5/5 alone on the Mac both on dev and at T-843's head. The test likely reads the card before its row is rendered.

## Acceptance criteria

- [ ] C1. The test waits on an observed frame where the card row is under the cursor before asserting, keeping every assertion, with a red-to-green proof that delays the card render.
- [ ] C2. The file passes 20 serial runs on the Mac and the mode-free task verify; its droplet repeat comes from the merge batch.
