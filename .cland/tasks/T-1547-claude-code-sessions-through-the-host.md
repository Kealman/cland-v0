---
id: T-1547
kind: task
title: Claude Code sessions through the Host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1544
topic: null
branch: null
created: 2026-10-31T23:47:41.550Z
updated: 2026-10-31T23:47:45.212Z
---

## Summary

Claude Code's `claude --bg` launch, its `claude agents --json` and `claude stop` commands, the read of the worktree's `.claude` settings, its pid and identity checks and its stop go through the session's Host. The schedule of `agents --json` stays as it is; ticket 15 changes it for rows on another host.

Hot files: `hub/src/adapters/claude-code.ts`

## Acceptance criteria

- [ ] C1. `claude --bg`, `claude agents --json` and `claude stop` run through the Host's run with the same arguments, environment and working directory as today (test).
- [ ] C2. The session cwd's `.claude` settings files are read through the Host's readFile (test).
- [ ] C3. Pid checks, birth identities, resume liveness and stop of a Claude Code row use the Host's identity, alive and stop, and the adapter's own `process.kill` probe is gone.
- [ ] C4. A test with a recording Host shows every command, liveness check and stop of a Claude Code row reaching that Host (test).
- [ ] C5. The claude-code-adapter, claude-code-sessions, claude-code-schedule, claude-code-accounts and claude-code-environment test files pass with no test edited.
