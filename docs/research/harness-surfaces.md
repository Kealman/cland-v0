# Harness integration surfaces: Claude Code, Codex, OpenCode

Research for wayfinder ticket #3, made on 2026-10-07. It records what each v0 harness gives an external host (cland) to launch, observe, drive and resume an interactive session, with the main question being which **reliable signals of session state** exist. Nothing here is a design decision.

| Harness | Version examined | Source of truth |
|---|---|---|
| Claude Code | `2.1.292` (local CLI); Agent SDK TS `0.3.292` (bundles CLI 2.1.292), Python `0.2.164` | [code.claude.com/docs][cc-llms], [CHANGELOG][cc-changelog], SDK type definitions, local CLI |
| Codex | `codex-cli 0.160.0`; tag `rust-v0.160.0` = commit `a956835d` (2026-10-01) | [learn.chatgpt.com/docs][cx-llms] (the old `developers.openai.com/codex/*` URLs now 308-redirect there), [source at the tag][cx-src], protocol schema generated locally with `codex app-server generate-json-schema` |
| OpenCode | `opencode v2.0.24`; repo `anomalyco/opencode` (`sst/opencode` redirects there), tag `v2.0.24` = commit `e7a34f09` | [opencode.ai/v2/docs][oc-v2-llms] (`opencode.ai/docs` still describes 1.x), [source at the tag][oc-src], the server's own OpenAPI document |

Method: docs fetched on 2026-10-07, source read at the tags above, local `--help` output, and eight local probes (P1 to P8, listed in the appendix) that drove real sessions on this machine (macOS, arm64). "Observed" means seen in a probe. "Inferred" means not stated by a source and not observed. Doc pages are cited by link; source files by path at the tag.

## Bottom line

- **All three harnesses expose machine-readable session state that does not come from the model, but in different shapes.** Codex and OpenCode run interactive sessions on a local server that the host can join as a client. Claude Code has no such server; its state comes from inside each session (hooks, mods) or from a polled registry.
- **Codex** pushes `thread/status/changed` to every connected client: `idle`, or `active` with the flags `waitingOnApproval` / `waitingOnUserInput`. By default the plain `codex` TUI runs on a shared local app-server daemon, and the TUI can also attach to a host's own app-server (`--remote`).
- **OpenCode 2.x** is a new architecture: every TUI is a client of a shared background service (or of a server named with `--server`). State is the SSE stream (`session.execution.*`, `permission.asked`, `form.created`) plus `GET /api/session/active`. There is no "waiting" status: during a pending approval the session still reads `running` (observed). The documented `session.status` and `session.idle` events are never published.
- **Claude Code** offers `claude agents --json` (poll; `busy`, `waiting`, `idle` plus `waitingFor`, documented as "the supported way to read session state from outside"), settings hooks, and since 2.1.287 in-process mods (`turn.start`, `turn.complete`). The `Stop` hook does not fire on a user interrupt (observed); the mod event `turn.complete` does, with `isAborted: true`.
- **The host can answer approvals and questions, and inject messages, in all three.** Codex: server requests plus `turn/start`, `turn/steer` and `codex queue`. OpenCode: reply endpoints plus `prompt` with `delivery: steer|queue`. Claude Code: the `PermissionRequest` hook (it also answered `AskUserQuestion` in a probe), plus mods `$.prompt.submit` or the session inbox socket.
- **Channels in Claude Code are still a research preview** in 2.1.292, with their flags hidden from `--help`.
- **Instructions converge on `AGENTS.md`**: Claude Code reads it only when no `CLAUDE.md` exists, Codex reads `CLAUDE.md` only through a fallback setting, and OpenCode 2.x reads `AGENTS.md` only. Skills share the `SKILL.md` format, but `.agents/skills` reaches Codex and OpenCode, while Claude Code reads only `.claude/skills` (which OpenCode reads too).
- **Most of these surfaces carry preview or experimental labels**: Claude Code agent view (research preview), the Codex app-server and its daemon (experimental), and the OpenCode HTTP API ("Experimental HttpApi surface").

## 1. Claude Code 2.1.292

### 1.1 Session state signals

- **Session registry (poll): `claude agents --json`.** The docs call it "the supported way to read session state from outside Claude Code, for example from a status bar, a scheduler, or another Claude session that supervises background work" ([agent view][cc-agent-view]).
  - It lists interactive and background sessions. Fields: `cwd`, `kind`, `startedAt` always; `id`, `state` for background sessions; `pid`, `status` while the process lives; `waitingFor` when `status` is `waiting`; `sessionId`, `name` when set.
  - `status` is `busy`, `waiting` or `idle`. `state` is `working`, `blocked` ("waiting on you: a question it asked, a permission or sandbox decision, an error only you can clear"), `done`, `failed` or `stopped`. `waitingFor` is `permission prompt`, `input needed`, `sandbox request`, `worker request` or `dialog open` ([agent view][cc-agent-view]).
  - Added in 2.1.145; `waitingFor` in 2.1.162; `id`, `state` and `--all` in 2.1.169 ([changelog][cc-changelog]).
  - Caveats: "Agent view is in research preview" ([agent view][cc-agent-view]). The command prints a snapshot and exits; `claude agents --help` has no watch or stream option, and the docs say to "Poll `claude agents --json --all`, which keeps listing sessions whose process has exited".
  - Observed (P1): `idle` at start, `busy` from `UserPromptSubmit`, `waiting` from `PermissionRequest` (also while an `AskUserQuestion` question was open), `busy` after the answer, `idle` at `Stop`. After an Esc interrupt it went from `busy` to `idle` within about a second, although no hook fired. The entry vanished at exit. A background session showed `"status":"waiting","waitingFor":"permission prompt","state":"blocked"` (P2).
  - The data comes from `~/.claude/sessions/<pid>.json` (`status`, `statusUpdatedAt`, `kind`, `version`, `messagingSocketPath`, ...) (P1). The file is undocumented, and the docs warn that `~/.claude/jobs/<id>/` files "are not a stable interface". Treat both as internal.
- **Settings hooks (push, one call per event).** 33 events ([hooks][cc-hooks]). Those that mark state:
  - turn start: `UserPromptSubmit` (`prompt_id`, `prompt`);
  - turn end: `Stop` (`last_assistant_message`); a turn ended by an API error: `StopFailure`;
  - permission pending: `PermissionRequest` ("when a tool call needs a permission decision"), then `Notification` with `notification_type: "permission_prompt"`;
  - question pending: `AskUserQuestion` arrives as `PreToolUse` and `PermissionRequest` with `tool_name: "AskUserQuestion"` and `tool_input.questions[]` (observed, P1);
  - idle: `Notification` `idle_prompt`. MCP input: `Elicitation` and `Notification` `elicitation_dialog`. Background sessions while agent view is open: `Notification` `agent_needs_input`, `agent_completed`;
  - session: `SessionStart` (`source`: `startup`, `resume`, `clear`, `compact` or `fork`; it also carries `model`), `SessionEnd` (`reason`); plus `SubagentStart`/`SubagentStop`, `PreCompact`/`PostCompact`, and `MessageDisplay` (streamed text).
  - Handler types: `command` (JSON on stdin), `http` (JSON POSTed to a URL, decision in the response body), `mcp_tool`, `prompt`, `agent`. Default timeout is 600 s for `command` and `http`. `async: true` runs a hook in the background; `asyncRewake` "runs in the background and wakes Claude on exit code 2" ([hooks][cc-hooks]).
  - Blocking: exit code 2 or a JSON decision can block `UserPromptSubmit`, `PreToolUse`, `PostToolBatch`, `Stop`, `SubagentStop`, `PreCompact`, `ConfigChange` and others. `PermissionRequest` decides through `hookSpecificOutput.decision`. `Notification`, `SessionStart`, `SessionEnd` and `PostCompact` cannot block; `SessionStart` can add context ([hooks][cc-hooks]).
  - A host can add hooks for one session with `--settings <file-or-json>` (local `claude --help`; used in P1, P2, P4 and P5). `--bare` skips hooks. Hooks do not run before the workspace trust dialog is accepted (observed, P1).
  - Observed timing (P1): `permission_prompt` came 6.0 s after `PermissionRequest`; `idle_prompt` came 60.1 s after `Stop`.
  - Gaps, observed in P1 (the hooks page is silent on them):
    - An Esc interrupt fired neither `Stop` nor `StopFailure`.
    - A question raised the same `permission_prompt` notification as a tool approval; only `PermissionRequest.tool_name` tells them apart.
    - Every turn ended with an internal `SubagentStop` (empty `agent_type`, no `SubagentStart`) 3 to 6 s after `Stop`, so `SubagentStop` is not a turn boundary.
- **Mods (push, in process, 2.1.287 and later).** A mod is a plugin of JavaScript or TypeScript handlers running inside Claude Code; "Mods are on by default" from 2.1.287 ([mods overview][cc-mods-overview], [create a mod][cc-mods-create]).
  - State events: `turn.start` (`turnId`); `turn.complete`, which fires "including a turn the user interrupted, where `e.isAborted` is `true`" and carries `usage` and `durationMs`; `tool.check` (the `allow`, `ask` or `deny` decision); `session.measure` (context, rate limits and cost after each turn); `session.attach`/`session.detach` ("another app connects to or disconnects from the session") ([mods events][cc-mods-events], [mods reference][cc-mods-reference]).
  - Observed (P3, a mod loaded with `--plugin-dir`): `turn.complete` fired with `isAborted: true` on Esc, which covers the hook gap above; `tool.check` returned `{decision: "ask", reason: ...}` before the approval dialog.
  - A mod runs with the user's permissions and is not sandboxed. `--bare`, `--safe-mode` and `disableAllHooks` turn installed mods off ([mods overview][cc-mods-overview]).
- **OpenTelemetry.** With `CLAUDE_CODE_ENABLE_TELEMETRY=1` and an OTLP exporter, events carry `session.id`: `claude_code.user_prompt`, `claude_code.api_request` (`model`, `cost_usd`, tokens), `claude_code.tool_decision` (`decision`, `source`), `claude_code.tool_result`, `claude_code.api_error` and others, plus metrics such as `claude_code.cost.usage` and `claude_code.token.usage` ([monitoring][cc-monitoring]). The event list has no waiting or idle event.
- **Agent SDK and print-mode stream (sessions the SDK owns, never a TUI).** `query()` "spawns a separate `claude` CLI process and talks to it over stdio" ([hosting][sdk-hosting]); `claude -p --output-format stream-json` emits the same messages ([headless][cc-headless]).
  - Turn end: "The CLI emits exactly one result message per turn… treat it as the turn-complete signal" (`sdk.d.ts` in [`@anthropic-ai/claude-agent-sdk`][sdk-repo] 0.3.292).
  - State: `system/session_state_changed` with `idle`, `running` or `requires_action`, opt-in through `CLAUDE_CODE_EMIT_SESSION_STATE_EVENTS=1`; `requires_action` means "the session is blocked on an answer to a request it sent your host, such as a permission prompt" ([TypeScript SDK][sdk-ts]).
  - Pending permission or question: a `can_use_tool` control request. Also `rate_limit_event`, `system/status`, and hook lifecycle frames with `includeHookEvents` ([TypeScript SDK][sdk-ts]).
- **Status line.** A configured command receives JSON on every update (model, cost, context window, rate limits, `session_id`, `transcript_path`). Updates are event-driven and debounced at 300 ms; `refreshInterval` adds a timer ([status line][cc-statusline]). The documented fields include no busy or idle state.
- **Does not exist:**
  - a push stream of state outside the session's own process (hooks and mods run per session; `claude agents --json` must be polled);
  - a settings hook for a user interrupt;
  - a stable transcript format: "The entry format is internal to Claude Code and changes between versions" ([sessions][cc-sessions]).

### 1.2 Launch, attach, drive

- **Launch.** `claude [prompt]` takes `--model`, `--append-system-prompt`, `--system-prompt`, `--settings`, `--mcp-config`, `--strict-mcp-config`, `--plugin-dir`, `--agents`/`--agent`, `--permission-mode`, `--session-id <uuid>`, `-n/--name`, `--add-dir`, `--effort` and `--worktree` (local `claude --help`). The working directory is the process's own; `claude` has no cwd flag. `CLAUDE_CONFIG_DIR` plus `CLAUDE_CODE_PROJECT_DIR_NAME` isolates storage, which "suits a host that embeds Claude Code and gives each session its own config directory" ([sessions][cc-sessions]).
- **Background sessions and attach** (research preview, [agent view][cc-agent-view]).
  - `claude --bg [prompt]` starts a session under a supervisor, "a background service that runs your background sessions so they keep working after you close agent view or your terminal". It takes the same flags (`claude --model opus --bg ...`).
  - `claude attach <id|name>` opens the session in a terminal; `claude logs`, `stop`, `rm` and `respawn` manage it.
  - Supervisor state: `~/.claude/daemon.log`, `~/.claude/daemon/roster.json`, `~/.claude/jobs/<id>/state.json`.
  - Observed (P2): hooks passed with `--settings` fired inside the background session. Two `claude attach` clients on one session both rendered it live, and an approval given in one updated the other. The docs do not mention several attached clients.
- **Injecting a message into a running interactive session.** There are five routes; stdin is not one of them.
  1. **Mods: `$.prompt.submit({ text, asUser })`.** "The call waits until the session is idle and then starts a new turn" ([mods API][cc-mods-api]). A mod can reach a host through `$.http.fetch` or a streaming `$.process.spawn`. Observed (P3): a prompt submitted from a mod timer started a turn, labelled "Prompt from the cland-probe-mod plugin". One submitted while an approval dialog was open waited and ran right after that turn completed.
  2. **The session's inbox socket** (2.1.224 and later). Each session binds a Unix socket and exports `CLAUDE_CODE_MESSAGING_SOCKET` and `CLAUDE_CODE_MESSAGING_TOKEN` to hooks and Bash. The docs name "a script or hook to post into a session" as a use. Delivery is "between tool calls during an active turn", or a new turn when idle; `crossSessionInbound` (`accept`, `hold`, `refuse`) and the own-child rules decide what gets through ([cross-session messaging][cc-cross-session]). **The JSON format of a message line is not documented**; only the optional auth line `{"type":"auth","token":"<token>"}` is ([cross-session messaging][cc-cross-session], [env vars][cc-env-vars]).
  3. **Channels**, a research preview (section 1.4).
  4. **`claude --resume <id> "prompt"` typed at a terminal** sends the prompt to a running background session as its next turn and attaches. It refuses when input or output is piped or redirected, when session flags such as `--model` are given, and while the session waits on a question ([sessions][cc-sessions]). Observed (P2), from a script: "That session is running in the background (cece3725). Run `claude attach cece3725` to open it...".
  5. **Hooks add text only at hook points**: `additionalContext` from `SessionStart`, `UserPromptSubmit` or `PostToolUse`, a `Stop` block that continues the turn, or `asyncRewake` ([hooks][cc-hooks]).
  - Writing keystrokes into the TUI's terminal (a PTY write, `tmux send-keys`) also works, as the probes did, but it is not an interface.
- **Agent SDK.** The SDK runs headless sessions that it owns. It takes more input with `streamInput()`, and a message's `priority` decides what happens mid-turn: `next` is read "in the same turn, as soon as the tool calls it is running finish", `later` waits for a new turn, and `now` interrupts the turn (human-origin messages move running work to the background instead) ([TypeScript SDK][sdk-ts]).
  - SDK and `-p` sessions are stored like CLI sessions, and `claude --resume <session-id>` opens them in the TUI, although the picker hides them ([sessions][cc-sessions]).
  - There is no documented way to attach the SDK or `-p` to a running interactive TUI session or to subscribe to its stream. The research agent checked every 0.3.292 export, the `Options` type, the docs and both changelogs.
  - Terms the docs state, quoted without interpretation: "Unless previously approved, Anthropic does not allow third party developers to offer claude.ai login or rate limits for their products, including agents built on the Claude Agent SDK" ([SDK overview][sdk-overview]). The same policy does not "prevent an end user from signing in to the unmodified Claude Code binary with their own Claude subscription" ([legal][cc-legal]).
- **Resume.** `--resume <id|name|path>`, `--continue`, `--fork-session`; `--resume` works from any directory. Flags such as `--mcp-config`, `--settings`, `--plugin-dir` and `--add-dir` are not restored and must be passed again. Two terminals resuming one session without forking "interleave into one transcript" ([sessions][cc-sessions]).
- **Transcripts.** `~/.claude/projects/<project>/<session-id>.jsonl` (`<project>` is the cwd with non-alphanumerics replaced by `-`), kept 30 days (`cleanupPeriodDays`), format internal. The documented script interfaces are `claude -p --output-format json|stream-json`, `claude -p --resume`, `transcript_path` in hook and status-line input, and the Agent SDK ([sessions][cc-sessions]).

### 1.3 Instructions, skills, MCP, hooks, plugins

- **Instructions.** `CLAUDE.md` at managed, user (`~/.claude/CLAUDE.md`), project (`./CLAUDE.md`, `./.claude/CLAUDE.md`) and local (`CLAUDE.local.md`) scope, plus `.claude/rules/*.md` and `@path` imports ([memory][cc-memory]).
  - Since 2.1.277 Claude Code reads `AGENTS.md` natively, but by default only when no `CLAUDE.md`, `.claude/CLAUDE.md` or `CLAUDE.local.md` exists in the working directory or above it. The "Project instructions" setting `claude-md-and-agents-md` loads both ([memory][cc-memory], [changelog][cc-changelog]).
  - This repo has `AGENTS.md` and no `CLAUDE.md`, so Claude Code reads `AGENTS.md` here.
- **Skills.** `SKILL.md` folders; Claude Code skills "follow the Agent Skills open standard" ([skills][cc-skills]).
  - Locations: managed, `~/.claude/skills/`, `.claude/skills/` from the cwd up to the repo root, nested `.claude/skills/`, `--add-dir` directories, and plugins. `.agents/skills/` is not among them.
  - Standard frontmatter: `name`, `description`, `allowed-tools`, `license`, `compatibility`, `metadata`. Claude Code extensions include `disable-model-invocation`, `user-invocable`, `arguments`, `model`, `effort`, `context`, `agent`, `hooks` and `paths`.
  - This repo keeps skills in `.agents/skills/` and symlinks each one into `.claude/skills/` (local `ls -la .claude/skills`).
- **MCP.** `.mcp.json` (project), `~/.claude.json` (user and local), or `--mcp-config` for one session. Transports are stdio, HTTP, WebSocket and the deprecated SSE ([MCP][cc-mcp]).
- **Hooks** live in settings files, a plugin's `hooks/hooks.json`, and skill or agent frontmatter ([hooks][cc-hooks]).
- **Plugins.** `.claude-plugin/plugin.json` is optional. Default layout: `skills/`, `commands/`, `agents/`, `hooks/hooks.json`, `.mcp.json`, `.lsp.json`, `output-styles/`, `workflows/`, `themes/`, `monitors/`, `bin/`, `settings.json`. `--plugin-dir` or `--plugin-url` loads one for a session ([plugin reference][cc-plugins-ref]).
- **Import.** `claude import [codex|gemini|cursor]` imports another agent's configuration (local `claude import --help`); help does not itemize what it imports.

### 1.4 Channels

- **Still a research preview** in 2.1.292: "Channels are in research preview. They require Anthropic authentication through claude.ai or a Console API key", and "Neither `--channels` nor `--dangerously-load-development-channels` appears in `claude --help` while the feature is in preview" ([channels][cc-channels]). The feature arrived in 2.1.80 and the permission relay in 2.1.81 ([changelog][cc-changelog]).
- During the preview `--channels` accepts only plugins on an Anthropic-maintained allowlist or the organization's `allowedChannelPlugins`. A custom channel needs `--dangerously-load-development-channels`. Team and Enterprise organizations must set `channelsEnabled` ([channels][cc-channels]).
- New limitation: "On the v2 MCP client runtime, a channel can also fail to register because Claude Code doesn't register a channel server that negotiates protocol revision 2026-07-28" ([channels][cc-channels]).
- **Supported alternatives for pushing into a running session:** mods `$.prompt.submit` and the inbox socket (section 1.2). Remote Control drives a local session only from claude.ai or the Claude app; it needs a claude.ai subscription, and "API keys are not supported" ([Remote Control][cc-remote-control]).

### 1.5 Model and usage

- **Model:** `SessionStart.model` (observed `claude-haiku-4-5-20251001`, P1); status line `model.id`; the `PreModelSwitch`/`PostModelSwitch` hooks; `turn.complete.usage.model` in mods (P3).
- **Tokens and cost:**
  - status line `context_window.*` and `cost.total_cost_usd`, an "Estimated session cost in USD, computed client-side at list price ... May differ from your actual bill" ([status line][cc-statusline]);
  - OTel `claude_code.api_request` (`cost_usd`, tokens) ([monitoring][cc-monitoring]);
  - mods `session.measure` and `$.session.usage()` (`context`, `rateLimits`, `cost`) ([mods reference][cc-mods-reference]);
  - the SDK `result` message: `total_cost_usd`, `usage`, and per-model `modelUsage` ([TypeScript SDK][sdk-ts]); the cost fields "are client-side estimates, not authoritative billing data" ([cost tracking][sdk-cost]);
  - `claude -p --output-format json` returns usage and cost ([sessions][cc-sessions]).
- **Rate limits:**
  - status line `rate_limits.five_hour` and `seven_day` (`used_percentage`, `resets_at`), present "only for claude.ai Pro and Max subscribers" or behind a gateway with a spend limit ([status line][cc-statusline]);
  - mods `$.session.usage().rateLimits`;
  - SDK `rate_limit_event`, typed as "Rate limit information for claude.ai subscription users" (`sdk.d.ts` in [`@anthropic-ai/claude-agent-sdk`][sdk-repo] 0.3.292).

### 1.6 Permission and approval relays

- **`PermissionRequest` hook.** It "runs when Claude Code is about to ask you for permission to use a tool". It returns `hookSpecificOutput.decision` with `behavior` (`"allow"` grants, `"deny"` denies), `updatedInput` and `updatedPermissions` for allow, and `message` and `interrupt` for deny. Deny and ask rules are still evaluated, "so a hook returning `"allow"` doesn't override a matching deny rule" ([hooks][cc-hooks]). An `http` handler can carry the request to a host and wait up to its timeout (600 s by default).
  - Observed (P4): a hook that answered at once kept the TUI dialog from appearing.
  - Observed (P5): with a hook that slept 20 s and decided nothing, the TUI dialog was already showing 9 s in, while the hook still ran. For a `--permission-prompt-tool` or SDK host the docs say "the hooks run alongside your host, and whichever decides first applies" ([hooks][cc-hooks]). Whether a late hook decision closes a dialog that is already open was not tested.
  - **Questions go through the same hook.** Observed (P4): a hook returning `behavior: "allow"` with `updatedInput: {questions, answers: {"<question text>": "<option label>"}}` answered an `AskUserQuestion` with no dialog; the transcript read "Allowed by PermissionRequest hook". This `answers` format is documented for the SDK's `canUseTool` ([user input][sdk-user-input]); the hooks page does not mention it.
- **`PreToolUse`:** `permissionDecision` is `allow`, `deny`, `ask` or `defer`. `defer` parks the call for later and is honored only in `-p` and SDK runs ([hooks][cc-hooks]).
- **Mods:** `tool.check` returns `allow`, `ask` or `deny`. A `tool.call` hook can hold a call while it asks, or answer it with `{ result }` ([mods events][cc-mods-events]).
- **SDK `canUseTool`:** fires for tool approvals and for `AskUserQuestion`. It returns `{behavior: "allow", updatedInput, updatedPermissions}` or `{behavior: "deny", message, interrupt}`, and "can stay pending indefinitely" ([user input][sdk-user-input]).
- **Print mode:** `--permission-prompt-tool` names an MCP tool that answers. It is documented in the CLI reference but absent from `claude --help`. `--permission-prompts host|none` decides who answers ([CLI reference][cc-cli-reference], local help).
- **Channels permission relay:** research preview ([channels][cc-channels]).
- **Cross-session messages cannot approve:** "a message from another session never counts as your consent" ([cross-session messaging][cc-cross-session]).

## 2. Codex 0.160.0

**Architecture first.** In 0.160.0 the TUI is always a client of an app-server. The target is `Embedded`, `LocalDaemon` or `Remote` (`codex-rs/tui/src/lib.rs`).

- **The shared daemon is the default.** The plain `codex` TUI starts or reuses the shared local app-server daemon (`codex-rs/tui/src/startup_orchestration.rs`). The feature `daemon_auto_start` is `stable` and on (local `codex features list`); 0.157.0 shipped "#47179 Enable automatic daemon startup by default" ([releases][cx-releases]).
- **The daemon** runs `codex app-server --listen unix://`. Its socket is `$CODEX_HOME/app-server-control/app-server-control.sock`, a symlink to a real socket under `/tmp/codex-daemon-<euid>/` (`codex-rs/app-server-transport/src/transport/mod.rs`, `unix_socket.rs`; the symlink was observed in P7). Its README says it "is experimental and its lifecycle contract may change", and "Shared clients use the environment inherited when the daemon started… per-client environment isolation is not provided" (`codex-rs/app-server-daemon/README.md`).
- **Embedded mode** has no external surface: in-memory channels only (`codex-rs/app-server/src/in_process.rs`). It is forced by `--no-daemon`, `--profile`, `--oss`, and any `-c`, `--enable` or `--disable` override outside a short allow-list (`codex-rs/tui/src/daemon_startup.rs`).
- On this machine the daemon was not running when checked (`codex app-server daemon version` could not connect).

### 2.1 Session state signals

- **`thread/status/changed` (push).** Payload `{threadId, status}`, where `status` is `notLoaded`, `idle`, `systemError`, or `active` with `activeFlags` drawn from `waitingOnApproval` and `waitingOnUserInput` (generated 0.160.0 schema).
  - Derivation (`codex-rs/app-server/src/thread_status.rs`): `active` while a turn runs or any request is pending. `waitingOnApproval` while a command, file-change or permissions approval, or an MCP elicitation, is pending. `waitingOnUserInput` while an `item/tool/requestUserInput` question is pending. `systemError` after a core error, until the next turn.
  - It is broadcast to every initialized connection, subscribed or not (`codex-rs/app-server/src/message_processor.rs`). The change to `idle` is sent before `turn/completed`.
  - Observed (P6, P7): `active []` at turn start, `active [waitingOnApproval]` at the approval request, `active []` after the answer, `idle`, then `turn/completed`. A host client also received `thread/started` and status changes for an ephemeral helper thread the server started when a TUI turn began (`source: "vscode"`, `ephemeral: true`, later `notLoaded`). Status must therefore be keyed by `threadId`.
- **Turn and item events.** `turn/started`; `turn/completed` with `turn.status` `completed`, `interrupted` or `failed`; `error {error, willRetry}`; `item/started` and `item/completed` (types such as `userMessage`, `agentMessage`, `reasoning`, `commandExecution`, `fileChange`, `mcpToolCall`); deltas; `serverRequest/resolved` (schema).
  - These go only to connections subscribed to the thread. `thread/start`, `thread/resume` and `thread/fork` subscribe; `turn/start` does not (`codex-rs/app-server/src/request_processors/turn_processor.rs`).
  - There is no snapshot on connect. `thread/list` and `thread/read` return thread objects that "include runtime `status`"; `thread/loaded/list` returns only the IDs loaded in memory ([app-server][cx-app-server]).
  - After the last subscriber leaves and the thread has "no subscribers and no thread activity for 30 minutes", the server sends `thread/status/changed` to `notLoaded` and then `thread/closed` ([app-server][cx-app-server]).
- **Hooks.** Stable and on by default ("Hooks are enabled by default") ([hooks][cx-hooks]).
  - Twelve events: `SessionStart`, `SessionEnd`, `UserPromptSubmit`, `PreToolUse`, `PermissionRequest`, `PostToolUse`, `PreCompact`, `PostCompact`, `SubagentStart`, `SubagentStop`, `Stop`, `Interrupt` (`codex-rs/hooks/src/lib.rs`). "`Interrupt` runs when you interrupt an active turn on the main thread"; it can record the interruption but not prevent it ([hooks][cx-hooks]).
  - Configured in `hooks.json` or `[hooks]` beside each config layer (`~/.codex/`, `<repo>/.codex/`). Project hooks load only for trusted projects. "Before a non-managed hook can run, Codex requires you to review and trust the exact hook definition" ([hooks][cx-hooks]).
  - Handlers: `command` and `mcp_tool`. Common input: `session_id`, `transcript_path`, `cwd`, `hook_event_name`, `model`, plus `turn_id` for turn events ([hooks][cx-hooks]).
  - There is no notification, idle or waiting hook. The app-server reports hook runs as `hook/started` and `hook/completed` (schema).
- **`notify`.** `notify = [...]` in the user `config.toml` supports "currently only `agent-turn-complete`". The program gets one JSON argument: `{type, thread-id, turn-id, cwd, client, input-messages, last-assistant-message}` ([advanced config][cx-config-advanced]; `codex-rs/hooks/src/legacy_notify.rs`).
- **TUI notifications** (terminal only): `tui.notifications` types `agent-turn-complete`, `approval-requested`, `plan-mode-prompt`, `async-question`; delivered by OSC 9 or BEL, by default only when the terminal is unfocused (`codex-rs/tui/src/chatwidget/notifications.rs`, `notifications/mod.rs`).
- **`codex exec --json`:** `thread.started`, `turn.started`, `turn.completed {usage}`, `turn.failed`, `item.*`, `error`. It has no approval or state events, and exec runs with approval policy `never` ([non-interactive mode][cx-exec]; `codex-rs/exec/src/exec_events.rs`, `lib.rs`).
- **OpenTelemetry.** `[otel]` exporters. Events include `codex.conversation_starts`, `codex.api_request`, `codex.user_prompt`, `codex.tool_decision`, `codex.tool_result`, and `codex.turn_cost` (USD estimate, emitted only with an exporter configured) ([config reference][cx-config-reference]; `codex-rs/otel/`, `codex-rs/app-server/src/turn_cost_worker.rs`).
- **Does not exist:**
  - any external surface for an embedded TUI: no socket, state query or injection; only hooks, `notify`, OTel and the rollout file remain;
  - a waiting or idle hook;
  - a machine-readable `codex agents` (it is an interactive dashboard with no `--json`; local help).

### 2.2 Launch, attach, drive

- **Launch.** `codex [PROMPT]` with `-m`, `-C/--cd`, `--add-dir`, `-s`, `-a on-request|never`, `-c key=value`, `-p`, `--remote`, `--no-daemon`, `--worktree` (local `codex --help`).
  - Instructions come from config `developer_instructions` ("inserted as a `developer` role message") or `model_instructions_file`, or from `baseInstructions`/`developerInstructions` on `thread/start` (`codex-rs/config/src/config_toml.rs`; schema).
  - `-c developer_instructions=...` on the TUI forces embedded mode (`daemon_startup.rs`).
- **App server.** `codex app-server --listen` takes `stdio://` (JSONL), `unix://[PATH]` (WebSocket over the Unix socket), `ws://IP:PORT` (auth modes `capability-token` and `signed-bearer-token`) or `off` (local help; [app-server][cx-app-server]). The docs say: "The app-server command and WebSocket transport are experimental and aren't supported for production workloads".
  - Observed (P7): plain JSONL sent through `codex app-server proxy` got no answer, because the proxy copies raw bytes to the WebSocket socket (`codex_stdio_to_uds::run` in `codex-rs/cli/src/main.rs`). A minimal WebSocket client over the Unix socket worked without auth.
- **Several clients on one thread.** Subscriptions are per thread; notifications fan out to all subscribers; server requests go to every subscriber with the same id; pending requests are replayed to a client that attaches later (`codex-rs/app-server/src/outgoing_message.rs`, `thread_lifecycle.rs`).
- **Attaching the TUI to a host-owned server.** `codex --remote <addr>` starts a new thread; `codex resume --remote <addr> <id|name>` joins one. `fork`, `agents`, `queue`, `archive` and `delete` also take `--remote` (local help).
  - Observed (P7): the host started a thread and a turn; a TUI attached with `resume --remote` showed the host's prompt and its pending approval; approving in the TUI sent `serverRequest/resolved` to the host. A second host client subscribed with `thread/resume` received the turn that the human typed in the TUI.
  - Observed (P7): `codex resume --remote` on a thread with no turn yet failed with "no rollout found for thread id … (code -32600)". BCAS worked around this with `thread/inject_items`.
- **Driving.**
  - `turn/start` takes `UserInput` items: `text`, `image`, `localImage`, `audio`, `skill`, `mention`.
  - **`turn/start` while a turn is active steers that turn** instead of starting a new one; no new `turn/started` is sent (`turn_processor.rs`, `codex-rs/core/src/session/turn_input.rs`).
  - `turn/steer {threadId, expectedTurnId, input}` adds input to the active turn. Observed (P6): the steer text reached the model only after the in-flight response finished (about 100 s of essay), still within the same turn.
  - Also `turn/interrupt`, `thread/inject_items` (history only, no turn), `thread/revert` (`thread/rollback` was removed in 0.160.0), `review/start`, `command/exec`, `thread/shellCommand` (schema; [app-server][cx-app-server]).
- **Queue.** `codex queue --thread <id|name> --message <text> [--remote <addr>]` calls the experimental `thread/queue/add` (local help; `codex-rs/ext/queue/`). A queued message becomes a new turn when the thread is idle; it never steers, and it is not dispatched after an interrupt. Observed (P7): an idle TUI-attached thread started the queued turn at once, live in the TUI; a message queued while busy ran right after the current turn.
- **Resume and storage.** `thread/resume` rejoins a running thread, subscribes the caller and replays pending requests; `thread/list` and `thread/read` read without loading. The CLI has `codex resume [--last] [id|name]` and `codex fork`.
  - Rollouts live at `$CODEX_HOME/sessions/YYYY/MM/DD/rollout-<timestamp>-<uuidv7>.jsonl`, with `session_index.jsonl` and SQLite state (`state_5.sqlite`, `thread_history_1.sqlite`, `queue_1.sqlite`, ...) (local `ls`).
  - `Thread.path` is marked "[UNSTABLE]" (schema), and the hooks page says the "transcript format isn't a stable interface" ([hooks][cx-hooks]).

### 2.3 Instructions, skills, MCP, hooks, plugins

- **`AGENTS.md`.** Global `$CODEX_HOME/AGENTS.override.md`, else `AGENTS.md`. Then a walk from the project root (marker `.git`) down to the cwd, taking per directory the first of `AGENTS.override.md`, `AGENTS.md`, then `project_doc_fallback_filenames`. The result is capped at 32 KiB ([AGENTS.md][cx-agents-md]; `codex-rs/core/src/agents_md.rs`).
  - `CLAUDE.md` is read only if listed in `project_doc_fallback_filenames` (empty by default), only where no `AGENTS.md` exists, and never globally.
- **Skills.** `SKILL.md` frontmatter requires `name` (up to 64 characters) and `description` (up to 1,024); `agents/openai.yaml` adds metadata ([skills][cx-skills]; `codex-rs/ext/skills/src/loader/mod.rs`). Claude Code instead makes every field optional, with `name` defaulting to the directory name ([skills][cc-skills]).
  - Roots (`codex-rs/ext/skills/src/host_roots.rs`): `.agents/skills` in each directory from the project root to the cwd, `<repo>/.codex/skills`, `$HOME/.agents/skills`, `$CODEX_HOME/skills` (deprecated), system and admin roots (`/etc/codex/skills`), and plugins.
  - `.claude/skills` is not read; the external-agent import copies `~/.claude/skills` to `~/.agents/skills` ([app-server][cx-app-server], `externalAgentConfig`).
- **MCP.** `[mcp_servers.<name>]` in `config.toml`, stdio or streamable HTTP, with OAuth; `codex mcp add|list|...`. `codex mcp-server` has been removed ([MCP][cx-mcp]).
- **Plugins** are stable (`codex plugin add|list|marketplace|remove`). A plugin is `plugin.json` plus `skills/`, `mcp.json` and `hooks/hooks.json`. Codex also discovers `.claude-plugin/plugin.json` and `.claude-plugin/marketplace.json`; the docs say "OpenAI also accepts legacy and Claude-compatible manifests" ([plugins][cx-plugins]; `codex-rs/core-plugins/src/marketplace.rs`).
- **Hooks versus Claude Code.** Eleven of the twelve Codex event names match Claude Code's; Claude Code has no `Interrupt`. The JSON output fields overlap (`decision`, `hookSpecificOutput`). The docs claim no compatibility. The importer converts only `command` handlers on shared events and skips `async: true`, `asyncRewake` and similar (`codex-rs/external-agent-migration/src/hooks_cla.rs`). Codex sets `CLAUDE_PLUGIN_ROOT`/`CLAUDE_PLUGIN_DATA` "for compatibility with existing plugin hooks" ([hooks][cx-hooks]).

### 2.4 Pushing messages into a running session

- This needs the session to run on an app-server the host can reach: the shared daemon, or a server the TUI joined with `--remote`. The methods are `turn/start` (which steers when a turn is active), `turn/steer`, `codex queue` / `thread/queue/add`, `thread/inject_items` (no turn) and `thread/shellCommand` (sections 2.2, P6, P7).
- An embedded TUI has no direct path (`in_process.rs`). The research agent read in source that `codex queue` writes to a shared SQLite queue that an embedded server polls; this is inferred and was not tested.
- There is no equivalent of Claude Code channels, and none is needed for daemon or remote sessions.

### 2.5 Model and usage

- **Model:** `Thread.model`, `model` in `thread/start` and `thread/resume` responses, `model/rerouted`, `model/list`; turns carry no model field (schema). The attached TUI showed "GPT-6.1-Sol high" (P7).
- **Tokens:** `thread/tokenUsage/updated {total, last, modelContextWindow}`, each with input, cached, cache-write, output and reasoning tokens (schema; observed in P6).
- **Rate limits:** `account/rateLimits/read` and `account/rateLimits/updated` carry `primary` and `secondary` windows (`usedPercent`, `windowDurationMins`, `resetsAt`), credits and plan type (schema). P6 observed `usedPercent: 6` with a 10,080-minute window.
- **USD:** none in turn events, `exec --json`, `notify`, hooks or `/status`. Estimates come only from `account/usage/read {threadId}` (ChatGPT sign-in) and the OTel `codex.turn_cost` event (schema; `account_processor.rs`, `turn_cost_worker.rs`).

### 2.6 Permission and approval relays

- **Server-to-client requests** (schema):
  - `item/commandExecution/requestApproval`, answered with `accept`, `acceptForSession`, `acceptWithExecpolicyAmendment`, `applyNetworkPolicyAmendment`, `decline` (the turn continues) or `cancel` (the turn is interrupted);
  - `item/fileChange/requestApproval`;
  - `item/permissions/requestApproval`, answered with the granted subset and a `turn` or `session` scope;
  - `item/tool/requestUserInput`, answered with answers per question id;
  - `mcpServer/elicitation/request`, answered with `accept`, `decline` or `cancel`.
- **With several clients attached,** every subscriber gets the request and the first response wins. `serverRequest/resolved` then goes to all subscribers, and a remote TUI dismisses its prompt. A late attacher gets replays, and turn transitions cancel pending requests (`outgoing_message.rs`, `codex-rs/tui/src/app/app_server_events.rs`; observed in P7).
- **Answering without a human:** approval policy `on-request`, `never` or `granular` (`untrusted` is internal; `-a` offers only `on-request|never`); `approvals_reviewer = auto_review` or `--approve-for-me`; the `PermissionRequest` hook (`allow`/`deny`, any `deny` wins); `PreToolUse` deny or rewrite ([hooks][cx-hooks]; schema).

## 3. OpenCode 2.0.24

OpenCode 2.x is a rewrite. No GitHub release notes exist for any 2.x tag. The breaking changes are on the "Migrate from V1" page: "V1 plugin implementations do not run in V2" and "The server API and clients have new contracts" ([migrate][oc-migrate]). The server's OpenAPI document (served at `/openapi.json`; the same 141 operations as [the published one][oc-openapi]) describes itself as an "Experimental HttpApi surface for selected instance routes".

### 3.1 Session state signals

- **Event stream (push): `GET /api/event`** (server-sent events), global across locations; every event carries `location.directory`.
  - The OpenAPI document calls it "Volatile by contract: a slow consumer overflows and fails the stream, and events during disconnection are missed". The client docs say: "Subscriptions are live-only, with no replay or automatic reconnection" ([client][oc-client]).
  - Frames are `data: {id, type, created, location, data}` with a heartbeat comment every 15 s (`packages/server/src/event-feed.ts`). The OpenAPI document types the payload as an opaque string, so the union below comes from source (`packages/schema/src/`):
    - turn: `session.execution.started`, `.succeeded`, `.failed {error}`, `.interrupted {reason: user|shutdown|superseded|inactivity}`;
    - steps and tools: `session.step.started {agent, model}`, `session.step.ended {finish, cost, tokens}`, `session.tool.called`, `.success`, `.failed`, `session.retry.scheduled`;
    - approval: `permission.asked {id, sessionID, action, resources, save, source}`, `permission.replied {requestID, reply: once|always|reject}`;
    - question: `form.created`, `form.replied`, `form.cancelled`; the 2.x `question` tool checks the permission action `question` and then opens a form with `metadata.kind: "question"` (`packages/core/src/tool/plugin/question.ts`);
    - input queue: `session.inbox.enqueued`, `session.inbox.delivered`;
    - usage: `session.usage.updated {cost, tokens}`.
- **Snapshot (poll): `GET /api/session/active`** returns `{data: {"ses_...": {type: "running"}}}`. "Sessions absent from the result are inactive", and `running` is the only value (OpenAPI).
  - Pending approvals and questions: `GET /api/session/{id}/permission` and `GET /api/session/{id}/form`.
  - `POST /api/experimental/session/{id}/wait` is an experimental "Wait for a session agent loop to become idle" barrier (OpenAPI).
- **The official TUI derives state the same way.** On `server.connected` it calls `session.active`. It marks a session running on `session.execution.started` and idle on `succeeded`, `failed` or `interrupted`, and tracks pending approvals from the `permission.*` and `form.*` events (`packages/client/src/solid/data.ts`).
- **Observed (P8, isolated server):**
  - A prompt produced `session.inbox.enqueued`, `session.execution.started`, `session.step.started`, `session.tool.called`, then `permission.asked`.
  - While the approval was pending, `GET /api/session/active` still said `running`, and `GET /api/session/{id}/permission` listed the request.
  - After the reply: `permission.replied`, `session.tool.success`, `session.step.ended`, `session.usage.updated`, `session.execution.succeeded`. `session/active` then returned `{}`.
- **Plugins** receive public events through `ctx.event.subscribe()`. There is no all-events or status hook (`packages/core/src/plugin/host.ts`).
- **Does not exist:**
  - **a published `session.status` or `session.idle`.** Both remain in the schema, and the plugin migration page's example still uses `session.idle`, but nothing publishes them (source grep; [plugin migration][oc-plugins-migrate]);
  - **a status for "waiting for approval" or "waiting for the human".** It must be derived as running plus a pending permission or form (observed, P8);
  - **replayable event history from the shipped server.** The experimental session log returns only a `log.synced` marker, because event persistence is off (`packages/core/src/bus.ts`; the research agent's live check).

### 3.2 Launch, attach, drive

- **Architecture.** The TUI never embeds a server. It is a client of the shared per-user background service, of a private child (`--standalone`), or of an explicit `--server <url>` (local `opencode --help`; `packages/cli/src/services/`).
  - The service is `opencode serve --service`, started on demand by client commands and detached, so it survives the terminal. It listens on `127.0.0.1:49374` by default ([web][oc-web]).
  - Discovery: "reading [the registration file] is all a client needs to connect". The file is `~/.local/state/opencode/service.json` with `{id, version, url, pid, password}` (`packages/client/src/effect/service.ts`).
  - A TUI of another version replaces the service ("Restarting background server (version mismatch)...") (`packages/cli/src/commands/handlers/default.ts`).
  - `opencode serve` and the service return byte-identical OpenAPI documents (the research agent's comparison).
- **Auth.** HTTP Basic with user `opencode` and the server password (`OPENCODE_PASSWORD`). TCP only, no Unix socket (`packages/server/src/auth.ts`).
- **Launch.** `opencode [directory] [--session <id>] [--continue] [--prompt <text>] [--auto] [--standalone | --server <url>]` (local help).
  - The root command has no `--model`, `--agent` or `--port` flag; `opencode run` and `opencode mini` take `--model` and `--agent`.
  - A host can create the session first with `POST /api/session {agent, model, location}` and open it with `opencode --session <id>`. A missing `--session` ID "becomes the ID of the session the first prompt creates" (`handlers/default.ts`).
  - `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT` and `OPENCODE_CONFIG_DIR` are read by the server process, so a running service ignores a new client's environment (`packages/cli/src/server-process.ts`, `packages/client/src/service-contender.ts`).
- **Several clients on one server.** The design targets "N connected TUIs" (`specs/v2/`).
  - Observed (P8): a TUI started with `opencode --server <url> -s <id>` rendered, live, a shell command, a prompt and its answer, a permission dialog and a question form, all created by the host through the API.
  - A host reply cleared the TUI's dialog, and an answer given in the TUI reached the host as `permission.replied`.
- **Driving.**
  - `POST /api/session/{id}/prompt {text, delivery: "steer"|"queue", resume?}` ("Durably admit one session input and schedule agent-loop execution").
  - Also `POST .../synthetic`, `.../command`, `.../shell`, `.../interrupt`, and `PATCH|DELETE .../inbox/{id}` to re-route or cancel pending input (OpenAPI).
  - The 1.x routes (`/event`, `/global/event`, `/tui/*`, `prompt_async`) and the `attach`, `web` and `export` commands are gone (OpenAPI; local help; [migrate][oc-migrate]).
- **SDKs.** `@opencode/client` 2.0.24 (`OpenCode.make`, `event.subscribe()`, `Service.discover/ensure/stop`) and `@opencode/sdk` 2.0.24, an in-process host that "opens no HTTP listener". The older `@opencode-ai/sdk` stays on 1.x ([client][oc-client], [SDK][oc-sdk]).
- **ACP.** `opencode acp` runs an Agent Client Protocol server on its own private server (local help; `packages/cli/src/commands/handlers/acp.ts`).
- **Resume and storage.** `--continue`, `--session <id>`; `opencode session list|delete|export|import`.
  - One SQLite database, `~/.local/share/opencode/opencode.db` (WAL), which `OPENCODE_DB` overrides ([troubleshooting][oc-troubleshooting]; `packages/cli/src/database-path.ts`).
  - In service mode an interrupted turn resumes with a synthetic "The server restarted while you were working…" message (`packages/core/src/session/execution/restart.ts`).

### 3.3 Instructions, skills, MCP, hooks, plugins

- **Instructions.** "OpenCode V2 recognizes AGENTS.md only. It does not use CLAUDE.md as a fallback" ([instructions][oc-instructions]).
  - It reads global `~/.config/opencode/AGENTS.md`, then every `AGENTS.md` from the working directory upward; nested ones load when a file under them is read (`packages/core/src/config/plugin/instruction.ts`).
  - The `instructions` config key "does not currently resolve its files, glob patterns, or URLs" ([instructions][oc-instructions]).
- **Skills.** `SKILL.md` folders or flat `*.md` files; frontmatter `name`, `description`, `disable-model-invocation`, `metadata["opencode/autoinvoke"]`.
  - Loaded from `.opencode/skill(s)/`, `~/.config/opencode/skill(s)/`, `.claude/skills/`, `~/.claude/skills/`, `.agents/skills/` and `~/.agents/skills/`. The research agent confirmed this by planting files on an isolated server (`packages/core/src/config/plugin/skill-file.ts`, `compatibility.ts`).
- **Commands and agents** load only from `.opencode/` and `~/.config/opencode/`; `.claude/agents` and `.claude/commands` are not read (`packages/core/src/config/plugin/command.ts`, `agent.ts`).
- **MCP.** `mcp.servers.<name>` is `{type: "local", command[]}` or `{type: "remote", url, oauth?}`, with OAuth on by default for remote servers ([MCP servers][oc-mcp]). `.mcp.json` is not read.
- **Hooks and plugins.**
  - Plugins are JavaScript modules (`{id, setup(ctx)}`) from `plugin/` or `plugins/` in `.opencode/` and `~/.config/opencode/`, or npm and git specs in config ([plugins][oc-plugins]).
  - Hook points: `tool.hook("execute.before"|"execute.after")`, `permission.hook("evaluate")`, `session.hook("prompt"|"context"|...)`, `shell.hook("create.before")`.
  - Claude Code hooks (`settings.json`), Claude plugins and OpenCode 1.x plugins do not run ([migrate][oc-migrate]; source grep).

### 3.4 Pushing messages into a running session

- `POST /api/session/{id}/prompt` with `delivery: "steer"` injects at the next step boundary of a running loop; `"queue"` waits for the turn to end. The TUI itself works the same way: "While OpenCode is working, Enter steers the active session; press Ctrl+X, then Enter to queue the prompt for later" ([TUI][oc-tui]). `POST .../synthetic` admits synthetic input. P8 saw API input appear live in the TUI.
- There is no equivalent of Claude Code channels. Nothing publishes the `tui.*` events, so a host cannot type into a TUI's composer (source grep).

### 3.5 Model and usage

- **Per message:** each assistant message carries `model {id, providerID, variant?}`, `tokens {input, output, reasoning, cache {read, write}}` and `cost`. The cost is USD computed locally from catalog prices (`packages/core/src/session/usage.ts`; OpenAPI).
- **Totals:** sessions carry cumulative `cost` and `tokens`, and `session.usage.updated` streams them after each step (observed, P8). `GET /api/experimental/session/stats` and `opencode stats` aggregate; `GET /api/model` and `/api/provider` list models with limits and prices (OpenAPI; local help).
- **Rate limits are not surfaced.** The provider layer parses rate-limit headers, but clients see only the error types `provider.rate-limit` and `provider.quota`, plus `session.retry.scheduled` (`packages/ai`, `toSessionError`).

### 3.6 Permission and approval relays

- **Rules.** `permissions: [{action, resource, effect: allow|deny|ask}]`; the last match wins, and no match means ask. The base policy allows almost everything, so shell and edit do not prompt by default ([permissions][oc-permissions]).
- **Reply.** `POST /api/session/{id}/permission/{requestID}/reply {decision: "once"|"always"|"reject", message?}`. `reject` also rejects every other pending request of the session; `always` saves the request's `save` patterns as project rules (OpenAPI; `packages/core/src/permission.ts`).
- **Questions.** `POST .../form/{formID}/reply {answer: {q0: ...}}`, or `DELETE .../form/{formID}` to dismiss (OpenAPI; observed, P8).
- **Plugin relay.** `permission.hook("evaluate")` can set `allow`, `ask` or `deny` plus a message; an explicit configured deny is final ([plugins][oc-plugins]).
- **Races** (source):
  - A TUI in auto-accept mode (`--auto`, or `cli.json` `session.permissions: "autoaccept"`) answers `once` for every pending request of the session it shows (`packages/tui/src/routes/session/index.tsx`).
  - `opencode run` rejects requests for the sessions it owns (`packages/cli/src/run/noninteractive.ts`).
  - Pending requests live in memory per location and are dropped when a location is evicted after 60 minutes without session events. This is inferred from `packages/core/src/location-activity.ts`.

## 4. Comparison

| | Claude Code 2.1.292 | Codex 0.160.0 | OpenCode 2.0.24 |
|---|---|---|---|
| Server the host can join for an interactive session | None. A supervisor runs `--bg` sessions, but it exposes no protocol | App-server: the shared daemon by default, or the host's own (`--listen unix://`, `ws://`) | Shared background service on 127.0.0.1:49374, or the host's own `opencode serve` |
| State push | Hooks and mods, from inside each session; OTel | `thread/status/changed`, broadcast to every client | SSE `/api/event` (`session.execution.*`) |
| State poll | `claude agents --json`: `busy`, `waiting`, `idle` + `waitingFor` | `thread/read`, `thread/list` (threads carry `status`) | `GET /api/session/active` (`running` only) |
| Waiting for approval | Registry `waitingFor: permission prompt`; `PermissionRequest` hook | `active` + `waitingOnApproval` | Derived: running + `permission.asked` pending |
| Waiting for the human's answer | Registry `input needed`; `PermissionRequest` with `tool_name: AskUserQuestion` | `active` + `waitingOnUserInput` | Derived: running + `form.created` pending |
| Turn start and end | `UserPromptSubmit` / `Stop`; mods `turn.start` / `turn.complete` | `turn/started` / `turn/completed` (`completed`, `interrupted`, `failed`) | `session.execution.started` / `.succeeded`, `.failed`, `.interrupted` |
| User interrupt | No settings hook (observed); mods `turn.complete.isAborted`; registry goes `idle` | `Interrupt` hook; `turn.status: interrupted` | `session.execution.interrupted {reason: user}` |
| TUI attached to a session another process drives | `claude --bg`, then `claude attach` (several clients observed) | `codex resume --remote` / `--remote`; daemon-attached TUI by default | `opencode --server <url> --session <id>`; several TUIs supported |
| Host injects a message | Mods `$.prompt.submit` (waits for idle); inbox socket (message format undocumented); channels (preview) | `turn/start` (steers if busy), `turn/steer`, `codex queue` (experimental) | `prompt` with `delivery: steer` or `queue`; `synthetic` |
| Host answers approvals | `PermissionRequest` hook (races the dialog); mods `tool.check`; SDK `canUseTool` | Server requests; first answer wins, `serverRequest/resolved` to all | Reply endpoint; TUI clears; `permission.hook("evaluate")` |
| Host answers questions | `PermissionRequest` hook with `answers` (observed, undocumented for hooks); SDK `canUseTool` | `item/tool/requestUserInput` response | Form reply endpoint |
| Session store | JSONL per session, format internal | Rollout JSONL + SQLite; `Thread.path` "[UNSTABLE]" | One SQLite database |
| Resume | `--resume <id>`, `--continue` | `thread/resume`, `codex resume` | `--session <id>`, `--continue` |
| Instructions | `CLAUDE.md`; `AGENTS.md` only when no `CLAUDE.md` | `AGENTS.md`; `CLAUDE.md` only through `project_doc_fallback_filenames` | `AGENTS.md` only |
| Skill directories | `.claude/skills`, `~/.claude/skills` | `.agents/skills`, `~/.agents/skills`, `.codex/skills` | `.opencode/`, `.claude/`, `.agents/` skills, project and global |
| MCP config | `.mcp.json`, `~/.claude.json` | `[mcp_servers]` in `config.toml` | `mcp.servers` in OpenCode config |
| Extension code | Settings hooks (shell, HTTP, MCP tool), mods (JS), plugins | Hooks (Claude-like JSON), plugins (accept Claude manifests) | JS plugins (v2 API only) |
| Model in use | `SessionStart.model`, status line, mods | `Thread.model`, `thread/start` response | `session.step.started.model`, message `model` |
| Tokens and cost | Status line, OTel, SDK `result`, mods (client-side estimates) | `thread/tokenUsage/updated`; USD only via `account/usage/read` and OTel | Per message and per session, local USD estimate |
| Rate limits | Status line `rate_limits` (Pro, Max), mods, SDK `rate_limit_event` | `account/rateLimits/read` and `updated` | Not surfaced |
| Push channel into a session | Channels: research preview | Not needed (server API) | Not needed (server API) |
| Stability labels | Agent view: research preview; channels: research preview; mods: on by default | App-server and daemon: experimental; hooks and plugins: stable | HTTP API: "Experimental HttpApi surface" |

## 5. Implications for the adapter contract (facts, not decisions)

- **State arrives in two topologies.** Codex and OpenCode push state over a connection that the host opens to their server. Claude Code delivers state from inside each session (hooks, mods, OTel) and through a polled command. An adapter interface that only "subscribes to a server" cannot cover Claude Code, and one that only "receives in-session callbacks" leaves the Codex and OpenCode servers unused.
- **"Waiting" has three different encodings.**
  - Codex names it: `waitingOnApproval` versus `waitingOnUserInput`.
  - Claude Code names it in the registry (`waitingFor`) and in hooks (`PermissionRequest`, with `tool_name` separating a question from an approval).
  - OpenCode does not name it at all; it is running plus a pending permission or form.
- **Turn end and interrupt differ.** Claude Code's `Stop` hook misses user interrupts, but mods `turn.complete` and the registry catch them. Codex reports `interrupted` in `turn/completed` and has an `Interrupt` hook. OpenCode reports `session.execution.interrupted`.
- **Approvals race in every harness.**
  - Codex: the first response wins, and `serverRequest/resolved` tells the other clients.
  - OpenCode: replies emit `permission.replied`, and a TUI in auto-accept mode answers by itself.
  - Claude Code: a slow `PermissionRequest` hook runs while the TUI dialog is already open (observed); for SDK hosts the docs say whichever decides first applies.
  - A relay that renders approvals in cland coexists with the harness's own prompt in all three.
- **Injection semantics differ.** Steering (into the running turn) and queueing (as the next turn) are explicit in Codex (`turn/start` or `turn/steer` versus `codex queue`) and in OpenCode (`delivery: steer|queue`). Claude Code's documented routes are queue-like (mods `$.prompt.submit` waits for idle) or deliver between tool calls (the inbox socket, whose message format is undocumented). Channels remain a research preview.
- **Session placement constrains configuration.**
  - The Codex daemon and the OpenCode service are shared per user and keep the environment they started with.
  - In Codex, a per-session `-c` override (including `developer_instructions`) moves the TUI into embedded mode, which has no external surface. Per-session settings can instead go through `thread/start` and `--remote`.
  - A fresh Codex thread cannot be resumed by a TUI until it has a turn or injected items.
  - OpenCode root flags cannot pick a model; `POST /api/session` can.
- **Session identity.** Claude Code accepts a host-chosen UUID (`--session-id`). OpenCode creates a session under a host-chosen `--session` ID on the first prompt. Codex thread IDs come from the server (UUIDv7), and `thread/start` has no ID parameter (schema).
- **Portability needs adapters for MCP and hooks, not for instructions or skill bodies.**
  - `AGENTS.md` alone reaches all three, but Claude Code ignores it once any `CLAUDE.md` exists.
  - `SKILL.md` bodies are shared, but the directories differ. This repo's layout (`.agents/skills` plus symlinks in `.claude/skills`) is read by all three. OpenCode scans both directories, so it sees each skill twice; how it resolves the duplicate names was not checked.
  - A skill written for Claude Code without a `name` field does not meet Codex's required frontmatter.
  - MCP config is JSON in Claude Code, TOML in Codex and OpenCode's own JSON schema.
  - Hook definitions are similar between Claude Code and Codex and unrelated in OpenCode.
- **A common editor protocol exists, but it replaces the TUI.** OpenCode ships `opencode acp`. For Claude Code and Codex, Agent Client Protocol adapters are maintained by the ACP project, not by Anthropic or OpenAI: [claude-agent-acp][acp-claude] (v0.87.0, built on the Claude Agent SDK) and [codex-acp][acp-codex] (v2.1.1, built on the Codex App Server). Through ACP the client renders the conversation itself instead of running the harness's own TUI.
- **Usage data is uneven.** Claude Code and OpenCode report client-side USD estimates per session. Codex reports tokens in events and USD only through `account/usage/read` and OTel. Rate-limit windows exist in Claude Code (subscription sign-in only) and in Codex; OpenCode has none.
- **What BCAS did is now partly supported.**
  - BCAS read the model from the private transcript and quota from an undocumented OAuth endpoint. Claude Code now documents `SessionStart.model`, status line `rate_limits` and mods `$.session.usage()`.
  - BCAS's Codex pattern (app-server on a Unix socket, `resume --remote`, `inject_items` for an empty thread) still matches 0.160.0. The plain TUI now defaults to a shared daemon, and `codex queue` exists.
- **Labels to track.** Claude Code agent view and channels are research previews. The Codex app-server, its WebSocket transport and the daemon are experimental. The OpenCode 2.x HTTP API calls itself experimental, and its docs and source disagree in places (`session.idle`, `instructions`).

## Appendix: local probes (2026-10-07)

Scripts and logs are in the session scratchpad and are not committed. Model use: Claude Code on the user's Claude Max subscription (Haiku 4.5); Codex on the user's ChatGPT Pro sign-in; OpenCode on an OpenRouter key inherited from the environment, about $0.03 in locally computed cost.

- **P1. Claude Code TUI with hooks.** Interactive session in tmux with `--settings` command hooks logging 19 events, and `claude agents --json` plus `~/.claude/sessions/*.json` polled every second. Steps: a Bash approval, an `AskUserQuestion` question, an Esc interrupt, `/exit`.
- **P2. Claude Code background session.** `claude --bg`, `claude agents --json --all`, two simultaneous `claude attach` clients, and `claude -p --resume` from a script (refused).
- **P3. Claude Code mod** loaded with `--plugin-dir`: `turn.*`, `tool.check`, `session.*`; `$.prompt.submit` from a timer, both when idle and during an approval; an Esc interrupt.
- **P4. Claude Code `PermissionRequest` hook** answering `AskUserQuestion` with `updatedInput.answers`.
- **P5. Claude Code slow `PermissionRequest` hook** (sleeps 20 s, no decision); the dialog appeared while it ran.
- **P6. Codex `codex app-server` over stdio:** an approval round trip, `turn/steer` into a long turn, token and rate-limit notifications.
- **P7. Codex `codex app-server --listen unix://`:** a host client speaking WebSocket over the Unix socket, a TUI via `codex resume --remote` (before and after the first turn), approval from the TUI, a second subscribed host client, and `codex queue --remote` when idle and when busy.
- **P8. OpenCode isolated `opencode serve`** (HOME and XDG redirected, own password) with a TUI attached via `--server`: API-created shell command, permission and form, host and TUI replies, a prompt with a tool approval while polling `session/active`.

[cc-llms]: https://code.claude.com/docs/llms.txt
[cc-changelog]: https://github.com/anthropics/claude-code/blob/main/CHANGELOG.md
[cc-agent-view]: https://code.claude.com/docs/en/agent-view
[cc-hooks]: https://code.claude.com/docs/en/hooks
[cc-mods-overview]: https://code.claude.com/docs/en/plugins/mods/overview
[cc-mods-create]: https://code.claude.com/docs/en/plugins/mods/create
[cc-mods-events]: https://code.claude.com/docs/en/plugins/mods/events
[cc-mods-api]: https://code.claude.com/docs/en/plugins/mods/api
[cc-mods-reference]: https://code.claude.com/docs/en/plugins/mods/reference
[cc-monitoring]: https://code.claude.com/docs/en/monitoring-usage
[cc-statusline]: https://code.claude.com/docs/en/statusline
[cc-sessions]: https://code.claude.com/docs/en/sessions
[cc-cross-session]: https://code.claude.com/docs/en/cross-session-messaging
[cc-env-vars]: https://code.claude.com/docs/en/env-vars
[cc-channels]: https://code.claude.com/docs/en/channels
[cc-remote-control]: https://code.claude.com/docs/en/remote-control
[cc-memory]: https://code.claude.com/docs/en/memory
[cc-skills]: https://code.claude.com/docs/en/skills
[cc-mcp]: https://code.claude.com/docs/en/mcp
[cc-plugins-ref]: https://code.claude.com/docs/en/plugins-reference
[cc-headless]: https://code.claude.com/docs/en/headless
[cc-cli-reference]: https://code.claude.com/docs/en/cli-reference
[cc-legal]: https://code.claude.com/docs/en/legal-and-compliance
[sdk-overview]: https://code.claude.com/docs/en/agent-sdk/overview
[sdk-ts]: https://code.claude.com/docs/en/agent-sdk/typescript
[sdk-hosting]: https://code.claude.com/docs/en/agent-sdk/hosting
[sdk-user-input]: https://code.claude.com/docs/en/agent-sdk/user-input
[sdk-cost]: https://code.claude.com/docs/en/agent-sdk/cost-tracking
[sdk-repo]: https://github.com/anthropics/claude-agent-sdk-typescript
[cx-llms]: https://learn.chatgpt.com/docs/llms.txt
[cx-src]: https://github.com/openai/codex/tree/rust-v0.160.0
[cx-releases]: https://github.com/openai/codex/releases
[cx-app-server]: https://learn.chatgpt.com/docs/app-server
[cx-hooks]: https://learn.chatgpt.com/docs/hooks
[cx-config-advanced]: https://learn.chatgpt.com/docs/config-file/config-advanced
[cx-config-reference]: https://learn.chatgpt.com/docs/config-file/config-reference
[cx-exec]: https://learn.chatgpt.com/docs/non-interactive-mode
[cx-agents-md]: https://learn.chatgpt.com/docs/agent-configuration/agents-md
[cx-skills]: https://learn.chatgpt.com/docs/build-skills
[cx-mcp]: https://learn.chatgpt.com/docs/extend/mcp
[cx-plugins]: https://developers.openai.com/plugins/build/plugins
[oc-v2-llms]: https://opencode.ai/v2/llms.txt
[oc-src]: https://github.com/anomalyco/opencode/tree/v2.0.24
[oc-openapi]: https://opencode.ai/v2/openapi.json
[oc-migrate]: https://opencode.ai/v2/docs/migrate-v1/
[oc-client]: https://opencode.ai/v2/docs/build/client/
[oc-sdk]: https://opencode.ai/v2/docs/build/sdk/
[oc-plugins]: https://opencode.ai/v2/docs/build/plugins/
[oc-plugins-migrate]: https://opencode.ai/v2/docs/build/plugins/migrate-v1/
[oc-web]: https://opencode.ai/v2/docs/cli/web/
[oc-tui]: https://opencode.ai/v2/docs/cli/tui/
[oc-instructions]: https://opencode.ai/v2/docs/instructions/
[oc-permissions]: https://opencode.ai/v2/docs/permissions/
[oc-mcp]: https://opencode.ai/v2/docs/mcp-servers/
[oc-troubleshooting]: https://opencode.ai/v2/docs/troubleshooting/
[acp-claude]: https://github.com/agentclientprotocol/claude-agent-acp
[acp-codex]: https://github.com/agentclientprotocol/codex-acp
