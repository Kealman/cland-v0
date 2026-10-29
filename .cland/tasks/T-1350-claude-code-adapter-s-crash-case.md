---
id: T-1350
kind: task
title: claude-code-adapter's crash case advances its injected clock once and can miss a late OS exit
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-26T22:36:48.083Z
updated: 2026-10-29T15:59:34.447Z
---

## Summary

hub/test/claude-code-adapter.test.ts::"a crashed Claude Code process: the state turns unknown and the hub logs it once; launched again under its name, it works" intermittently fails with "the process gone: not within 15000 ms". It hit T-1341's rule 6 run 09c84a9b (A-12503, Linux) and older logs (A-1151, A-1544, A-1551). It passed 5/5 alone. The test advances its injected clock by 150 ms once, right after `killDaemon`. If the OS exit is observed later than that, under load, the hub's watcher never ticks again on the frozen clock, and the wait times out.

## What to build

Make the wait drive the injected clock. Inside the `eventually` that waits for the exited row, advance the clock by the watcher tick plus the grace on each attempt, or wait for the native exit receipt before advancing. No product change, and the assertions stay unchanged.

## Acceptance criteria

- [ ] C1. The named case advances its clock until the exited row appears, without depending on the OS exit landing before a single advance, and passes 10/10 sequential runs plus its load-gate repetitions (test).
