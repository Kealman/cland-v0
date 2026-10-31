---
id: T-1540
kind: task
title: suite-tiers shipped-allowance owner test exceeds the 5 s T1 ceiling on a fresh droplet
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: R-1523
blocked_by: []
regression_of: T-1504
found_by: cover
topic: null
branch: null
created: 2026-10-31T21:31:33.760Z
updated: 2026-10-31T21:31:33.760Z
---

## Summary

T-1504's new T1 test `suite-tiers.test.ts::shipped allowances retain valid standing owners without manifest migration` ran 5.579 s against the enforced 5 s per-test ceiling on shard-2 of the 0.3.2 release cover ba2f405a (A-15079, a fresh occasion droplet). The shard stopped after T1, which left the cover red. In other runs the test took 0.97–2.31 s (11 samples). Make the test check owners without its current cost, most likely its read of the whole tracker or durations manifest, so it fits T1 comfortably on a cold droplet.

## Acceptance criteria

- [ ] C1. The item records what the test reads, and the change makes it resolve only the owners the shipped manifest names (or uses an equivalent bounded fixture), with the same assertion that every shipped allowance has a standing owner.
- [ ] C2. The test runs under 1 s on the item's mode-free droplet verify and in 10 local sequential runs, and no duration allowance is added for it.
