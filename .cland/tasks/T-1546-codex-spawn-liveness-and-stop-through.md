---
id: T-1546
kind: task
title: Codex spawn, liveness and stop through the Host
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: null
branch: null
created: 2026-10-31T23:47:41.385Z
updated: 2026-11-01T07:09:53.631Z
---

## Summary

Codex's app-server spawn, the `codex --version` check, the launch's cwd refusal, the pid checks, resume liveness and stop go through the session's Host. Sandbox roots follow in ticket 07, in the same file.

Hot files: `hub/src/adapters/codex.ts`

## Acceptance criteria

- [ ] C1. The app-server is started by the Host's spawn, detached, with the same arguments, environment (executor credentials stripped), working directory and log file as today (test).
- [ ] C2. The `--version` check runs through the Host's run in the session's cwd, and the cwd refusal through its statDirectory (test).
- [ ] C3. The adapter's poll, resume and stop use the Host's alive and stop, and the adapter's own `process.kill` probe is gone.
- [ ] C4. A test with a recording Host shows one spawn and one version check per launch, with every liveness check and stop of a Codex row reaching that Host (test).
- [ ] C5. The codex-adapter, codex-delivery, codex-native and codex-workspace-git test files pass with no test edited.
