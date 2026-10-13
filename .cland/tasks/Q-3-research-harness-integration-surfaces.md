---
id: Q-3
kind: question
title: "Research: harness integration surfaces for Claude Code, Codex and OpenCode"
state: closed
labels:
  - wayfinder:research
assignee: null
parent: M-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:51:48Z
updated: 2026-10-08T13:17:15.587Z
github:
  repo: Kealman/cland-v0
  number: 3
  url: https://github.com/Kealman/cland-v0/issues/3
---

## Question

For each v0 harness (Claude Code, Codex, OpenCode): what surfaces does it give an external host to launch, observe, drive and resume an interactive session?

The central sub-question: which **reliable signals of session state** exist (idle, busy, waiting for the human, waiting for an approval), as opposed to the model's self-report.

Also cover:

- Instruction and skill portability: `CLAUDE.md` / `AGENTS.md`, skills, MCP, hooks. What is shared across the three harnesses, what needs an adapter.
- Hooks, SDKs, MCP, channels (is Claude Code's channels feature still research-preview or GA?), session and transcript files, resume, headless / exec / server modes (Codex App Server, OpenCode server mode), notifications, approval and permission relays, model and usage reporting.

Primary sources only: official docs, source code, changelogs. Record the exact versions examined.

Context: BCAS integrated Claude Code via research-preview channels and Codex via the App Server; it never captured terminal output and had no session-state signal. See the ticket "Research: what in the BCAS driver hub is reusable for cland" and branch `research/bcas-hub`.

## Comments

### Kealman · 2026-10-07T16:05:52Z

<!-- github-comment: 6041801099 -->

## Resolution

**Bottom line.** All three harnesses expose machine-readable session state that does not come from the model, but in different shapes. Codex and OpenCode run interactive sessions on a local server that the host can join as a client (the Codex app-server, the OpenCode background service). Claude Code has no such server, so its state comes from inside each session (hooks, mods) or from a polled registry (`claude agents --json`). In all three the host can answer approvals and questions, inject messages into a running session, and run the TUI attached to a session that another process drives. Claude Code channels are still a research preview in 2.1.292. Most of these surfaces are labelled preview or experimental.

Versions examined: Claude Code 2.1.292 (Agent SDK 0.3.292), codex-cli 0.160.0 (`rust-v0.160.0`), opencode 2.0.24 (`v2.0.24`). "Observed" means seen in a local probe on this machine.

**Key findings**

1. **Codex names its states.** `thread/status/changed` is broadcast to every app-server client with `idle`, `systemError`, `notLoaded`, or `active` plus the flags `waitingOnApproval` / `waitingOnUserInput`. Observed sequence: `active []`, `active [waitingOnApproval]`, `active []`, `idle`, then `turn/completed`. Status must be keyed by `threadId`, because the server also reports internal helper threads.
2. **The plain Codex TUI runs on a shared local app-server daemon by default** (`daemon_auto_start`, stable, default since 0.157.0). Any `-c` override, including `developer_instructions`, or `--profile` drops the TUI into embedded mode, which has no external surface. A TUI can also join the host's own app-server with `codex resume --remote unix://...`, but only after the thread has a turn ("no rollout found" otherwise; observed).
3. **OpenCode 2.x has no "waiting" status.** State is the SSE stream `GET /api/event` (`session.execution.started|succeeded|failed|interrupted`, `permission.asked`, `form.created`) plus `GET /api/session/active`, whose only value is `running`. Observed: during a pending approval the session still reads `running`. The documented `session.status` and `session.idle` events are never published.
4. **OpenCode 2.x is a new architecture.** Every TUI is a client of a shared per-user background service (127.0.0.1:49374, discovery file `~/.local/state/opencode/service.json`), of a `--standalone` child, or of `--server <url>`. Observed: an attached TUI rendered prompts, permission dialogs and question forms created by the host through the API, and replies worked in both directions. The 2.x docs live at opencode.ai/v2/docs; opencode.ai/docs still describes 1.x.
5. **Claude Code's registry.** `claude agents --json` is documented as "the supported way to read session state from outside Claude Code": `status` (`busy`, `waiting`, `idle`), `waitingFor` (`permission prompt`, `input needed`, ...), and `state` for background sessions. It is poll-only, and agent view is a research preview.
6. **Claude Code hooks have gaps that mods fill.** `UserPromptSubmit` and `Stop` bracket a turn, and `PermissionRequest` marks a pending approval (also for `AskUserQuestion`, with `tool_name: "AskUserQuestion"`). An Esc interrupt fires neither `Stop` nor `StopFailure` (observed), and `Notification` arrives 6 s or 60 s late. Mods (in-process JavaScript, on by default since 2.1.287) fire `turn.complete` with `isAborted: true` on interrupt (observed).
7. **Injecting into a running Claude Code TUI without channels.** Mods `$.prompt.submit()` waits until the session is idle, then starts a turn (observed). The session inbox socket (`CLAUDE_CODE_MESSAGING_SOCKET`) is documented for scripts and hooks, but its message-line format is not. Channels remain a research preview with flags hidden from `--help`, and on the v2 MCP runtime (protocol 2026-07-28) channel servers do not register.
8. **Attach in Claude Code.** `claude --bg` plus `claude attach <id>` works, and two attached clients were observed on one session, which the docs do not mention. The Agent SDK and `-p` cannot attach to a running TUI session.
9. **Approval relays exist in all three, and all race the harness's own prompt.**
   - Codex sends each request to every subscribed client; the first answer wins, and `serverRequest/resolved` goes to all (observed with a TUI and a host).
   - OpenCode's reply endpoint clears the TUI dialog (observed).
   - Claude Code's `PermissionRequest` hook allows or denies, and it answered `AskUserQuestion` through `updatedInput.answers` (observed; documented only for the SDK's `canUseTool`). A slow hook runs while the TUI dialog is already showing.
10. **Steer versus queue.** Codex `turn/start` steers an active turn, `turn/steer` needs `expectedTurnId`, and `codex queue` (experimental) runs as the next turn (observed both when idle and when busy). OpenCode `prompt` takes `delivery: steer|queue`.
11. **Instructions.** Claude Code reads `AGENTS.md` natively since 2.1.277, but only when no `CLAUDE.md` or `CLAUDE.local.md` exists. Codex reads `CLAUDE.md` only through `project_doc_fallback_filenames`. OpenCode 2.x reads `AGENTS.md` only.
12. **Skills, MCP and hooks.**
    - Skills share the `SKILL.md` format but not the directories. Claude Code reads `.claude/skills` only. Codex reads `.agents/skills` (and requires `name` and `description`) but not `.claude/skills`. OpenCode reads `.claude/skills`, `.agents/skills` and `.opencode/skills`. This repo's `.agents/skills` plus `.claude/skills` symlinks reach all three.
    - MCP config formats differ: JSON in Claude Code, TOML in Codex, and OpenCode's own JSON.
    - Hooks are similar between Claude Code and Codex (11 of 12 event names match) and unrelated in OpenCode.
13. **Usage.**
    - Claude Code: model, a client-side USD estimate and rate limits (Pro and Max only) through the status line, OTel and mods.
    - Codex: `thread/tokenUsage/updated` and `account/rateLimits/*`; USD only through `account/usage/read` and OTel.
    - OpenCode: per-message model, tokens and a local USD estimate; no rate limits.
14. **What changed since BCAS.** The private transcript and quota reads that BCAS relied on now have documented Claude Code replacements: `SessionStart.model`, status line `rate_limits`, and mods `$.session.usage()`. BCAS's Codex pattern (an app-server on a Unix socket, `resume --remote`, `inject_items` for an empty thread) still matches 0.160.0.

Not verified:
- whether a late `PermissionRequest` hook decision closes a Claude Code TUI dialog that is already open;
- the message format of the Claude Code inbox socket;
- `codex queue` dispatch into an embedded TUI;
- how OpenCode resolves a skill name that appears in both `.agents/skills` and `.claude/skills`.

Full findings with sources: `docs/research/harness-surfaces.md` on branch `research/harness-surfaces` (https://github.com/Kealman/cland-v0/tree/research/harness-surfaces).
