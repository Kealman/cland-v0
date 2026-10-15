---
id: T-494
kind: task
title: "suite test: suite.cancel gets no result within 500 ms while a live compatibility holder's ps probe is held (Linux, under load)"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T13:04:30.452Z
updated: 2026-10-15T13:04:30.452Z
---

## Problem

`hub/test/suite.test.ts:1268` (harness.ts:449), 'admission stays responsive and bounds a held ps probe for a live compatibility holder', failed on Linux in T-465's droplet verify a3fe0258 at 6612ac3c (A-3001:3902–3907). There was no result for suite.cancel within 500 ms. T-465 doesn't touch suite.test.ts or the admission code. The run's peak 1-min load was 12.8 on a c-8, and suite.test.ts took 432 s against its 265 s baseline. A 500 ms response bound on a held ps probe looks too tight for that load, or the probe hold delays the cancel reply.

## Acceptance criteria

- [ ] C1. The case proves that admission stays responsive while the ps probe is held, using an observed boundary rather than a wall-clock 500 ms race. Alternatively, the product bound it checks is shown to be met under load and the test aligns with it. Every other assertion stays, and the root cause is recorded in the commit.
- [ ] C2. suite.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.
