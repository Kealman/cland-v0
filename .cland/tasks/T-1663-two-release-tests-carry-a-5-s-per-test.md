---
id: T-1663
kind: task
title: Two release tests carry a 5 s per-test timeout that macOS T3 load exceeds; they take 1.7–2.6 s alone
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-03T19:32:19.687Z
updated: 2026-11-03T19:32:19.687Z
---

## Summary

`hub/test/release.test.ts` "release checks the committed dev package version before preview or publication" (line 132) and "release permits a package without a version key" (line 165) declare `{ timeout: 5_000 }`. Both were cancelled at 5000 ms in two consecutive E-1532 stage-3 macOS covers at dev a1cd8943: 75684387 (A-16320, peak load 14.4) and 79115353 (A-16325, peak load 13.6). They pass on Linux (a0392ad0, A-16321). Run alone on the same Mac at load about 4 (coord, 2026-11-03 ~19:30Z), the file passes 22/22, these two at 2.616 s and 1.665 s. The per-test timeout leaves no headroom for the macOS T3 load, which peaks around 13–14 since today's host-agent landings; earlier covers peaked around 9. This blocks the E-1532 stage-3 cover pair.

## What to build

Give these two cases timeouts with headroom, matching the file's other release cases, or make them faster by removing what dominates their time. Record the measured time under load in the item. Don't add a duration allowance.

## Acceptance criteria

- [ ] C1. Both cases pass five load-gate repetitions locally on macOS under the package runner's alongside-phase load, with their measured times recorded, and their timeout leaves at least 2× headroom over the slowest repetition (test).
