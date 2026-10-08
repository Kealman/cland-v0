---
id: T-13
kind: question
title: "Hub boundaries: what the hub owns, its transport, persistence and the nvim bridge"
state: closed
labels:
  - wayfinder:grilling
assignee: Kealman
parent: T-1
blocked_by:
  - T-3
  - T-7
  - T-10
topic: null
branch: null
created: 2026-10-07T14:52:27Z
updated: 2026-10-08T13:17:15.594Z
github:
  repo: Kealman/cland-v0
  number: 13
  url: https://github.com/Kealman/cland-v0/issues/13
---

## Question

What does the hub own and what does it not? Decide:

- Responsibilities: session registry, routing and store-and-forward, topic store, role assignment, asks and answers, state of sessions. And the explicit non-responsibilities.
- Transport between sessions and the hub; persistence.
- Process model: one hub per project, started with cland from the repo root.
- How the Neovim UI (Lua) talks to the hub: socket, msgpack-RPC, HTTP, other.
- Whether the hub is extracted from the BCAS core (Node / TypeScript, the agreed starting position) or re-implemented in one stack with the UI.

Produce an ADR.

## Comments

### Kealman · 2026-10-07T16:19:43Z

<!-- github-comment: 6042040173 -->

## Facts from research that bear on this decision

From `docs/research/neovim-engine.md`, `docs/research/harness-surfaces.md` and `docs/research/bcas-hub.md` (branches `research/neovim-engine`, `research/harness-surfaces`, `research/bcas-hub`):

- **No WebSocket client in Neovim Lua.** `vim.uv` gives TCP and Unix sockets; msgpack-RPC works both ways. The BCAS spoke protocol is WebSocket, so the nvim-to-hub bridge is a Unix socket, TCP, msgpack-RPC, or a sidecar, or the hub exposes a second transport.
- **Session processes already have servers.** Codex: app-server on a Unix socket; OpenCode: per-user service on 127.0.0.1:49374 or `--standalone`; Claude Code: no server, but hooks, mods, an inbox socket, `claude agents --json`, and `--bg` / `attach`. Decide who owns these processes (hub or nvim), given that Neovim terminals die with the Neovim process.
- **State sources differ per harness** (see the resolution of #3). The hub's state model must normalise them and admit "unknown".
- **Codex embedded-mode trap.** Any `-c` override (for example `developer_instructions`) or `--profile` drops the Codex TUI into embedded mode with no external surface; BCAS's reviewer pin used exactly that. Role clauses for Codex need another delivery path.
- **No SQLite module in Lua** (FFI to system libsqlite3 works); BCAS keeps hub state in SQLite on the Node side.

### Kealman · 2026-10-07T17:19:18Z

<!-- github-comment: 6043045700 -->

## Resolution

Decided on 2026-10-07 in a grilling session with the human. `GLOSSARY.md` (a1f1809) carries the terms; ADR 0003, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`, records the architectural choice and the rejected options.

**The hub owns:** the session registry (names, roles, normalised state, model, usage); routing and store-and-forward (topics, mentions, roles); the store of topics, messages and asks; role state (clauses, permission enforcement on every tool call, handover notes); the tracker index, live claims and the serialized writes of items; the event journal shown in the Agents topic; an audit log of every tool call with the calling session's name.

**The hub does not own:** decisions and business logic (it is coordination and a console, not a source of decisions, as in BCAS); the UI; git-territory operations (an own component, #14); artifact storage (#9).

**Process model.** A daemon per project, started by `cland` from the repo root on first use, independent of the UI and outliving it. It binds 127.0.0.1 (WebSocket for spokes) and a Unix socket in the project's cland folder (for the UI). A generated per-project secret lives in a gitignored file. A discovery file (socket path, port, secret, pid) is written on start and removed on stop; spokes, the CLI and the UI find the hub through it, and `cland` starts the daemon when it is absent.

**Harness processes.** The hub launches and supervises sessions through adapters (Codex app-server on a Unix socket, the OpenCode server, Claude Code `--bg`); the UI attaches terminals to them (`codex resume --remote`, `opencode --server`, `claude attach`), so a Neovim restart does not kill sessions. Prototype #11 validates the attach pattern.

**Transports.** Sessions: the BCAS spoke as it is (an MCP stdio server inside the harness holding one WebSocket to the hub; hello / welcome / deliver / result; reconnect; same-session takeover). UI: the same frames as JSON lines over the Unix socket, read with `vim.uv`, no sidecar process.

**Delivery stages.** `queued` (addressee offline) → `delivered` (accepted by the spoke) → `injected` (the adapter confirmed the message entered the session's turn: the `turn/start` result in Codex, the prompt API reply in OpenCode, mods' `$.prompt.submit()` or the inbox socket in Claude Code). The UI shows the stage, so "waiting for agent" is distinct from "the agent has seen it".

**Session state.** Normalised `idle / busy / waiting for human / waiting for approval / unknown`, filled by adapters from reliable signals (Codex `thread/status/changed`, OpenCode events, Claude Code hooks and `claude agents --json`). The model's self-reported `status` line is kept separately and never affects the state.

**Persistence.** SQLite in the hub: messages, topics, asks, role state, session registry, tracker index, journal, hygiene state (mutes and counters, so they survive a hub restart). The database file sits in the project's cland folder, gitignored. No retention purge in v0.

**Stack.** The BCAS core extracted: Node 24, TypeScript by type stripping, `node:sqlite`, `ws`, with its test harness (a real spoke over MCP and a real hub over WebSocket; the same approach for the UI socket). The UI is Lua. Two stacks are accepted deliberately.

**Spoke tools in v0.** `send`, `ask` (Coordinator only), `resolve`, `history`, `who`, `status`, `topic.create`, `task.*` (create, view, list, comment, edit, close, link, claim), `role.handover` and `session.launch` (Coordinator only). The role permissions from #10 are enforced on every call. Signatures are an implementation matter.

**Hygiene.** The BCAS limits and loop breaker (message size, rate, muting a looping agent pair) are kept; thresholds move to project config; state is persisted.

**Sub-agents.** The hub cannot tell a sub-agent's call from its parent's over one MCP connection, so nothing is enforced in v0: the role clause forbids sub-agents from calling hub tools, and the audit log makes violations visible. Technical isolation stays in the fog.

**Logging.** A JSON-lines journal in the cland folder; OTLP export optional (tied to the cost fog).

**Not decided here.** The adapter contract (#12); the git territory (#14); artifacts (#9); the cland folder layout (fog); the code layout of this repo (implementation).

### Kealman · 2026-10-07T17:38:43Z

<!-- github-comment: 6043387309 -->

## Addendum (2026-10-07): stdio transport for sandboxed QA runs

The QA research (#16) found that the Codex sandbox blocks Unix sockets while network access is off, so a QA run inside the sandbox cannot reach the hub over the socket of ADR 0003. Decision, confirmed by the human: the same JSON-lines frames also run over the stdio of a child process; for QA runs the UI spawns the hub (or a stub of it) as a child and talks to it over stdin and stdout. ADR 0003 is updated in f3b89b1.
