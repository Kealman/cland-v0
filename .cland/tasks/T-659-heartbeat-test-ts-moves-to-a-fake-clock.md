---
id: T-659
kind: task
title: heartbeat.test.ts moves to a fake clock in one sweep
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - flaky
  - hub
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:29:56.765Z
updated: 2026-10-16T16:29:56.765Z
---

## Summary

heartbeat.test.ts collected five flake tickets in a row (T-506, T-508, T-514, T-530, T-568): each fixed one wall-clock wait and the next one broke (A-4004, recommendation 3). Move the whole file to an injected clock in one sweep, so no case depends on real elapsed time.

## What to build

The heartbeat scheduler takes an injectable clock and timer source, with the real one as the production default. heartbeat.test.ts drives digests, intervals, folding into busy turns and staleness by advancing the fake clock, and asserts on events, not elapsed milliseconds. Every existing assertion's meaning is kept.

## Acceptance criteria

- [ ] C1. Every heartbeat.test.ts case runs on the fake clock with no real-time sleep or elapsed-ms assertion left in the file, and an audit shows its test declarations and assertion meanings unchanged.
- [ ] C2. heartbeat.test.ts passes 20/20 serially on the Mac under the current crew load, and in the task's droplet verify.
