---
id: T-1
kind: map
title: "cland v0: the way to a buildable spec"
state: closed
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:51:04Z
updated: 2026-10-08T13:17:15.582Z
github:
  repo: Kealman/cland-v0
  number: 1
  url: https://github.com/Kealman/cland-v0/issues/1
---

## Destination

A spec for cland v0, the terminal IDE for agent harnesses: the architecture decisions recorded as ADRs in this repo (engine, hub, topic model, task tracking, git strategy, artifacts, harness adapters, roles, review and QA process), a glossary, and a first-slice cut, ready to be broken into implementation tickets with `/to-tickets`. The map decides; building is a separate effort.

## Notes

Domain: see `GLOSSARY.md` (Harness, Session, Role, Coordinator, Hub, Topic, Artifact). Product name: cland.

Settled at charting (not tickets):

- Single-user tool, one cland instance per project, started from the repo root.
- Neovim as the engine is the leading candidate, validated by a prototype ticket before an ADR locks it.
- v0 harnesses: Claude Code, Codex (as a full interactive harness, not only `exec`), OpenCode; one adapter layer designed for more.
- Role is first-class: assigned to a session, independent of harness and model, movable mid-project.
- The process layer (Matt Pocock's skills, adapted) is part of cland.
- The reusable core of the BCAS driver hub (`/Users/evgeniyivanov/Projects/BratvaInc/bcas/tooling/driver-hub`) is the starting codebase for the hub, not only inspiration.
- cland must know each session's state (idle, busy, waiting for the human, waiting for approval) from a reliable source, not from the model's self-report.

Working rules for every session on this map:

1. Everything written to this repo or the tracker is in English. The conversation with the human is in Russian.
2. The coordinator thinks, coordinates and decides; sub-agents on opus/sonnet do all direct work, at high effort by default (lower when the task allows).
3. Review (gpt 6.1 sol) and QA (gpt 6 astra, computer use) go through `/codex:rescue` only. If it fails, fix the chain or report to the human; never do their work for them.
4. Grilling tickets: call the Skill tool for `grilling` and `domain-modeling`. Prototype tickets: `prototype`. Research tickets: `research`; findings live in `docs/research/<name>.md` on a throwaway branch `research/<name>` (pushed, never merged, no PR).
5. ADRs in `docs/adr/`, glossary in `GLOSSARY.md`, both in this repo on `main`.

## Decisions so far

- [Research: what in the BCAS driver hub is reusable for cland](https://github.com/Kealman/cland-v0/issues/2): one Node service + per-session MCP spoke over WebSocket + SQLite; reuse the spoke, protocol, hub-client, Codex App Server supervisor, store-and-forward and HumanSide port nearly as-is; re-implement asks, roles, slots and add session state (absent in BCAS); drop Discord, the evidence CLI and boards. Findings: `docs/research/bcas-hub.md` on branch `research/bcas-hub`.
- [Research: harness integration surfaces for Claude Code, Codex and OpenCode](https://github.com/Kealman/cland-v0/issues/3): all three expose session state that does not come from the model, in different shapes: Codex app-server `thread/status/changed` (`idle` / `active` plus `waitingOnApproval` / `waitingOnUserInput`), OpenCode SSE events plus `GET /api/session/active` (no "waiting" status), Claude Code hooks and mods in-session plus polled `claude agents --json` (`busy` / `waiting` / `idle` with `waitingFor`). Codex and OpenCode run sessions on a local server the host joins as a client; Claude Code has no server but `--bg` plus `attach`. The host can answer approvals and inject messages in all three; channels remain a research preview. Same `SKILL.md` format, different directories; `AGENTS.md` / `CLAUDE.md` handling differs per harness. Versions: Claude Code 2.1.292, Codex 0.160.0, OpenCode 2.0.24. Findings: `docs/research/harness-surfaces.md` on branch `research/harness-surfaces`.
- [Research: what the latest Neovim release offers as the cland engine](https://github.com/Kealman/cland-v0/issues/4): stable is 0.12.5 (2026-08-23), 0.13 due 2026-10-15; Lua primitives cover a chat panel (splits, floats, extmarks, prompt buffers) and processes (`vim.system`, `vim.uv`, msgpack-RPC both ways); `NVIM_APPNAME` isolates a standalone build; the built-in terminal (libvterm) is the weak spot: limited key fidelity (Shift+Enter), pastes drop TABs by default, no images, terminals die with the Neovim process, open bugs with floats over terminals; no WebSocket client and no SQLite module in Lua. Findings: `docs/research/neovim-engine.md` on branch `research/neovim-engine`.
- [Research: self-hostable git engines for an agents-only territory](https://github.com/Kealman/cland-v0/issues/5): no agent-first self-hostable git engine exists; the realistic territories are plain Git plus a cland-owned review layer, a local Gitea / Forgejo forge (Gitea 28.1 verified end to end on macOS arm64: bot accounts, REST-driven PRs, reviews, required approvals, auto-merge), or Radicle (mid-transition, security fix pending in 2.0); a reviewer must be a separate identity everywhere; hundreds of open PRs on one base branch slow every merge; GitHub alone is insufficient on a personal account (no merge queue, no counted self-approval); the release squash to GitHub is always a separate, cland-owned step. Findings: `docs/research/git-engines.md` on branch `research/git-engines`.
- [Task: smoke-test codex:rescue with gpt 6.1 sol and gpt 6 astra](https://github.com/Kealman/cland-v0/issues/6): the chain works through `/codex:rescue --model gpt-6.1-sol` (review) and `--model gpt-6-astra` (QA), verified by the Codex rollouts (both at reasoning effort high from `~/.codex/config.toml`); astra's computer use is a browser-surface JS REPL (`mcp__cua_repl.js`) and refuses to drive the terminal app ("Computer Use is not allowed to use the app 'com.mitchellh.ghostty'"), so terminal QA needs another surface; shell access works.
- [Topic model: lifecycle, statuses, ownership and the single agent context](https://github.com/Kealman/cland-v0/issues/7): one flat list per project with two standing topics (General, Agents); a topic has a title, a status (open / waiting for human / waiting for agent / closed, set by message direction plus explicit `ask` and `resolve`) and at most one binding to a unit of work, with at most one topic per unit of work; messages address the Coordinator role by default and `@role` / `@session` pull others in; Ask is a message kind with options and a free answer; agents have no current topic, every delivery carries the topic id and history is pulled on demand; no ADR.
- [Role model: which roles exist, what a role carries, and how a role moves between sessions](https://github.com/Kealman/cland-v0/issues/10): four roles (Coordinator exclusive, Implementer, Reviewer, QA) plus roleless sessions off the hub; a role carries a clause, a skill list, hub-enforced permissions and launch defaults (Coordinator Claude Code/Fable, Implementer OpenCode/free model, Reviewer Codex/sol, QA Codex/astra); the clause is delivered by hub events, never by harness-native instruction pins; role-bound state lives in the hub and a handover note moves the role, never the transcript; only the Coordinator asks the human; ADR 0001.
- [Task tracking: own tracker, GitHub wrapper or hybrid](https://github.com/Kealman/cland-v0/issues/8): cland's own tracker is the source of truth, GitHub sync stays in the fog; one entity Item with kinds (epic, spec, task, question, map), GitHub-issue-shaped fields plus topic and branch links, claims, verdicts and cost; one Markdown file per item with YAML frontmatter, committed in the repo, written through the hub which keeps a SQLite index and the live state; comments and structured verdicts in the file; CLI `cland task` plus hub tools, so the skills work in their "other" tracker mode; sequential ids `T-123`; no auto-commits; ADR 0002.
- [Hub boundaries: what the hub owns, its transport, persistence and the nvim bridge](https://github.com/Kealman/cland-v0/issues/13): a per-project daemon independent of the UI, extracted from the BCAS core (Node/TS, SQLite, WebSocket spoke), owning the session registry, routing with store-and-forward and three delivery stages (queued, delivered, injected), topics and asks, role state and permission enforcement, the tracker index and live claims, and the journal; adapters launch and supervise harness processes and the UI attaches to them; the Neovim UI speaks the same frames as JSON lines over a Unix socket; normalised session state from reliable signals; secret file and database in the project's cland folder, never committed; ADR 0003.
- [Harness adapter contract: what every adapter must provide](https://github.com/Kealman/cland-v0/issues/12): mandatory `spawn`, `attach_command`, `inject` (confirming the injected stage), a normalised state stream, `stop` and `resume`; optional `history`, `usage`, `set_model` and approval relay, declared as capabilities with per-signal reliability; the v0 mapping is fixed for Codex (app-server plus `resume --remote`), OpenCode (server plus TUI client, heuristic waiting) and Claude Code (`--bg` plus `attach`, mod-based inject, hooks for state); adapters are hub modules with harness processes in the hub's process table; failures surface as stage and state and never block the queue; approvals stay in the harness TUI in v0; no ADR.
- [Git strategy: an agents-only territory and what flows to GitHub](https://github.com/Kealman/cland-v0/issues/14): plain git with a cland-owned layer, no forge; the project's `origin` is a local bare repository (the territory) inside the cland folder and GitHub is the remote `github` touched only by releases; `main` mirrors GitHub, `dev` integrates, task branches `t/T-123-slug` in cland-made worktrees land on `dev` as one squash commit each through `cland merge`, which requires clear review and (where marked) QA verdicts from the right roles; `cland release` fast-forwards `main` to `dev`, tags `vX.Y.Z` with notes from item titles and pushes to GitHub; `cland init` re-points an existing project reversibly; ADR 0004.
- [Research: QA of a terminal IDE with gpt 6 astra computer use](https://github.com/Kealman/cland-v0/issues/16): astra cannot drive a native terminal through `/codex:rescue` and no setting changes that (terminals are blocked in the signed Computer Use helper, and approvals are auto-declined inside rescue runs); three verified lanes remain: a headless Neovim driven by `nvim_input` with the grid read by `screenstring()` (the default, no grant needed), tmux with `capture-pane` (needs `network_access = true` in the Codex sandbox), and a ttyd web terminal in Chrome on a pre-allowed origin; the sandbox blocks Unix sockets while network is off, so sandboxed QA uses a stdio link to the hub (ADR 0003 addendum); long runs go `--background`; verdicts as structured item comments. Findings: `docs/research/qa-astra.md` on branch `research/qa-astra`.
- [Artifact model: where artifacts live, their lifecycle, and how agents show things to the human](https://github.com/Kealman/cland-v0/issues/9): artifacts are plain files in the project's cland folder with a hub index, not committed unless promoted into the repo; ids `A-123`; kinds prompt, note, page, diagram, file; Markdown and Mermaid render in Neovim, HTML and images open in the browser; long prompts are drafted as `prompt` artifacts and sent or attached; agents share through `artifact.create`, which posts into the topic; statuses draft, sent, shared, archived with time-based cleanup; bound to topics, never to sessions; no ADR.
- [Process layer: what cland provisions into a project](https://github.com/Kealman/cland-v0/issues/17): skills in `.agents/skills` with `.claude/skills` symlinked, `docs/agents/*`, `AGENTS.md` only (never `CLAUDE.md`; an `@AGENTS.md` import if one exists), the roles config, Claude Code hooks and the cland mod, all marked "managed by cland" and refreshed by `cland init` / `cland update` without touching anything else; the Matt Pocock skills vendored with cland's patches plus `qa`, `release`, `merge` and `handover`; only secret-free files are committed; `cland doctor` checks the toolchain; the cland folder is `.cland/` with `tasks/`, `roles.toml` and `config.toml` committed and `artifacts/`, `worktrees/`, `territory.git/`, `hub.db`, `hub.json`, `secret`, `journal.jsonl` ignored; no ADR.
- [Prototype: Neovim as host versus Neovim as embedded component](https://github.com/Kealman/cland-v0/issues/11): Neovim is the host; the prototype on branch `prototype/nvim-host` passed all three showstoppers and the human's checklist with the real harnesses; the terminal's failures (Shift+Enter, pasted TABs, scrollback default, terminals dying on `:restart`, alternate-screen history, UI updates waiting on pending input) are mitigated in cland's configuration and by owning sessions outside Neovim; embedding Neovim in an own host is rejected; ADR 0005.
- [Prototype: the chat screen with topics](https://github.com/Kealman/cland-v0/issues/15): the main screen is one shell with toggleable panels, accepted for v0: a centre view (thread, board, item, session, Agents log, inbox full width), a left items panel with filters including the wayfinder map, one right panel (inbox, sessions or topics), one floating picker, the three motions `gi` / `gt` / `gs`, and stage presets as examples rather than modes; design canvas and branch `prototype/workbench`; the per-item change tour is parked in the fog.
- [First usable slice: what goes into the first daily-driver build](https://github.com/Kealman/cland-v0/issues/18): slice 1 is the daily driver (shell, hub, adapters, roles, tracker, process layer, review and QA through the roles) in six tracer bullets, done when the human runs a real cland task inside cland; slice 2 adds the git territory, artifacts, the QA lane infrastructure and UI additions; tracker bootstrap on GitHub Issues; repository layout `hub/`, `nvim/`, `skills/`, `docs/`; recorded in `docs/spec/v0.md`.

## Not yet specified

- Engine: distribution format of the standalone build; keymap scheme.
- Sessions: restoring sessions after an IDE restart; binding a session to a git worktree.
- Chat: message rendering (Markdown, code, artifacts inline); searching history.
- Task tracking: the entity model (task, epic, milestone, question); binding topics to tasks; plugging the skills into an own tracker through their "other" tracker mode.
- Git: a worktree per session; branch integration policy; the release flow into GitHub.
- Artifacts: rendering HTML and diagrams from a terminal (browser hand-off, terminal graphics protocols); versioning.
- Hub: security of local connections; an ingress for automation; asks with options and approval relays rendered in the IDE.
- Review and QA as a cland feature: the coordinator running review (sol) and QA (astra) rounds as harness sessions, distinct from the process used to build cland itself.
- Ideas to revisit: a sessions board (role, harness, model, state and current task of every session at a glance); cost and usage per session, role and model; crew presets (launch a standard set of sessions for a task type in one command); a unified event journal across sessions for retrospectives and recovery.
- Change tour per item: look at what an item changed as the project is now, navigated by file structure, with new or changed places marked in the gutter rather than a red and green diff; spawn a session on the item's worktree or context to ask for a diagram or an explanation.

## Out of scope

- Multi-user mode, accounts and permissions.
- A GUI outside the terminal.
- Cloud hosting of cland.
- Remote access (from a phone or another machine) for v0.

## Comments

### Kealman · 2026-10-08T11:33:59Z

<!-- github-comment: 6058950178 -->

## Map complete (2026-10-08)

All 17 tickets are closed. The destination is reached: `docs/spec/v0.md` on `main` (225f725), with ADR 0001 to 0005 in `docs/adr/` and `GLOSSARY.md`. Research findings stay on the `research/*` branches, prototypes on the `prototype/*` branches, none merged.

Next: `/to-tickets` on slice 1 of the spec, tracked in this repo's GitHub Issues until `.cland/tasks` exists.
