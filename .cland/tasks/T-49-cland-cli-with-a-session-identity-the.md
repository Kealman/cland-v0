---
id: T-49
kind: task
title: "cland CLI with a session identity: the hub refuses the human-only commands"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T06:33:20.718Z
updated: 2026-10-09T06:33:20.718Z
---

## Parent

Part of T-19. Found by impl-48 while building T-48 (2026-10-09): once a sandboxed Codex session may reach the hub socket, its shell can run every `cland` command, including the ones only the human should run (`cland topic answer` answers a real ask as the human; `cland role set` moves a role), and the audit records them as `human` with client `cli`. Any process holding the socket can do the same today; the launched Claude Code sessions, unsandboxed in auto mode, always could.

## What to build

- T-48 passes `CLAND_SESSION_ID` and `CLAND_SESSION_NAME` to the Codex session's shell, as the Claude Code adapter does, so `cland task` acts as the session. Build on it: when the CLI carries a session identity, the hub treats the call as that session, with the session's role permissions: `topic answer`, `role set` / `role revoke`, `inbox dismiss` and the other human-only frames are refused with a typed error naming the session, and the audit records the session, not `human`.
- A CLI call with no session identity stays the human's, as today.
- `hub/README.md` says which commands are the human's and what a session's CLI call may do.

## Acceptance criteria

- [ ] A test in `hub/test/` runs `cland topic answer` with `CLAND_SESSION_ID`/`CLAND_SESSION_NAME` of a launched session against a real hub: refused with the typed error, the ask stays open, the audit names the session
- [ ] `cland task view` and `cland task comment` with the same identity work as the session (the comment's author is the session)
- [ ] Without the variables, every command behaves as before
- [ ] `hub/README.md` documents it
- [ ] `npm run typecheck && npm test` pass
