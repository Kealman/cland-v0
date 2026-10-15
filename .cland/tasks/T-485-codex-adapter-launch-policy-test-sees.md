---
id: T-485
kind: task
title: codex-adapter launch-policy test sees the QA process alive right after an acknowledged session.stop (Linux)
state: open
status: backlog
size: XS
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T09:57:07.055Z
updated: 2026-10-15T09:57:07.055Z
---

## Summary

`hub/test/codex-adapter.test.ts:556` (the T-65 launch-policy test) asserted `pidAlive(qa.pid) === false` right after an acknowledged `session.stop`, and saw it still alive. This was in T-483's droplet gate 7033cc6c (A-2847) at a peak load of 12.3. The stop's acknowledgement precedes the process exit, so the test should wait for the exit (its exit event or a bounded pid poll) before asserting. If the product acknowledges a stop before the process is gone, check the stop's contract.

## Acceptance criteria

- [ ] C1. The test waits for the observed process exit after the acknowledged stop, keeps its assertion, and the file passes 5/5 beside a local full run and once on a droplet.
