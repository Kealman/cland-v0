---
id: T-1582
kind: task
title: Merge batch load gate takes a T1-only batch as its T3 baseline and repeats every T3 test five times
state: open
status: planned
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-01T10:39:22.454Z
updated: 2026-11-16T07:31:10.921Z
---

## Summary

A merge batch's load gate repeats five times every T3 identity that is absent from its baseline. `hub/src/hub/suites.ts` `#stageIdentities('batch')` takes as baseline the latest green integrated stage run or merge batch, whichever is newer. After a T1-only batch, the baseline holds no T3 identities. So the first batch after the switch to T1–T3 (config e818d2dc, 2026-11-01 09:01Z) treated all 373 T3 files as new and repeated each one five times: batch a5980026 (T-1581 and T-1549), run 0422c993. It ran past the 75-minute run timeout and the 90-minute lifetime. The Coordinator raised both limits temporarily so this one batch can finish.

## Acceptance criteria

- [ ] C1. A batch's load-gate baseline is the latest green receipt that actually ran each tier the batch runs: for T3 identities, a T1-only batch never counts as their baseline, while a green stage cover or T3 batch does (test).
- [ ] C2. With a newer green T1-only batch and an older green stage cover, a T1–T3 batch repeats only the T3 identities absent from the stage cover (test).
- [ ] C3. The batch summary line names the baseline run per tier, and the number of identities it repeats.
