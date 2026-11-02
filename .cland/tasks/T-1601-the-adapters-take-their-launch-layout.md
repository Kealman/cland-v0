---
id: T-1601
kind: task
title: The adapters take their launch layout and files from the session's Host
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1587
  - T-1556
topic: null
branch: null
created: 2026-11-02T03:33:55.630Z
updated: 2026-11-02T03:33:55.630Z
---

## Summary

Each adapter takes its session run directory, log directory, discovery file, node, CLI and spoke entries from the launch's Host layout instead of the hub's. It writes Claude Code's `mcp.json` and `settings.json`, Codex's socket directory and log, and OpenCode's config, password and log through `LaunchFiles` on that Host, and reserves OpenCode's port with the Host's freePort. On the `local` host every path and file is as today.

Hot files: `hub/src/adapters/claude-code.ts`, `hub/src/adapters/codex.ts`, `hub/src/adapters/opencode.ts`, `hub/src/adapters/opencode/server.ts`, `hub/src/adapters/contract.ts`, `hub/src/adapters/sessions.ts`, `hub/test/host-boundary.test.ts`

## Acceptance criteria

- [ ] C1. With a recording Host whose layout maps into another tree, each harness's launch writes every session-side file, and names every path in its argv and environment, from that layout (test).
- [ ] C2. On the `local` host the argv, environment, file paths, modes and contents of a launch of each harness are byte-identical to today's (test).
- [ ] C3. OpenCode's port comes from the launch Host's freePort and its password is read through that Host (test).
- [ ] C4. The boundary lint also fails when an adapter or `opencode/server.ts` imports `writeFile`, `mkdir`, `rm` or `chmod` from `node:fs` or `node:fs/promises` for a session-side path (test).
- [ ] C5. The claude-code-adapter, codex-adapter, opencode-adapter, opencode-native and launch-files test files pass with no test edited.

## Notes

Shared files: `claude-code.ts` (T-1556 first, then 21 and 25), `codex.ts` (20, 25), `opencode.ts` and `opencode/server.ts` (17, 25), `contract.ts`, `sessions.ts` (T-1586 also edits it)
