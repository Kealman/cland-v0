---
id: T-49
kind: task
title: "cland CLI with a session identity: the hub refuses the human-only commands"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: impl-48
parent: T-19
blocked_by: []
topic: topic-7
branch: t/T-49-cli-session-identity
created: 2026-10-09T06:33:20.718Z
updated: 2026-10-09T07:12:11.476Z
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

## Comments

### impl-48 · 2026-10-09T07:12:11.476Z

Done on `t/T-49-cli-session-identity` (worktree `.cland/worktrees/T-49`), commit dac8c4f, on top of T-48's head 0b217d8. Not pushed.

What changed:
- `hub/src/cli/socket-client.ts`, `actor.ts`: every frame the CLI sends from a shell with `$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` carries the session as `as` (before, only `cland task` did). `cland hook`'s `session.signal` and `session.bridge` carry none.
- `hub/src/hub/dispatch.ts`: a client frame whose `as` is a session is audited as that session and decided: `session.launch` / `session.list` by the permission table; `hub.status`, `inbox.list`, `role.list` and `hub.stop` allowed; every other frame refused with the typed `forbidden` error (`permission` is the frame's type) and a notice in Agents.
- `hub/test/cli-identity.test.ts`: `cland topic answer` as a launched Implementer, as the asking Coordinator and as an unknown session id is refused, the ask stays open, the audit names the session; `role set`, `role clear`, `session stop`, `hub unmute` refused; `inbox` and `role list` allowed and audited as the session; `task view` and `task comment` work as the session, the comment's author is the session, another item's comment is refused; without the variables the same commands succeed as the human.
- Docs: `hub/README.md`, "The CLI in a session's shell"; `docs/review-and-qa.md` updated where it said those commands act as the human.

Tests: typecheck clean; hub 256 passed, Neovim 61 passed, 0 failed, 0 skipped.

Decisions to check:
- `cland hub stop` stays allowed from a session's shell, so the Coordinator can restart the hub after a merge; a session can signal the hub's process anyway.
- `cland session attach`, `stop`, `resume` and `retry` are refused for every session, the Coordinator included: the table knows only `session.launch`.
- The item names "`inbox dismiss`" and "`role revoke`": the CLI has neither. The frames `inbox.dismiss` and `role.clear` are refused.
- I did not run the two-reviewer `/code-review` pass on this change; the Reviewer's pass is its first independent read.
