---
id: Q-12
kind: question
title: "Harness adapter contract: what every adapter must provide"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: M-1
blocked_by:
  - Q-3
topic: null
branch: null
created: 2026-10-07T14:52:23Z
updated: 2026-10-08T13:17:15.594Z
github:
  repo: Kealman/cland-v0
  number: 12
  url: https://github.com/Kealman/cland-v0/issues/12
---

## Question

What must every harness adapter provide so that the hub and the UI can treat Claude Code, Codex and OpenCode uniformly? Decide the contract:

- Spawn (with role, model, working directory).
- Attach to the live session: the human can open it and type.
- Send input; deliver hub messages into the session.
- Observe state (idle, busy, waiting for human, waiting for approval) from reliable signals.
- Read history / transcript; resume after restart.
- Report model and usage.

Decide what is mandatory versus optional per harness, and how an adapter declares what it cannot do.

## Comments

### Kealman · 2026-10-07T16:19:45Z

<!-- github-comment: 6042040636 -->

## Facts from research that bear on this contract

From `docs/research/harness-surfaces.md` (branch `research/harness-surfaces`), versions Claude Code 2.1.292, Codex 0.160.0, OpenCode 2.0.24:

- **State.** Codex: `thread/status/changed` with `idle` / `active` and `waitingOnApproval` / `waitingOnUserInput`, keyed by `threadId`. OpenCode: SSE `session.execution.*`, `permission.asked`, `form.created`; `GET /api/session/active` says only `running`, even during a pending approval. Claude Code: hooks `UserPromptSubmit`, `Stop`, `PermissionRequest` (also fires for `AskUserQuestion`), mods' `turn.complete` (`isAborted` on Esc), polled `claude agents --json` (`busy` / `waiting` / `idle`, `waitingFor`). An Esc interrupt fires no `Stop` hook; `Notification` arrives late.
- **Attach.** Codex: `codex resume --remote unix://...` after the thread has a turn. OpenCode: any TUI is a client of the service or `--server <url>`. Claude Code: `claude --bg` plus `claude attach`; two attached clients observed.
- **Inject and steer.** Codex: `turn/start` steers, `turn/steer` needs the turn id, `codex queue` (experimental) runs next. OpenCode: `prompt` with `delivery: steer|queue`. Claude Code: mods' `$.prompt.submit()` waits for idle; the inbox socket's format is undocumented; channels still research preview.
- **Approvals.** The host can answer in all three and always races the harness's own dialog (first answer wins in Codex; API reply clears the OpenCode dialog; a `PermissionRequest` hook can allow or deny in Claude Code).
- **Embedded-mode trap.** Any Codex `-c` override or `--profile` removes the external surface.
- **Instructions and skills.** Claude Code reads `AGENTS.md` only without `CLAUDE.md`; Codex reads `CLAUDE.md` only via `project_doc_fallback_filenames`; OpenCode reads `AGENTS.md` only. Same `SKILL.md` format; directories `.claude/skills` (Claude Code), `.agents/skills` (Codex), both (OpenCode). MCP config: JSON, TOML, OpenCode JSON.
- **Usage.** Claude Code: model, USD estimate, rate limits (Pro / Max). Codex: token events and rate limits, USD via `account/usage/read`. OpenCode: per-message model, tokens, local USD estimate, no rate limits.

### Kealman · 2026-10-07T17:25:26Z

<!-- github-comment: 6043150354 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. No ADR: the contract is an interface and this comment is its specification. The terms Adapter and Spoke are in `GLOSSARY.md`.

**Mandatory operations, every adapter.** `spawn(name, role, model, cwd)`; `attach_command(session)`, the shell command the UI runs in a terminal to join the live session; `inject(session, message)`, confirming the `injected` delivery stage; a `state(session)` stream in the normalised model (`idle / busy / waiting for human / waiting for approval / unknown`); `stop(session)`; `resume(session)` after a hub or harness restart.

**Optional operations**, declared as capability flags: `history`; `usage` (model, tokens, cost, rate limits); `set_model`; approval relay. What an adapter cannot do, it declares and never emulates.

**Capability table.** Each adapter publishes its operations and, for every state signal, its reliability: `reliable`, `heuristic` or `none`. The hub exposes the table to the UI, so the UI can say, for example, that "waiting for human" is heuristic for OpenCode.

**v0 mapping** (facts verified in the harness research; details are implementation):

- **Codex.** `spawn` = `codex app-server --listen unix://…` per session plus `thread/start` with the model; the first turn delivers the role clause, after which attach works: `codex resume --remote unix://… <threadId>`. `inject` = `turn/start` with `toolOutput` (as in BCAS), or `turn/steer` during an active turn. State = `thread/status/changed` (reliable). Approvals are answered in the attached TUI; the hub may answer too. Usage from token events and `account/rateLimits/read`. No `-c` overrides on the TUI process.
- **OpenCode.** The session lives on the local OpenCode server (the shared service, or `--standalone` per session); attach = the TUI client `opencode --server <url>` on that session; `inject` = the prompt API with `delivery: steer|queue`; state from the SSE events, with `waiting for human` derived from `permission.asked` and `form.created` (heuristic); usage per message.
- **Claude Code.** `spawn` = `claude --bg --model …` in `cwd`; attach = `claude attach <session>`; `inject` through a cland mod (`$.prompt.submit()`, shipped by the process layer), with the inbox socket as fallback; state = the hooks `UserPromptSubmit`, `Stop`, `PermissionRequest` and the mod's `turn.complete` (reliable), with `claude agents --json` as a polled fallback; approvals through the `PermissionRequest` hook (optional); model and usage from `SessionStart.model` and the status line.

**Placement.** Adapters are modules inside the hub process (TypeScript). Separate processes exist only where the harness needs them (the Codex app-server, `claude --bg`), tracked in the hub's process table; a crash sets the session to `unknown` and writes a journal event.

**Working directory.** `spawn` takes `cwd`: the project root or a worktree under it. Binding sessions to worktrees is decided with git (#14).

**Spoke configuration.** The adapter injects the spoke's MCP configuration at spawn (the Claude Code launch config, `-c mcp_servers.*` on the Codex app-server, the OpenCode JSON config). Committed project files never carry machine paths or hub secrets.

**Failure semantics.** An `inject` that is not confirmed within its timeout stays `delivered`, logs an event and is retried at the next `idle`. A dead session process means `unknown`; messages queue; `resume` when it returns. There is no "uncertain, wait for a human" state as BCAS had for Codex: uncertainty is always visible as stage and state and never blocks the queue.

**Approvals in v0.** Answered in the attached harness TUI by the human; the hub only reflects `waiting for approval`. Relaying approvals into the cland UI is an optional capability left in the fog.

**Health and identity.** The adapter heartbeats its session process (30 s, two misses, like the spoke to the hub). Session identity on reconnect is the name plus the harness's own id (the Claude Code session id, the Codex threadId, the OpenCode session id), so `resume` restores that session. After a hub restart, adapters rediscover live processes from the process table in SQLite.

**Not decided here.** Worktree binding (#14); approval relay and asks rendered in the IDE (fog); exact signatures (implementation).
