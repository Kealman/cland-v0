---
id: T-24
kind: task
title: "Claude Code adapter: spawn, attach, inject and state"
state: open
labels:
  - ready-for-agent
  - slice-1
assignee: null
parent: T-19
blocked_by:
  - T-23
topic: null
branch: null
created: 2026-10-08T11:53:43Z
updated: 2026-10-08T13:17:15.601Z
github:
  repo: Kealman/cland-v0
  number: 24
  url: https://github.com/Kealman/cland-v0/issues/24
---

## Parent

Part of #19. Spec section 4.3; decision https://github.com/Kealman/cland-v0/issues/12 (contract and v0 mapping); research `docs/research/harness-surfaces.md` on branch `research/harness-surfaces` (Claude Code section: `--bg`, `attach`, hooks, mods, `claude agents --json`).

## What to build

The first adapter and, with it, the adapter contract inside the hub: `spawn(name, role, model, cwd)`, `attach_command(session)`, `inject(session, message)` confirming the `injected` stage, a normalised `state` stream (`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown`), `stop`, `resume`, and a capability table with per-signal reliability. For Claude Code: spawn runs the harness in background mode with the spoke's MCP configuration injected at launch (nothing machine-specific is written into committed files); attach is the harness's own attach command; inject goes through a cland mod that submits a prompt when the session is idle, with the inbox socket as fallback; state comes from the harness hooks calling `cland hook <event>` (turn start, turn end, permission request) and the mod's turn-complete event, with the polled sessions list as fallback; model and usage come from the documented surfaces. Harness processes live in the hub's process table; a crash sets `unknown` and writes a journal event. An unconfirmed inject stays `delivered`, logs an event and retries at the next idle. This is the first "hello": a message typed in General reaches a real Claude Code session and its reply comes back.

## Acceptance criteria

- [ ] From the Neovim client, a human message in General reaches a real Claude Code session; the stage shows `injected` once the mod submits it; the reply appears in the thread
- [ ] The session's state changes are visible in the hub (`busy` during a turn, `idle` after, `waiting for approval` on a permission prompt) and come from hooks or the mod, never from the model's self-report
- [ ] `attach_command` returns a command that, run in a terminal, attaches to the live session; two attached clients work
- [ ] After a hub restart, `resume` re-finds the running session through the process table and reconnects state reporting
- [ ] The capability table declares what the adapter cannot do (for example approval relay) instead of emulating it
- [ ] Tests drive the adapter against a fake Claude Code (a fake harness process honouring the hooks and the mod surface); one manual smoke run against the real harness is recorded in the ticket
