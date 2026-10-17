---
id: T-727
kind: task
title: claude-code-adapter scheduler and latch negatives move onto the adapter Clock
state: open
status: planned
size: S
labels:
  - v0.1.4
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-696
topic: null
branch: null
created: 2026-10-17T07:27:42.323Z
updated: 2026-10-17T07:27:56.534Z
---

## Summary

T-691 (9a158f83) turned claude-code-adapter.test.ts into Claude Code's contract file. Its scheduler and signed-out-latch negatives (about 10 waits) stayed in their old wall-clock form, because they need the ClaudeCodeAdapter Clock seam that T-696 adds. This ticket converts them once T-696 lands.

## What to build

The scheduler and latch negatives in claude-code-adapter.test.ts drive the production ClaudeCodeAdapter with the hub FakeClock (T-685) through T-696's adapter Clock parameter, with the execFile boundary replaced and no binary. They wait on observed boundaries, never by pumping fake time. Native transport deadlines stay real.

## Acceptance criteria

- [ ] C1. Every scheduler and latch negative in claude-code-adapter.test.ts runs on the FakeClock with no real-time sleep left, with assertions unchanged in meaning, shown in an audit.
- [ ] C2. claude-code-adapter.test.ts passes 5/5 serially on the Mac and in the task's droplet verify, with its seconds before and after recorded.
