---
id: T-26
kind: task
title: Codex adapter
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-24
topic: null
branch: null
created: 2026-10-08T11:54:00Z
updated: 2026-10-08T13:17:15.601Z
github:
  repo: Kealman/cland-v0
  number: 26
  url: https://github.com/Kealman/cland-v0/issues/26
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12; research `docs/research/harness-surfaces.md` (Codex app-server, `thread/status/changed`, `resume --remote`, the embedded-mode trap) and `docs/research/bcas-hub.md` (the BCAS Codex supervisor, reusable).

## What to build

The Codex adapter on the contract established by the Claude Code adapter: spawn starts a Codex app-server on a per-session Unix socket with the spoke's MCP configuration passed to the app-server (never to the TUI process), starts a thread with the requested model, and runs a first turn that delivers the session's clause (a placeholder until roles exist) so that attach works; attach is `codex resume --remote` on that socket and thread; inject uses `turn/start` with a tool output when idle and `turn/steer` during an active turn, confirming `injected` from the result; state comes from `thread/status/changed` (`idle`, `active`, `waitingOnApproval`, `waitingOnUserInput`) keyed by thread id, declared `reliable`; usage from token events and the rate-limit call. Approvals are left to the attached TUI; the hub only shows `waiting for approval`. The BCAS supervisor's durable inbox and wake-up pattern are reused where they fit.

## Acceptance criteria

- [ ] A Codex session spawned from the hub appears in the registry with its state; a message to it from General is `injected` and its reply comes back
- [ ] `attach_command` opens the real Codex TUI on the hub-owned thread; a Neovim restart leaves the thread running
- [ ] No `-c` override or `--profile` is ever passed to the Codex TUI process
- [ ] State transitions `idle` → `active` → `waiting for approval` → `idle` are observed from the app-server, not inferred
- [ ] Tests run against a fake Codex app-server speaking JSON-RPC on a Unix socket; one manual smoke run against the real harness is recorded
