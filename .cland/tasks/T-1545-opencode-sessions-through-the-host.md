---
id: T-1545
kind: task
title: OpenCode sessions through the Host
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: null
branch: null
created: 2026-10-31T23:47:41.079Z
updated: 2026-11-01T07:09:53.204Z
---

## Summary

OpenCode's `opencode serve` spawn, its pid checks, its liveness on resume and its stop go through the session's Host, with launch, delivery and stop behaviour unchanged.

Hot files: `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`

## Acceptance criteria

- [ ] C1. `opencode serve` is started by the Host's spawn with the same arguments, environment, working directory and log file as today (test).
- [ ] C2. The adapter's poll, resume and stop use the Host's alive and stop for the row, and the adapter's own `process.kill` probe is gone.
- [ ] C3. A test with a recording Host shows one spawn per launch, with every liveness check and stop of an OpenCode row reaching that Host (test).
- [ ] C4. The opencode-adapter, opencode-native and opencode-launch-policy test files pass with no test edited.
