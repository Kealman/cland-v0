---
id: T-1841
kind: task
title: heartbeat-digest.test.ts hung 632 s with no output in a Linux T1 run and stalled a task verify
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-13T00:27:22.788Z
updated: 2026-11-13T00:27:22.788Z
---

## Summary

`hub/test/heartbeat-digest.test.ts` (T1, one test, fake clock, no sockets) hung for 632 s with no output in T-1827's mode-free verify `dafa1d1a` on a Linux droplet (A-19160, 2026-11-13 ~00:15Z), so the runner stopped the suite as stalled (exit 124) after 345 passing tests. The same file passes 5/5 alone on macOS in about 0.12 s each, and T-1827's change (a durations.json line) doesn't reach it.

## What to build

Find why the file can hang under the full T1 run on Linux (an unresolved timer or promise on the fake clock, an open handle, or a wait on a shared resource) and make it finish or fail within a named bound, so a stall never costs a 10-minute runner timeout.

## Acceptance criteria

- [ ] C1. The cause of the hang is reproduced or named from the A-19160 log and the file's code, and recorded on this item (test).
- [ ] C2. The file passes five lone repetitions and a full T1 run on Linux without a stall, and its only test is bounded by a named timeout well under the runner's no-output limit (test).
