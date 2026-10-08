# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames (protocol 2): `hello`, `welcome`, `error`, request `result`, `deliver` and the spoke's `ack` of it; the heartbeat interval and the frame size limit. The client hello (it carries the secret on the Unix socket), the client requests `hub.status`, `hub.stop`, `topic.*`, `subscribe`, the pushed events `message`, `delivery` and `session.state`, the `inject` frame to an in-session bridge; session states and the process table's view. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, topics, messages (each in a topic), per-addressee deliveries (queued → delivered on the spoke's ack → injected on the adapter's confirmation, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. The thresholds are constants for now. |
| `src/hub/core.ts` | Presence, names keyed to session ids, same-session takeover, routing, store-and-forward with acks, the standing topics, the human's messages, each session's state (set only through the adapters), the events subscribed clients receive. Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests and acks, client requests (`hub.status`, `hub.stop`, `topic.*`, `subscribe`), the `task.*` requests from either, the `session.*` requests (`src/adapters/requests.ts`), refusals. A spoke's frames count only while its socket is open and still holds the session's name. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/server.ts` | The hub without listeners (`createHubBase`: core, dispatcher, prune) and the WebSocket edge (bearer secret check, frame size limit, heartbeat sweep). `createHub` is both, with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. Bound under a private name and renamed into place; on close it removes the path only while the path is still the socket it bound. |
| `src/hub/lines.ts` | The JSON-lines framing both byte-stream edges share: complete lines split off first, each held to the frame limit on its own, then only the unfinished remainder. |
| `src/hub/stdio.ts` | The stdio edge for a UI that spawned the hub as its child (`cland hub serve --stdio`): JSON lines on stdin and stdout, no secret, the hub stops when stdin ends. |
| `src/hub/lock.ts` | The project's hub lock, `.cland/hub.lock`: created whole or not at all, holding the holder's pid and process start time; a stale one (pid gone, or reused by a process started at another time) is broken under a guard. |
| `src/hub/daemon.ts` | The hub serving one project in the background: the lock taken first, `.cland/` prepared, store on `hub.db`, both edges bound, the adapters plugged in, `hub.json` written last; the launched sessions re-found once it is reachable. Shutdown runs backwards: edges closed, `hub.json` removed, the lock released last. For a stdio hub the listeners are optional (below). |
| `src/adapters/contract.ts` | The adapter contract (spec 4.3) and its capability table; the message envelope a harness reads. |
| `src/adapters/processes.ts` | The process table: the harness processes the hub launched, in `hub.db` (table `harness_processes`), through a connection of its own. |
| `src/adapters/sessions.ts` | The hub's side of the adapters: launch, attach, stop, resume, the state signals, and the delivery pipeline's last stage (delivered → inject → injected). Transport-free. |
| `src/adapters/requests.ts` | The `session.*` frames and their handler. |
| `src/adapters/claude-code.ts` | The Claude Code adapter. |
| `src/adapters/index.ts` | The adapters a project's hub runs with, and their timings from the environment. |
| `mod/cland/` | The cland mod, loaded into every Claude Code session the hub launches (`--plugin-dir`): it submits the hub's messages as turns and reports turn starts and ends. |
| `src/project.ts` | The `.cland/` layout, the managed `.gitignore`, the secret, the discovery file, finding the project root. |
| `src/tracker/item.ts` | The item file format: frontmatter, body, comments, verdicts; parse (lenient for hand edits) and serialize. |
| `src/tracker/index-db.ts` | The tracker's index (items, labels, blockers, verdicts), its id high-water mark and the claims: tables of their own in `hub.db`, through a connection of their own. |
| `src/tracker/tracker.ts` | The tracker: writes the item files (serialized, atomic), watches `.cland/tasks/` and re-indexes hand edits, holds claims. |
| `src/tracker/import-github.ts` | The hub's side of the GitHub import (`task.import`): issues to items, found again by their `github` reference, written only when their text changes. |
| `src/tracker/requests.ts` | The `task.*` request frames and their handler, called from the dispatcher for spokes and clients alike. |
| `src/cli/hub.ts` | `cland hub start`, `status`, `stop`, `serve [--stdio]`. |
| `src/cli/task.ts` | `cland task create`, `view`, `list`, `comment`, `edit`, `close`, `link`, `claim`. |
| `src/cli/session.ts` | `cland session launch`, `list`, `attach`, `stop`, `resume`. |
| `src/cli/open.ts` | `cland open [dir]`, and `cland` with no command on a terminal: the project's hub started if none runs, then the workbench (`nvim/bin/cland-nvim`) on the project's root. |
| `src/cli/hook.ts` | `cland hook <event>`, run from inside a launched session by its hooks and the mod; `cland hook bridge`, the mod's connection to the hub. |
| `src/cli/task-import.ts` | `cland task import-github`: reads the issues through `gh` and sends them to the hub in `task.import` frames. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, asks again for the name it was welcomed under, retries a requested name before taking a generated one, stops on a same-session takeover (close code 4002). Acks every delivery and hands each message id to the session once. Fails a request after its deadline, heartbeats while connected and reconnects after two unanswered heartbeats; before the welcome, a hub that does not answer the hello within the request deadline is left and reconnected to. |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send` (into a topic, to the human or to sessions), `who`, `status`, `rename`, `history`, `session.launch` and the `task.*` tools (`src/spoke/task-tools.ts`); exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `open`, `hub …`, `task …`, `session …`, `hook …`, `--version`, `--help`. With no command it opens the workbench when stdin and stdout are a terminal, and prints the help otherwise. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket; puts a fake Claude Code first on a daemon's PATH. The tests touch nothing else. |
| `test/fakes/claude-code/` | The fake Claude Code the adapter is tested against (`claude`, a script; `fake-claude.ts`): `--bg` with the MCP config, the settings hooks and the plugin dir, the real spoke as its MCP server, the real cland mod against a small `$`, `agents --json`, `attach`, `stop`. |

The spoke finds its hub through `.cland/hub.json` (`CLAND_HUB_FILE` names it, else the nearest one walking up from its cwd), and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional. `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_HEARTBEAT_MS` and `CLAND_HUB_REQUEST_TIMEOUT_MS` set the timings, for tests. A session an adapter launched sets `CLAND_DELIVERY=adapter`: the spoke then only accepts deliveries and the adapter injects them. Otherwise the spoke delivers into the session as a Claude Code channel notification (a research preview, kept small and isolated in `spoke.ts`). `CLAND_TEST_TASK_WRITE_PAUSE_MS`, read by `cland hub serve`, holds every tracker write still between its temporary file and the rename, so a test can land a hand edit in that window; nothing else sets it.

## Identity and delivery

A session's identity is the session id in its hello (`CLAND_SESSION_ID`; a spoke started without one makes up a random id). A name is what others address it by.

- A generated `session-<n>` name is never one the store knows: a session's row, live or offline, or a name any stored message or delivery carries (so a name a session renamed away from stays retired while its traffic is kept). A new session therefore never inherits another session's queued messages, history or status line. History is still looked up by name: a session that explicitly claims a retired name sees that name's traffic.
- A hello with no name from a session the hub already knows gets that session's previous name back, unless another session has claimed it by name since. The spoke also remembers the name it was welcomed under and asks for it on every reconnect, so it keeps it even when the hub lost its store.
- A requested name is a claim. A live holder of another session refuses it; a live holder of the same session is replaced (close code 4002). A status line is inherited only by the same session id.
- Hygiene (rate windows, pair counts, mutes) is keyed by the session id, so a rename moves nothing.

A delivery row is `queued` until the spoke accepts it, then `delivered`, then `injected` once the session's adapter confirmed the turn (spec 4.2).

- The hub sends `{"type":"deliver","id":"<message id>","message":{…}}`. The spoke answers `{"type":"ack","id":"<message id>"}`, and only that marks the row delivered.
- On each hello the hub sends everything still queued for the session, including messages a previous socket received but never acked. A spoke may therefore see a message twice. It acks both copies and hands the message to the session once.
- A send's outcome `delivered` means the frame went out on an open socket to a live session. A socket that is closing gets `queued`.
- A message's stage, as the UI shows it, is `queued` while any of its deliveries is, then `delivered`, then `injected` once every delivery that was not dropped is; `dropped` when every one waited past the TTL.
- A session no adapter launched (a spoke started by hand) has nobody to confirm a turn: its messages stay `delivered`.

## Topics

A topic is a thread in the human's chat with agents (spec 4.5): an id, a title, a status, a `standing` flag, creation and activity times. Every message belongs to one, and the `deliver` frame carries it as `"topic":{"id":…,"title":…}` (the spoke shows it as `topic` and `topic_title` on the channel event).

- **General** (`general`) and **Agents** (`agents`) are created at the project's first hub start and are standing: renaming or deleting them is refused. No other topic can be created yet (#32); the status is always `open` until the status machine (#32).
- **The human** writes through the UI (`topic.send`), into any topic but Agents: Agents is read-only, a record of what agents send each other, and a `topic.send` there is refused. The message addresses the Coordinator unless `to` names sessions or roles. Each address counts once, with or without its `@`.
- **A role, for the human**, reaches its live holders only: a holder that went offline is not an addressee (it was replaced, or will take the role again on its hello). With no live holder the message is queued under the role, and the first session to take the role (its hello) gets it, also a session that was already addressed by name in the same message (one delivery, one ack). The stage stays `queued` until that session acks. One role may have several holders: all of them are reached. The sender is `human`, a reserved name.
- **A session** writes with `send`: with no `to` the message is for the human, in the given topic or General; with `to` it goes to sessions and is recorded in the given topic or Agents. A role reaches its live holders, or, with none connected, the offline holders the hub remembers (queued for them); a role nobody ever held answers `empty`.

## Not here yet

- **The rest of the human side.** Topics beyond General and Agents, their statuses and asks (#32); a loop-breaker mute is still only journalled, not shown in the UI.
- **Roles as hub state.** A session may declare one of the four role names so `@role` routes; clauses, permissions and handover come with #29–#33.
- **The journal.** Tracker conflicts and re-indexes, and a harness process that died (`harness-exited`), go to the hub's JSON-lines log until the journal (#34) exists. A claim stays until released, forced or the item is closed; nothing yet releases it when its session ends.
- **Adapters.** Codex (#26) and OpenCode (#27). Permissions on `session.launch` (#30): anyone may launch for now.

## The project's hub

Run from a project's root, or anywhere inside it. The project root is the nearest ancestor holding `.git` or `.cland/`, else the current directory.

| Command | What it does |
| --- | --- |
| `cland` / `cland open [dir] [nvim args…]` | Runs `cland hub start` (quietly; its output is shown only when it fails), then the Neovim workbench on the project's root, from any directory inside the project, and exits with its status. `CLAND_LAUNCHER` names another launcher. The workbench is described in `nvim/README.md`. |
| `cland hub start` | Starts `cland hub serve` detached, waits until it answers, prints its pid, port and socket. A live hub is reported instead of started twice, also when two starts race: the hub that takes the project's lock serves, the other serve exits, and both commands report the one hub. A `hub.json` whose pid is gone, or is a process that does not hold the lock, is replaced. |
| `cland hub status` | Asks the hub over its socket: pid, port, socket, uptime, version, connected sessions with their roles. `--json` prints the raw status. Exit 1 when no hub runs. |
| `cland hub stop` | Asks the hub to stop over its socket and waits for the process to exit. When the socket does not answer it sends SIGTERM, but only to the process holding the project's lock (pid and start time match); a `hub.json` naming any other process is removed and that process left alone. A hub that died without cleaning up has its `hub.json` removed, and its socket file unless another hub holds the lock by now. |
| `cland hub serve` | The hub in the foreground, logging JSON lines to stderr. This is what `start` runs. SIGTERM and SIGINT stop it gracefully. |
| `cland hub serve --stdio` | The same, and also the UI's frames on stdin and stdout for the parent that spawned it (`--transport stdio` works too). Stdout carries frames only; the hub stops when stdin ends. It is still the project's hub: it binds the socket and writes `hub.json`, so sessions find it. When either listener cannot bind (a sandbox that forbids it, spec 4.2), it logs `listen-failed`, closes the other and goes on over stdio alone (below). |
| `cland hub serve --stdio --no-listen` | Stdio alone: binds nothing. |

A stdio hub without listeners still takes the project's lock: the store is one hub's alone. It writes no `hub.json` (nobody could reach it), plugs in no adapters (so `session.*` requests are refused: a launched session could never connect), and `hub.status` shows port 0 and an empty socket. While another hub holds the lock, `serve --stdio` does not proxy to it: it exits 1 before any frame, with `cland: a hub already runs for <root> (pid <n> holds …)` on stderr. A UI then talks to that hub over its socket, or stops it first.

The project's `.cland/`:

| Path | Committed | What it is |
| --- | --- | --- |
| `.gitignore` | yes | Managed by cland (first line `# managed by cland`); ignores every volatile file below. Remove the mark to take the file over. |
| `tasks/` | yes | The tracker's item files, one per item (below). Written by the hub, editable by hand, never committed by cland. |
| `roles.toml`, `config.toml` | yes | Not written by the hub yet (#29 onward). |
| `hub.db` (+ `-wal`, `-shm`) | no | The SQLite store: sessions, messages, deliveries, hygiene counters and mutes; the tracker's index and claims. |
| `secret` | no | 32 random bytes as hex, mode 0600. Kept across restarts, so spokes holding it reconnect. |
| `hub.lock` | no | The hub lock, mode 0600: `{"pid":…,"started":"<ps lstart>"}` of the one hub serving the project, from before it prepares anything until it has shut down. |
| `hub.json` | no | The discovery file, mode 0600, present only while a hub runs. |
| `hub.sock` | no | The Unix socket for the UI and the CLI. |
| `log/hub.log` | no | The background hub's stdout and stderr. |
| `journal.jsonl`, `artifacts/`, `worktrees/`, `territory.git/` | no | Ignored ahead of the tickets that write them. |

`hub.json`:

```json
{
  "socket": "/path/to/project/.cland/hub.sock",
  "port": 53124,
  "secret": "<64 hex chars>",
  "pid": 41234,
  "version": "0.1.0"
}
```

`port` is the 127.0.0.1 WebSocket port for spokes, chosen free at each start. When `.cland/hub.sock` would exceed the Unix socket path limit (about 104 bytes on macOS), the socket is `cland-<hash of the root>.sock` in the system temp dir, and `socket` names it.

The Unix socket speaks the hub's frames as JSON lines, through the same dispatcher as the WebSocket: a spoke's hello works there too when it carries the secret, and a client's hello works on the WebSocket. The first frame is `{"type":"hello","protocol":2,"secret":"…","client":"cli"}`; a wrong secret gets `{"type":"error","code":"unauthorized",…}` and the socket closes. After the `welcome`, a client sends `{"type":"hub.status","id":"…"}`, `{"type":"hub.stop","id":"…"}`, a UI request or a `task.*` request (below) and gets a `result` with the same id. Stdio (`cland hub serve --stdio`) speaks exactly the same frames; its hello needs no secret.

### The UI's frames

| Request | Result `value` |
| --- | --- |
| `{"type":"topic.list","id":…}` | `{"topics":[Topic…]}`, standing topics first, then by latest activity |
| `{"type":"topic.history","id":…,"topic":"general","limit":50}` | `{"topic":Topic,"messages":[TopicMessage…]}`, oldest first, at most 200 |
| `{"type":"topic.send","id":…,"topic":"general","text":"…","to":["…"]}` | `{"message":TopicMessage,"outcomes":[…]}`; `to` is optional (the Coordinator) |
| `{"type":"topic.rename","id":…,"topic":…,"title":…}` | `{"topic":Topic}`; refused for General and Agents |
| `{"type":"topic.delete","id":…,"topic":…}` | `{"deleted":id}`; refused for General and Agents |
| `{"type":"subscribe","id":…}` | `{"subscribed":true}`; events follow on this connection until it closes |

- `Topic` is `{"id","title","status","standing","createdAt","updatedAt"}`.
- `TopicMessage` is the stored message, `{"id","from","fromKind","fromRole"?,"via","to","text","ts","replyTo"?,"topic","stage"?}`, where `stage` is present when the message had addressees.

Events, pushed after `subscribe`:

```json
{"type":"message","topic":{"id":"general","title":"General"},"message":{"id":"…","from":"coord","fromKind":"agent","fromRole":"coordinator","text":"…","ts":"…","topic":"general",…}}
{"type":"delivery","topic":"general","message":"<message id>","stage":"delivered"}
{"type":"session.state","session":"coord","sessionId":"…","state":"busy","source":"hook","ts":"…"}
```

A `message` event comes for every message recorded in a topic, the human's own included, before the `topic.send` result. A `delivery` event comes whenever a message's stage changes after the send: an ack, an injection, a delivery dropped past the TTL when its session comes back, or a role's queue merged into a session that already had the message. A `session.state` event comes when a session's state changes (below).

## Adapters and sessions

An adapter launches one kind of harness, tells the hub what each session is doing, and hands it messages (spec 4.3). Claude Code is the only one yet; Codex (#26) and OpenCode (#27) follow the same contract.

### The contract

`src/adapters/contract.ts`. Mandatory:

| Member | What it does |
| --- | --- |
| `spawn({name, role, model, cwd})` | Launches the harness with the spoke's MCP configuration injected at launch; resolves with the process-table row. Nothing is written into the project. |
| `attachCommand(process)` | The command, as a string, that attaches a terminal to the live session; the harness's own. |
| `inject(process, message, topic)` | Hands the message to the session as a turn. Resolves when the harness confirmed the turn (stage `injected`). Rejects when there is no way in or no confirmation in time: the message then stays `delivered`, the hub logs `inject-unconfirmed` and retries at the session's next transition to `idle`, or when its in-session connection comes back. |
| the state stream | Push signals from inside the session go to the hub as `session.signal` frames and the adapter's `interpret` turns them into states. The adapter's own poll and its liveness check report through its host. |
| `stop(process)`, `resume(process, {relaunch})` | Stop through the harness. Re-find a process after a hub restart by its pid and the harness's own ids, or start it again on its own conversation (`relaunch`). |

The capability table declares the optional capabilities (`history`, `usage`, `setModel`, `approvalRelay`) and each state signal as `reliable`, `heuristic` or `none`. What is `none` is never emulated. `session.list` returns every adapter's table.

### Session state

`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown` (spec 4.2). Only adapters set it; the model's `status` tool sets the status line and never the state. Presence (`who`, `hub.status`) carries it, and subscribed clients get `session.state`. A session no adapter launched is `unknown`, and so is a launched one whose process died or was stopped.

- A push signal (a hook, the mod) carries the time it happened; one older than the last push applied is dropped, so out-of-order hooks never move a session back.
- A polled signal counts only while no push came for `CLAND_PUSH_TRUST_MS` (15 s), or while nothing is known yet.

### The process table

`harness_processes` in `hub.db`: name, harness, role, model, cwd, pid, the harness's handle (Claude Code's background id), cland's session id (the spoke's `CLAND_SESSION_ID`), the harness's own conversation id where it chose one, start time, and `running` | `exited` | `stopped`. At its start the hub resumes every `running` row. A process found alive under its ids is watched again. Otherwise the row turns `exited`, the state `unknown`, and the log gets `harness-exited`. The watch also catches a process that dies while the hub runs.

### The Claude Code adapter

| | Surface (Claude Code 2.1.294) |
| --- | --- |
| spawn | `claude --bg --session-id <uuid> --name <name> [--model m] --mcp-config <json> --settings <json> --plugin-dir hub/mod/cland`, in the session's cwd. The MCP config starts `bin/cland-spoke.ts` with `CLAND_HUB_FILE`, `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`, `CLAND_DELIVERY=adapter`. The settings add the hooks below (all `async`) and an `env` the mod reads (`CLAND_SESSION_NAME`, `CLAND_HUB_FILE`, `CLAND_NODE`, `CLAND_CLI`). No secret goes on a command line: everything finds the hub through `hub.json`. `--bg` takes `--session-id` but picks its own id (its prefix is the background id); the hub records it as `harnessSessionId`. The workspace must be trusted once (`claude` in it, accept the prompt), or `--bg` refuses. |
| attach | `claude attach <background id>`; several clients can attach at once. |
| inject | The cland mod keeps `cland hook bridge` running, which receives `inject` frames for its session. It submits each one with `$.prompt.submit`, framed as the plugin's (a turn of its own once the session is idle), and confirms it with `cland hook injected`. A turn whose prompt carries a message's envelope confirms it too. The message reads as `<channel source="cland" from=… msg_id=… topic=…>text</channel>` plus one line naming the `send` tool as the way back. The session's inbox socket is not used, because its message format is undocumented. |
| state | Hooks, run as `cland hook <event> --session <name> --hub-file <path>`: SessionStart → `idle` (and the model), UserPromptSubmit → `busy`, Stop and StopFailure → `idle`, PermissionRequest → `waiting for approval` (`waiting for human` for AskUserQuestion), PostToolUse → `busy`, Elicitation → `waiting for human`, Notification `idle_prompt` → `idle`. The mod adds `turn.start` → `busy` and `turn.complete` → `idle`, which also fires on an interrupt where Stop does not, with the turn's usage. The fallback is `claude agents --json`, polled every `CLAND_ADAPTER_POLL_MS` (5 s), which also catches a dead pid. |
| stop, resume | `claude stop <id>`. Resume reads `claude agents --json`; a relaunch is `claude --bg --resume <its session id>` with the same flags (the harness does not restore them). |

| Capability | |
| --- | --- |
| history | none: the transcript format is internal to Claude Code |
| usage | reliable: the mod's `turn.complete` (`hub.status` shows the latest under `harnesses[].usage`) |
| setModel | none |
| approvalRelay | none: approvals stay in the harness's TUI (spec 4.3) |
| busy, idle, waiting for approval | reliable (hooks, the mod) |
| waiting for human | heuristic (AskUserQuestion through PermissionRequest, Elicitation, `waitingFor`) |

Signals or a bridge that arrive while a launch is still running belong to the new process and are kept until its row is written. The real SessionStart hook does arrive before `claude --bg` and the first `agents --json` return.

### The frames and the CLI

| Request | Result `value` | Who |
| --- | --- | --- |
| `{"type":"session.launch","id":…,"name":…,"role"?,"model"?,"harness"?,"cwd"?}` | `{"process":HarnessProcess}` | UI, CLI, spokes (anyone until #30) |
| `{"type":"session.list","id":…}` | `{"processes":[HarnessProcess…],"adapters":{"claude-code":Capabilities}}` | UI, CLI, spokes |
| `{"type":"session.attach","id":…,"session":…}` | `{"command":"claude attach 1a2b3c4d"}` | UI, CLI |
| `{"type":"session.stop","id":…,"session":…}` | `{"process":…}` | UI, CLI |
| `{"type":"session.resume","id":…,"session":…,"relaunch"?:true}` | `{"found","reason"?,"process"}` | UI, CLI |
| `{"type":"session.signal","id":…,"session":…,"event":…,"at":…,"payload":{…}}` | `{"applied","state"?}` | `cland hook` |
| `{"type":"session.bridge","id":…,"session":…}` | `{"bridged":true}`, then `{"type":"inject","session","message","text"}` frames | `cland hook bridge` |

`HarnessProcess` is `{"name","harness","role","model","cwd","pid","harnessId","sessionId","harnessSessionId","startedAt","status","state","attach","usage"?}`; `hub.status` lists them as `harnesses`.

| Command | What it does |
| --- | --- |
| `cland session launch <name> [--role r] [--model m] [--harness claude-code] [--cwd dir]` | Launches a session through the hub. |
| `cland session list` / `attach <name>` / `stop <name>` / `resume <name> [--relaunch]` | As the frames above. |
| `cland hook <event> --session <name> --hub-file <path>` | Posts one signal, with the harness's JSON payload from stdin. Only the fields the hub reads are kept, and a prompt is reduced to the message ids it carries. Always exits 0: a hook never fails the harness. |
| `cland hook bridge --session <name> --hub-file <path>` | The mod's connection to the hub. It prints each `inject` frame as a JSON line, reconnects through `hub.json` after a hub restart, and ends with its parent. |

`CLAND_CLAUDE_BIN` names the `claude` executable, `CLAND_INJECT_TIMEOUT_MS` (60 s) how long an inject waits for its confirmation.

## The tracker

One Markdown file per item in `.cland/tasks/`, `T-<n>-<slug>.md` (spec 4.6, ADR 0002). Ids are sequential per project and never reused: the hub hands out one above the highest in the folder and in the index. The file name keeps the slug of the title the item was created with.

```markdown
---
id: T-1
kind: task            # epic | spec | task | question | map
title: Add the login page
state: open           # open | closed
labels:
  - ui
assignee: null
parent: T-2
blocked_by: []
topic: null
branch: t/1-add-the-login-page
created: 2026-10-08T12:38:26.370Z
updated: 2026-10-08T12:38:26.729Z
---

The page the human logs in on.

## Comments

### alice · 2026-10-08T12:38:26.640Z

Session cookie handled.

### rev-1 · 2026-10-08T12:38:26.729Z

verdict: review
result: clear
by: rev-1 [reviewer]
run: r-1

Looks right.
```

A comment is headed `### <author> · <ISO time>`; one whose first lines are `verdict:` (`review` | `qa`), `result:` (`clear` | `not clear`), `by:` (`<session> [<role>]`) and `run:` is a verdict.

- **Writes** go through the hub and are serialized: each runs read–change–write–index synchronously, the file replaced atomically. Nothing is committed.
- **Hand edits** are picked up by a watcher on the folder (debounced 100 ms) and re-indexed; a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), or a hand edit landing while the hub writes the item (between its read and its rename: the file is checked just before the rename and the replaced file just after; the hand edit is overwritten), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. A claim is held by the claimer's identity, not its name: a spoke's session id (a rename keeps the claim; another session taking the old name gets none of it), or `human` / `cli:<name>` for the CLI, which is never a session. `view` shows the holder's name (`session`) beside its identity (`sessionId`); the holder claiming again refreshes the name. Another holder's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. It acts as `--as <name> [--role r]`, else `$CLAND_SESSION_NAME` and `$CLAND_ROLE`, else `human`. The hub refuses a name outside the session-name grammar (`[a-z0-9][a-z0-9-]{0,23}`, not reserved) and a role that is not one of the four role names: both are written into item files.

| Command | Tool | What it does |
| --- | --- | --- |
| `cland task create <title> [--kind] [--body \| --body-file] [--label]… [--assignee] [--parent] [--blocked-by]… [--topic] [--branch]` | `task.create` | Writes a new item file. |
| `cland task view <id>` | `task.view` | Frontmatter, body, comments, verdicts and the claim. |
| `cland task list [--state] [--label]… [--kind] [--assignee] [--verdict review=clear]` | `task.list` | Queries the index. |
| `cland task comment <id> <text> [--verdict review\|qa --result clear\|"not clear" --run <id>]` | `task.comment` | Appends a comment, or a verdict. |
| `cland task edit <id> [--title] [--body] [--kind] [--state] [--label]… [--add-label]… [--remove-label]… [--assignee]` | `task.edit` | Changes fields; `none` clears the assignee. |
| `cland task close <id> [--comment]` | `task.close` | Closes the item. |
| `cland task link <id> [--parent] [--blocked-by]… [--unblock]… [--topic] [--branch]` | `task.link` | Sets the links; `none` clears one. |
| `cland task claim <id> [--release] [--force]` | `task.claim` | Takes or releases the claim. |
| `cland task import-github [--repo owner/name] [--all]` | — (`task.import` frames) | Imports GitHub Issues as items (below). |

The frames are `{"type":"task.<op>","id":"<request id>","item":"T-1",…}` with fields named as in the frontmatter (`labels`, `blocked_by`, `add_labels`, …); a CLI frame may carry `"as":{"name":…,"role":…}`, a spoke's always acts as its own session. The tools take the item as `id`.

### Importing GitHub Issues

`cland task import-github [--repo owner/name] [--all]` is the one-shot bootstrap of the tracker from a repository's GitHub Issues (spec 6). It reads GitHub through the `gh` CLI with the user's own login (no token is stored anywhere): the issues (pull requests skipped; open ones, closed too with `--all`; the repository defaults to the `origin` remote), each issue's comments and its `blocked_by` dependencies; the parent comes from the issue's sub-issue relation. The hub then writes one item per issue:

- `kind` from the labels: `epic` → `epic`, `wayfinder:map` → `map`, `wayfinder:task` → `task`, any other `wayfinder:*` → `question`, else `task` (as the own-tracker template files them); `title`, `state`, `labels`, `assignee` (the first assignee) and `created` as on GitHub; the body verbatim (CRLF made LF, and a line the file format would read as structure, `## Comments` or a `### <author> · <time>` header, escaped with a backslash).
- `parent` and `blocked_by` mapped to the items of those issues; an edge to an issue that has no item (a closed one without `--all`) is kept as `github:#<n>` and resolves on a later run that imports it.
- Comments as `### <login> · <GitHub time>`, each opening with `<!-- github-comment: <id> -->`.
- An optional `github: {repo, number, url}` in the frontmatter, kept through every write and otherwise ignored by the hub.

It is idempotent: a re-run finds each item by its `github` reference, rewrites title, body, labels, state, assignee, kind and edges from GitHub, appends only the comments whose id it does not hold yet, and keeps what GitHub does not own (`topic`, `branch`, local comments, the id and the file name). An item whose text would not change is not written, so with GitHub unchanged the files stay byte-identical and `updated` does not move. It prints the counts (created, updated, unchanged, comments added) and one line per issue (`--json` for the raw summary).

## Running

From the repository root:

```sh
npm install
npm run typecheck
npm test
node hub/bin/cland.ts --version
```

`npm run check` inside `hub/` runs the typecheck and the tests together. `CLAND_TEST_VERBOSE=1` streams every spoke's stderr while the tests run.
