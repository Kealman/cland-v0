---
id: T-1841
kind: task
title: heartbeat-digest.test.ts hung 632 s with no output in a Linux T1 run and stalled a task verify
state: open
status: in progress
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1881
blocked_by:
  - T-1796
topic: topic-1546
branch: t/T-1841-heartbeat-digest-test-ts-hung-632-s-with
created: 2026-11-13T00:27:22.788Z
updated: 2026-11-16T09:53:53.224Z
---

## Summary

`hub/test/heartbeat-digest.test.ts` (T1, one test, fake clock, no sockets) hung for 632 s with no output in T-1827's mode-free verify `dafa1d1a` on a Linux droplet (A-19160, 2026-11-13 ~00:15Z), so the runner stopped the suite as stalled (exit 124) after 345 passing tests. The same file passes 5/5 alone on macOS in about 0.12 s each, and T-1827's change (a durations.json line) doesn't reach it.

## What to build

Find why the file can hang under the full T1 run on Linux (an unresolved timer or promise on the fake clock, an open handle, or a wait on a shared resource) and make it finish or fail within a named bound, so a stall never costs a 10-minute runner timeout.

## Acceptance criteria

- [ ] C1. The hang is located from the A-19160 log and the file's code (the file started but its only test never did, so test-process startup or import), and the item records what the log cannot settle (test).
- [ ] C2. A test file that starts but begins no test within a named bound, well under the runner's no-output limit, fails at once with the runner's stall evidence from T-1796, not after the 10-minute stall guard (test, red before the fix); heartbeat-digest.test.ts passes five lone Linux repetitions (evidence).

## Comments

### impl-1841 · 2026-11-16T09:53:53.224Z

C1 finding from A-19160 (Linux x64, Node24.21, droplet, bac216bee8662af959eec209800682884f45a508): final events are file-start for heartbeat-digest.test.ts, followed by `in flight: hub/test/heartbeat-digest.test.ts :: /home/runner/cland/hub/test/heartbeat-digest.test.ts (running 632 s)`. There is no start event for its only test. This localizes the stall to test-process startup/import, before the synchronous test body. The body uses an in-memory Store, FakeClock.now/block, and synchronous digest/assertions; it creates no timer, promise, socket or shared resource. The runtime import graph has no top-level await or initiated async work. No fake-clock defect was found. The historical log lacks PID/native-exit/pipe receipts, so it cannot distinguish native spawn/bootstrap/import blockage or establish the exact native cause. Per Coordinator decision 69815e1a, T-1841 will add a runner first-test-start bound after T-1796's diagnostics land; no test-local async import workaround.
