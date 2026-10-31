---
id: T-1557
kind: task
title: The adapters' boundary lint
state: open
status: backlog
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
  - T-1545
  - T-1547
  - T-1548
topic: null
branch: null
created: 2026-10-31T23:47:43.954Z
updated: 2026-10-31T23:47:49.548Z
---

## Summary

A T1 lint keeps the adapters behind the Host. It fails when the sessions layer or an adapter spawns, kills, stats or realpaths a session's process or directory directly.

Hot files: `hub/test/host-boundary.test.ts` (new)

## Acceptance criteria

- [ ] C1. The test fails when `sessions.ts`, `claude-code.ts`, `codex.ts`, `opencode.ts`, `opencode/server.ts` or `launch-files.ts` makes a value import from `node:child_process`, calls `process.kill` other than at the `CLAND_TEST_CRASH_AT` self-kills, or imports `pidAlive`, `processAlive`, `sameProcess`, `endProcess`, `processIdentityAsync`, `systemProcesses` or `sessionCwdRefusal` (test).
- [ ] C2. The test fails when `sessions.ts`, `claude-code.ts`, `codex.ts` or `opencode.ts` imports `stat`, `lstat` or `realpath` from `node:fs` or `node:fs/promises` (test).
- [ ] C3. The lint passes on the head, and fixture sources with one forbidden use of each kind make it fail, naming the file and the use (test).
