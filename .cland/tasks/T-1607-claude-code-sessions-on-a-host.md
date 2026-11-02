---
id: T-1607
kind: task
title: Claude Code sessions on a host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1600
  - T-1601
  - T-1556
topic: null
branch: null
created: 2026-11-02T03:33:57.061Z
updated: 2026-11-02T03:33:57.061Z
---

## Summary

A Claude Code session on a fake host runs `claude --bg` through the agent, with its `mcp.json` and `settings.json` on the host. It finds its worker with one `claude agents --json` (T-1556), adopts the worker into the agent's table, and reports state through hooks and the mod bridge on the host. These reach the hub through the forwarded `hub.sock` with the host's secret and the session's credential.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/host/agent/processes.ts` (adopt), `hub/test/claude-code-remote.test.ts` (new)

## Acceptance criteria

- [ ] C1. Through the frame protocol a Claude Code session launched on a fake host with the scripted Claude fake receives a delivery and reports its state from its hooks (test).
- [ ] C2. The worker found by the one `agents --json` is adopted into the host agent's table with its Linux identity, and liveness and stop go through the agent (test).
- [ ] C3. The session's hooks and mod bridge connect through the host's `hub.sock` and are dispatched as that session, and their settings carry host paths only (test).
- [ ] C4. Over several poll intervals no short-lived `claude` command runs on the host for the running row (test).
- [ ] C5. The claude-code-adapter, claude-code-sessions and claude-code-schedule test files pass with no test edited.

## Notes

Shared files: `hub/src/adapters/claude-code.ts`
