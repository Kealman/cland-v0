# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames (protocol 2): `hello`, `welcome`, `error`, request `result`, `deliver` and the spoke's `ack` of it, the `role` frame (a role's clause); the heartbeat interval and the frame size limit. The client hello (it carries the secret on the Unix socket), the client requests `hub.status`, `hub.stop`, `topic.*` (`topic.answer` among them), `inbox.*`, `role.*`, `hygiene.unmute`, `subscribe`, the pushed events `message`, `delivery`, `topic`, `ask`, `inbox`, `session.state`, `session.role`, `presence`, `session.process`, `session.usage`, `role.vacant`, `role.filled` and `task`, the typed `forbidden` result, the `inject` frame to an in-session bridge; session states and the process table's view. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/watch.ts` | A folder watch that falls back to polling every 500 ms where watching is refused (a macOS sandbox denies FSEvents): used for `.cland/tasks/`; roles refresh uses its own async timer. |
| `src/hub/topics.ts` | The topic model (spec 4.5): the status moves, the mentions of a human message, the "no coordinator" warning, the port to the tracker a binding goes through. |
| `src/hub/asks.ts` | Asks (spec 4.5, #33): the Coordinator's question with numbered options; the human's answer with `answer_to`; withdrawn by `resolve`, cancelled by a close. |
| `src/hub/visibility.ts` | The §3.5 placement table, project overrides and outgoing frame layer projection shared by all surfaces. |
| `src/hub/inbox.ts` | The inbox (spec 5, #33): asks, approvals, waiting topics and notifications, the "needs you" count, the `inbox` event; the idle threshold from `.cland/config.toml`. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, topics (status, binding, the human's read mark), messages (each in a topic), per-addressee deliveries (queued → delivered on the spoke's ack → injected on the adapter's confirmation, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. Its constants are the defaults; `.cland/config.toml` `[hygiene]` overrides them at hub start (`src/init/config.ts`). |
| `src/hub/journal.ts` | The journal, `.cland/journal.jsonl`: a tap on the log closure that appends the domain events as JSON lines (opened for appending: a restart never truncates), `write` for a record of its own, and the reader behind `cland hub journal`. |
| `src/hub/agents-topic.ts` | The Agents record: maps the hub's lifecycle events (session start, stop, death; role assignment and revocation; claims and releases) to hub notices with a `kind`, posted through `HubCore.noticeInTopic`. |
| `src/hub/core.ts` | Presence, names keyed to session ids, same-session takeover, routing, store-and-forward with acks, the standing topics, the human's messages, each session's state (set only through the adapters), the events subscribed clients receive, each session's role (assignment, the clause's delivery, Coordinator exclusivity and vacancy). Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests and acks, client requests (`hub.status`, `hub.stop`, `topic.*`, `subscribe`), the `task.*` requests from either, the `session.*` requests (`src/adapters/requests.ts`), refusals. A spoke's frames count only while its socket is open and still holds the session's name. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/merge.ts` | The task merge gate: hub verdict provenance, cached freshness, a queued squash merge and the item lifecycle; session-delayed worktree cleanup. |
| `src/hub/budget.ts` | The request path's guard (T-67): every frame's handling timed against the budget (`slow-request`), and a read a connection repeats too fast answered with its previous answer (`too-fast`). |
| `src/hub/server.ts` | The hub without listeners (`createHubBase`: core, dispatcher, prune) and the WebSocket edge (bearer secret check, frame size limit, heartbeat sweep). `createHub` is both, with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. Bound under a private name and renamed into place; on close it removes the path only while the path is still the socket it bound. |
| `src/hub/lines.ts` | The JSON-lines framing both byte-stream edges share: complete lines split off first, each held to the frame limit on its own, then only the unfinished remainder. |
| `src/hub/stdio.ts` | The stdio edge for a UI that spawned the hub as its child (`cland hub serve --stdio`): JSON lines on stdin and stdout, no secret, the hub stops when stdin ends. |
| `src/hub/lock.ts` | The project's hub lock, `.cland/hub.lock`: created whole or not at all, holding the holder's pid and process start time; a stale one (pid gone, or reused by a process started at another time) is broken under a guard. |
| `src/hub/daemon.ts` | The hub serving one project in the background: the lock taken first, `.cland/` prepared, store on `hub.db`, both edges bound, the adapters plugged in, `hub.json` written last; the launched sessions re-found once it is reachable. Shutdown runs backwards: edges closed, `hub.json` removed, the lock released last. For a stdio hub the listeners are optional (below). |
| `src/adapters/contract.ts` | The adapter contract (spec 4.3) and its capability table; the message envelope a harness reads. |
| `src/adapters/processes.ts` | The process table: the harness processes the hub launched, in `hub.db` (table `harness_processes`), through a connection of its own (termination is handled by `src/system-processes.ts` `endProcess` after its recorded start time matches). |
| `src/system-processes.ts` | Asynchronous OS process snapshots and verified process-tree termination, with bounded probes and kill escalation. |
| `src/orphans.ts` | Project ownership checks and orphan discovery; startup cleanup and doctor reports. |
| `src/adapters/sessions.ts` | The hub's side of the adapters: launch, attach, stop, resume, the state signals, and the delivery pipeline's last stage (delivered → inject → injected). Transport-free. |
| `src/adapters/requests.ts` | The `session.*` frames and their handler. |
| `src/adapters/claude-code.ts` | The Claude Code adapter. |
| `src/adapters/codex.ts` | The Codex adapter; `src/adapters/codex/app-server.ts` is its JSON-RPC client for an app-server's Unix socket. |
| `src/adapters/index.ts` | The adapters a project's hub runs with, and their timings from the environment. |
| `mod/cland/` | The cland mod, loaded into every Claude Code session the hub launches (`--plugin-dir`): it submits the hub's messages as turns and reports turn starts and ends. |
| `src/project.ts` | The `.cland/` layout, the managed `.gitignore`, the secret, the discovery file, finding the project root. |
| `src/tracker/freshness.ts` | Verdict freshness off the request path (T-67): the cache `task.list`, `task.view` and the `task` event read, the branch tips read on a timer, the Git comparisons run in the background. `src/tracker/verdict-git.ts` holds those Git facts, all asynchronous. |
| `src/tracker/item.ts` | The item file format: frontmatter, body, comments, verdicts; parse (lenient for hand edits) and serialize. |
| `src/tracker/index-db.ts` | The tracker's index (items, labels, blockers, verdicts), its id high-water mark and the claims: tables of their own in `hub.db`, through a connection of their own. |
| `src/tracker/tracker.ts` | The tracker: writes the item files (serialized, atomic), watches `.cland/tasks/` (or polls it, `src/watch.ts`) and re-indexes hand edits, holds claims. |
| `src/tracker/import-github.ts` | The hub's side of the GitHub import (`task.import`): issues to items, found again by their `github` reference, written only when their text changes. |
| `src/tracker/requests.ts` | The `task.*` request frames and their handler, called from the dispatcher for spokes and clients alike. |
| `src/cli/hub.ts` | `cland hub start`, `status`, `stop`, `serve [--stdio]`, `audit`. |
| `src/cli/task.ts` | `cland task create`, `view`, `list`, `comment`, `edit`, `close`, `link`, `claim`. |
| `src/cli/session.ts` | `cland session launch`, `list`, `attach`, `stop`, `resume`. |
| `src/cli/role.ts` | `cland role set`, `clear`, `list`. |
| `src/cli/inbox.ts` | `cland inbox`, `cland topic answer` (Asks and the inbox). |
| `src/cli/init.ts` | `cland init [dir]`, `cland init --undo [--force]`, `cland update [dir]`. |
| `src/territory.ts` | The territory's Git runner, shared lock, provisioning, undo and read-only health checks; the task branches' base and the task worktrees (made, listed, removed); the squash commit and guarded push; usable without a hub. |
| `src/hub/worktrees.ts` | Task worktrees in the hub (T-58): which items get one, made at a task's claim and by `session.launch` with an item (which then claims the item for the session), listed with their items and the sessions inside, pruned. |
| `src/cli/worktree.ts` | `cland worktree list`, `cland worktree prune [--yes]`. |
| `src/cli/doctor.ts` | `cland doctor [dir]` (below). |
| `src/doctor/` | Its checks: `toolchain.ts` (the harnesses, `gh`, Neovim), `project.ts` (the hub, the config files, what `cland init` provisioned), `ranges.ts` (`TESTED_RANGES`, the harness versions each adapter was built against), `report.ts` (the verdicts, the text and the runner). |
| `src/init/provision.ts` | What `cland init` and `cland update` provision, step by step (below); `src/init/` holds one module per managed part: `config.ts` (`config.toml`, also read by the hub), `skills.ts`, `instructions.ts` (`AGENTS.md`, `CLAUDE.md`, `docs/agents/*`), `claude-settings.ts` (the hooks), `files.ts` (write-only-when-changed and the report). |
| `src/roles/config.ts` | `.cland/roles.toml`: parsed (smol-toml), written with the defaults when missing, refreshed asynchronously every 500 ms; permission checks read memory only. |
| `src/roles/default-roles.ts` | The default `roles.toml`: the four roles' clauses, skills, launch defaults, permissions. |
| `src/roles/clause.ts` | The text a holder reads when its clause (or its revocation) is delivered. |
| `src/roles/note.ts` | The handover note: its four sections, read from an object or from Markdown headings, the typed refusal naming what is missing, its rendering. |
| `src/roles/handover.ts` | A role's handover (`role.handover`, the human's `role.set` with a note or `move`): the claims move with the role, the core moves it; the role's state for its holder (`role.state`). |
| `src/roles/permissions.ts` | The permission table: the tools each role may use and how far (scopes), seeded from spec 4.4; `decide`, which the dispatcher asks on every spoke tool call. |
| `src/hub/audit.ts` | The audit record (every tool call, allowed or refused), its argument summary, and reading it back from the hub's log (`cland hub audit`). |
| `src/cli/open.ts` | `cland open [dir]`, and `cland` with no command on a terminal: the project's hub started if none runs, then the workbench (`nvim/bin/cland-nvim`) on the project's root. |
| `src/cli/qa.ts` | `cland --headless --qa <case.lua>`: one scripted QA case in a headless workbench on a fixture project, with a pinned environment; prints the case's result as one JSON line and exits with its code (`nvim/README.md`, "QA cases"). |
| `src/cli/qa-fixture.ts` | `cland --qa-fixture`, run by a QA case's Neovim: the case's fixture project (JSON on stdin) written inside the run's directory, its items through the tracker's own writer; a project directory that exists already is refused. |
| `src/cli/hook.ts` | `cland hook <event>`, run from inside a launched session by its hooks and the mod; `cland hook bridge`, the mod's connection to the hub. |
| `src/cli/task-import.ts` | `cland task import-github`: reads the issues through `gh` and sends them to the hub in `task.import` frames. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, asks again for the name it was welcomed under, retries a requested name before taking a generated one, never stops for good (closed with 4002 by a hub older than T-51, it reconnects like after any close). Acks every delivery and hands each message id to the session once. Fails a request after its deadline, heartbeats while connected and reconnects after two unanswered heartbeats; before the welcome, tool requests wait for readiness up to 20 s, and a hub that does not answer hello within the separate welcome deadline is left and reconnected to. |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send` (into a topic, to the human or to sessions), `topic.create`, `resolve`, `ask`, `who`, `status`, `rename`, `history` (a session's traffic, or a topic's with `topic`; Agents accepts `item` and `session` filters), `session.launch`, `role.handover`, `role.state`, `artifact.create`, `artifact.promote` and the `task.*` tools (`src/spoke/task-tools.ts`); exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `open`, `init`, `update`, `doctor`, `hub …`, `task …`, `session …`, `worktree …`, `hook …`, `--version`, `--help`. With no command it opens the workbench when stdin and stdout are a terminal, and prints the help otherwise. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket; puts a fake Claude Code first on a daemon's PATH. The tests touch nothing else. |
| `test/fakes/claude-code/` | The fake Claude Code the adapter is tested against (`claude`, a script; `fake-claude.ts`): `--bg` with the MCP config, the settings hooks and the plugin dir, the real spoke as its MCP server, the real cland mod against a small `$`, `agents --json`, `attach`, `stop`. Like the real one it also runs the project's `.claude/settings.json` hooks and reads `CLAUDE.md` with its `@` imports, else `AGENTS.md`; what a session loaded goes to `jobs/<id>.context.json`. |
| `test/fakes/codex/` | The fake Codex the adapter is tested against (`codex`, a script; `fake-codex.ts`): `app-server --listen unix://…` speaking Codex's JSON-RPC over a WebSocket on the socket, with the real spoke started from the `-c mcp_servers…` overrides; `resume --remote …`, which refuses any `-c`/`--profile`; `--version`. |

The spoke finds its hub through `.cland/hub.json` (`CLAND_HUB_FILE` names it, else the nearest one walking up from its cwd), and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional; on a project's hub `CLAND_ROLE` is only a request (see Roles). `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_HEARTBEAT_MS`, `CLAND_HUB_REQUEST_TIMEOUT_MS` and `CLAND_HUB_WELCOME_TIMEOUT_MS` set the timings, for tests. A session an adapter launched sets `CLAND_DELIVERY=adapter`: the spoke then only accepts deliveries and the adapter injects them. Otherwise the spoke delivers into the session as a Claude Code channel notification (a research preview, kept small and isolated in `spoke.ts`). `CLAND_TEST_TASK_WRITE_GATE`, read by `cland hub serve`, names a test-only directory: the next tracker temporary write consumes its `armed` file, writes `entered`, and waits until the test creates `release` before proceeding to rename. Tests arm it after fixture setup, then release it after the competing operation; nothing else sets it. Also for tests only: `CLAND_QUEUE_TTL_MS` shortens the queue TTL (how long a queued message and a remembered name last), and `CLAND_TEST_CRASH_AT=handover-committed` kills the hub right after a handover's transaction committed (`launch-reserved`: right after a launch reserved its role, before the spawn).

The spoke's `session.launch` tool takes `name` and optional `role`, `model`, `harness`, `effort` and `cwd`. `cwd` is an absolute path or a path relative to the project root; omitting it runs the session at the project root. For example, `session.launch {"name":"impl-45","role":"implementer","cwd":".cland/worktrees/T-45"}` launches the Implementer in that worktree. A missing, inaccessible or non-directory path is refused before launch with `{"ok":false,"code":"invalid-cwd","error":"…"}`. With `item` instead (`session.launch {"name":"impl-45","role":"implementer","item":"T-45"}`), the hub makes or reuses the item's task worktree first and starts the session there (Task branches and worktrees, below).

Optional `brief` gives the session its first task: literal text, or an artifact id `A-<n>` whose current file content is read at launch. For example, `session.launch {"name":"impl-45","role":"implementer","item":"T-45","brief":"Implement T-45 and report to the Coordinator."}` or `cland session launch impl-45 --role implementer --item T-45 --brief A-12`. A string consisting only of an artifact id names that artifact; an unknown or unreadable artifact, an empty brief, or text over the ordinary message size limit refuses the launch before a harness starts.

The first harness input includes the role clause followed by the brief on Claude Code, Codex and OpenCode, so the first turn can start work without another `send`. When `role` is omitted, the launch uses the role already assigned to the name, including its launch defaults and clause. The brief keeps its own message id, journal `send` record and delivery stage. It enters the durable queue before spawn, so a hub restart before the first hello preserves the first task. It belongs to that launch; a failed launch cancels its undelivered brief during cleanup. Claude Code and OpenCode receive the initial clause and brief as one delivery batch after the spoke's welcome; Codex carries both in its launch first turn, settling the queued brief as injected when the native input is accepted. With no brief, the existing launch behavior stays. Reconnect and hub restart deliver the role clause again, never a new brief; an unacknowledged initial delivery retains the ordinary queue's retry rules. A resumed or relaunched conversation does not carry the launch brief again.

### Spoke readiness and deadlines

MCP initialization and tool listing do not wait for the hub. A tool called while its spoke is connecting waits for that connection's welcome up to `READINESS_TIMEOUT_MS` (20,000 ms), then sends its request. The wait applies on initial connection and reconnect. A timeout returns `{ok:false, error:"the hub did not become ready within 20 s (waiting for welcome)"}`. Expired calls are removed and never sent on a later welcome. A disconnect, refusal or stopped spoke fails waiting calls immediately; an already disconnected or refused spoke reports its outage immediately.

After the wait, the spoke re-reads the live connection and the identity and role accepted by its welcome. No identity or permission is captured before awaiting; the hub checks each request's permissions under that connection. Concurrent waiting calls share the welcome, with a separate deadline for each call.

`WELCOME_TIMEOUT_MS` is a separate 20,000 ms liveness bound measured from sending hello; `CLAND_HUB_WELCOME_TIMEOUT_MS` overrides it for tests. Previously, a silent hub that completed the WebSocket upgrade was cut off after 10 s; it now costs up to 20 s to detect that silence. The WebSocket handshake still has its 10 s deadline. Socket close fails waiting calls immediately and uses the existing reconnect path, including capped backoff and name retries. Ordinary reply deadlines remain `REQUEST_TIMEOUT_MS` (10,000 ms), overridden for tests by `CLAND_HUB_REQUEST_TIMEOUT_MS`; the reply clock starts only when the request is sent.

The readiness bound is below the harness tool-call deadlines: [Codex defaults to 60 s per tool](https://developers.openai.com/codex/config-reference/), and [OpenCode v2 defaults to 12 hours for execution](https://opencode.ai/v2/docs/mcp-servers). OpenCode's 30 s startup/catalog bounds apply to initialization and listing, which remain callable while the hub connects. The MCP SDK test client defaults to 60 s. cland's adapters leave these execution defaults in place. A normal tool can therefore spend at most 20 s waiting and 10 s awaiting a reply; `merge` and `session.launch` retain their existing separate 60 s reply bounds.

## Identity and delivery

The Implementer holding an item's claim leads that item. Send a report to `@lead T-n` with `send {to: ["lead T-n"], text: "…"}`; human topic messages may mention `@lead T-n` in their text. The hub resolves this address from committed tracker facts immediately before recording: to the nearest node lead up the item's parent chain, then the Coordinator. When the sender leads that node, the address skips its own claims and reaches the next lead; an Implementer reports blocked with `to: ["lead T-n"]` for its own item. Stopped or dead Leads are skipped, while disconnected living Leads retain queued delivery. Explicit session names and role addresses, including `coordinator`, keep their ordinary meaning. The recorded addressee is the resolved session; a later claim change cannot move its queued report or progress note, including across a restart. Unknown and closed items are refused with an error naming the item and telling the sender to address `coordinator` instead. A human's claim does not become an agent addressee. Ordinary agent-send permissions still apply.

Default subscriptions partition the item tree by its nearest active lead: each node lead gets status, verdict and closure events for its subtree outside descendants with their own lead. The Coordinator covers the remainder. A lead's death or long idle goes one level up, so an Implementer's notice reaches its epic Lead, the epic Lead's reaches its release Lead, and the release Lead's reaches the Coordinator. Pooled verifiers' lifecycle notices follow their held items. Explicit subscriptions widen coverage. The `ready` event is an action delivery to the nearest supervising lead (the item's parent Lead, or the Coordinator); it starts one turn there, while the item lead retains its digested event. For an unclaimed ready item the nearest inherited lead receives the action.

Reviewer and QA default clauses report to `@lead T-n`. Item events and verdict events reach their lead through default subscriptions on the existing event delivery path; explicit subscriptions widen that coverage. A message with no item keeps its existing Coordinator route. While durable identity adoption has failed, a renamed claimant's provisional alias is preserved across restart, reserves its old name, and retains the task-write fence until adoption succeeds; completing adoption removes the alias.

Every name allocation follows one reservation invariant: a different identity cannot take a live session's name or a durable alias, whether through generated hello, explicit hello, rename or launch. A pending alias stays reserved until adoption succeeds, even for its owner. Generated names also avoid all retained traffic; explicit hello, rename and launch keep their existing rules for reconnects and reuse of settled historic names.

A session's identity is the session id in its hello (`CLAND_SESSION_ID`; a spoke started without one makes up a random id). A name is what others address it by.

- A generated `session-<n>` name is never one the store knows: a session's row, live or offline, or a name any stored message or delivery carries (so a name a session renamed away from stays retired while its traffic is kept). A new session therefore never inherits another session's queued messages, history or status line. History is still looked up by name: a session that explicitly claims a retired name sees that name's traffic.
- A hello with no name from a session the hub already knows gets that session's previous name back, unless another session has claimed it by name since. The spoke also remembers the name it was welcomed under and asks for it on every reconnect, so it keeps it even when the hub lost its store.
- A requested name is a claim. A live holder of another session refuses it. A status line is inherited only by the same session id.
- **A session may have more than one spoke.** A hello for a session that is connected, under the session's name (or asking for none), joins it: there is still one session, every one of its spokes is answered as the session, and deliveries go to the newest. When a spoke's socket closes the session stays while another stands, and deliveries go to the newest that is left; the session is offline when the last one goes. Nothing of a hello happens again on a join: no role is resolved and no clause is sent. The journal records the join as `replaced` with the session and `spokes`, the count (the name is historical: the newest spoke replaces the older one as the target of deliveries, and nothing else), a spoke's leaving as `spoke-left` in the hub log, and Agents shows the join (`spoke-joined`). Why: Codex starts its MCP servers again for every thread on an app-server, so any further thread there (a helper's, a sub-agent's, an attached client's) brings a second spoke with the session's identity while the session's own thread goes on calling its tools through the first, and those extra spokes leave about a minute after their thread ends. Until T-51 the hub closed the older spoke with code 4002 and that spoke stopped for good: the session's every tool call then answered `this spoke was replaced`, no call reached the hub, and after the newer spoke left the session was offline while its harness ran. What this trusts: a spoke is taken for a session by the project's secret and the session id it gives, as it always was, so a second spoke carrying a connected session's id is that session by construction. Every socket of it acts as the session, an older or half-open one included; the earlier rule, that a socket lost the name to a newer one and could act no more, is gone with the eviction. A spoke that asks for another name with a connected session's id is taken for another session, as before; so a session that renamed itself and whose harness then starts a second spoke under the old name gets a second connection.
- Hygiene (rate windows, pair counts, mutes) is keyed by the session id, so a rename moves nothing.

A delivery row is `queued` until the spoke accepts it, then `delivered`, then `injected` once the session's adapter confirmed the turn (spec 4.2).

- The hub sends `{"type":"deliver","id":"<message id>","message":{…}}`. The spoke answers `{"type":"ack","id":"<message id>"}`, and only that marks the row delivered.
- On each hello the hub sends everything still queued for the session, including messages a previous socket received but never acked. A spoke may therefore see a message twice. It acks both copies and hands the message to the session once.
- A send's outcome `delivered` means the frame went out on an open socket to a live session. A socket that is closing gets `queued`.
- A message's stage, as the UI shows it, is `queued` while any of its deliveries is, then `delivered`, then `injected` once every delivery that was not dropped is; `dropped` when every one waited past the TTL.
- A delivery whose inject reached the harness and got no answer (Codex: a `turn/start` or `turn/steer` sent, its result lost or late) is `uncertain`: the turn may or may not have started. It shows as `delivered`, is logged (`inject-uncertain`) and noted in the inbox (`delivery-uncertain`), and is never sent again on its own (no idle, no reconnect replays it); the human sends it again with `session.retry` or `cland session retry <name> <message id>`.
- Each delivery keeps the session id its addressee had when it was recorded (or when a role's queue was claimed), and an agent's message the session id it was sent from: a grant tied to a delivery (the mention rule) and a reply to a message follow the session, never a name another session may take later.
- A session no adapter launched (a spoke started by hand) has nobody to confirm a turn: its messages stay `delivered`.

## Topics

A topic is a thread in the human's chat with agents (spec 4.5, decision #7): an id, a title, a status, a `standing` flag, at most one bound item, creation and activity times. Every message belongs to one, and the `deliver` frame carries it as `"topic":{"id":…,"title":…,"item":…}` (`item` only when bound; the spoke shows them as `topic`, `topic_title` and `topic_item` on the channel event).

- **General** (`general`) and **Agents** (`agents`) are created at the project's first hub start and are standing: renaming, deleting or closing them is refused. The system creates no other topic.
- **Creation.** The human creates a topic from the UI (`topic.create`), an agent with the `topic.create` tool (the Coordinator any topic, an Implementer only one bound to its own item: the permission table below); a title is required (at most 200 characters). The id is `topic-<n>`. `item` binds the topic to a unit of work: the item must exist and be open, and has one topic at most, so a second `topic.create` for it is refused with the topic it has (`T-1 already has a topic: "…" (topic-1); one topic per unit of work: write there`). The binding is written into the item's file (`topic: topic-1`) through the tracker. A hub with no project has no tracker and refuses a binding; a blank `item` is refused, not taken as none. `task.link --topic` (the CLI's `cland task link`, the `task.link` tool) and `task.create` with a `topic` bind through the same rule: the topic must exist and not be standing, an item already bound elsewhere is refused (`T-1 already has a topic: …`), and so is a topic bound to another item (`topic-2 is already bound to T-1; one item per topic`); the item's file and the topic's `item` change together, and `--topic ""` (null) unbinds both. At start the hub reconciles the bindings with the tracker: a bound item closed while no hub ran (a hand edit, a pull) closes its topic and cancels its asks. A topic with no message yet is listed last (a task's topic appears with its first message).
- **Status** follows the direction of the messages (`src/hub/topics.ts`): a human message makes the topic `waiting for agent`; an agent's message to the human makes it `open` (a topic `waiting for human` stays so: an ask is answered by the human); a message from an agent the human's latest message addressed, to other sessions in the topic, answers that wait too (`open`); any message reopens a `closed` topic to the status its direction implies. `resolve` clears a wait back to `open` and withdraws the topic's open asks: the `resolve` tool (the Coordinator's, by the permission table) and the UI's `topic.resolve`; a closed topic has nothing to clear and is refused. The human closes a topic (`topic.close`), and closing its bound item (`task.close`, `task.edit --state closed`, a hand edit to `state: closed`) closes it; a message reopens the topic, never the item. An `ask` (#33) makes it `waiting for human`, and while any ask in it is open it stays so whatever else is written (below); closing cancels its open asks. Agents keeps `open`.
- **The warning.** While a message in a topic waits for a role nobody holds (a delivery queued under `@coordinator`), the topic carries `"warning":"no coordinator"` (`no reviewer`, … for another role). It clears when a session takes the role (its hello, or the human's `role.set`) and the queued delivery moves to it.
- **Agents history filters** (T-56). `topic.history {topic:"agents", item:"T-12", session:"impl-12", limit:200}` searches the whole retained record before taking the latest matches (oldest first, at most 200). Either filter may be omitted; together they intersect. An item matches exact values in notice `detail` naming the item or its currently bound topic (claims, releases, worktrees, merges, agent-message references). A session matches the sender, resolved addressees, or session-bearing notice facts (`session`, `from`, `to`, `by`, `pair`), including arrays such as a mute's pair; harness, role and rule metadata do not name sessions. Message text is not searched; `T-1` does not match `T-12`. The spoke's `history {topic:"agents", item:"T-12", session:"impl-12"}` accepts the same filters (default 50 matches); other topics refuse these filters.
- **Unread.** The human's unread count per topic is the messages from others since the human last read it: the UI sends `topic.read` when the thread is in view, and a message the human writes reads what came before it. It never moves back. The watermark is a message's place in one monotonic sequence the store keeps (`counters.message_seq`, `messages.seq`), never a rowid: retention emptying the table does not make new messages read. The sequence starts above every stored seq and every watermark, so a file an older hub left (watermarks migrated from rowids, its messages pruned) hides no new message. Agents have no unread concept.
- **The human** writes through the UI (`topic.send`), into any topic but Agents: Agents is read-only, a record of what agents send each other, and a `topic.send` there is refused unless it is a reply: with `replyTo` naming an agent's message in Agents, the reply is recorded there and addresses that message's sender, found by the session id it wrote from, so a sender renamed since is still reached (a hub notice has no sender to answer). The message addresses `to` when given, else its mentions: `@coordinator`, `@implementer`, `@reviewer`, `@qa` reach the role's live holders, `@<session-name>` that session (a session the hub knows); with no mention, the Coordinator. `@all` and globs stay text for the human; a mention that names no session and no role is reported as `unknown` and addresses nobody. Each address counts once, with or without its `@`. The addressed party answers with `send` and the topic's id, so the reply lands in the same topic. A party other than the Coordinator may answer the human there (no `to`) while the human's latest message in that topic was delivered to it, by its name or its role (see Permissions); elsewhere it writes to the Coordinator.
- **A role, for the human**, reaches its live holders only: a holder that went offline is not an addressee (it was replaced, or will take the role again on its hello). With no live holder the message is queued under the role, and the first session to take the role (its hello) gets it, also a session that was already addressed by name in the same message (one delivery, one ack). The stage stays `queued` until that session acks. One role may have several holders: all of them are reached. The sender is `human`, a reserved name.
- **A session** writes with `send`: with no `to` the message is for the human, in the given topic or General; with `to` it goes to sessions and is recorded in the given topic or Agents. A role reaches its live holders, or, with none connected, the offline holders the hub remembers (queued for them); a role nobody ever held answers `empty`.

`send` accepts `kind: "progress" | "report" | "question" | "decision"`; an omitted kind is `report`, and other values are refused. Reports, questions and decisions use the normal turn-starting delivery path. Progress notes stay `queued`, start no turn, and reach each recipient as one ordered digest with its next ordinary delivery. A reconnect's role clause leaves progress held. The digest carries each note's sender, message id, topic and attachments, followed by the triggering delivery, in one harness input on Claude Code, Codex and OpenCode. A message to the human is recorded immediately, whatever its kind.

Held notes and their digest membership live in the existing SQLite delivery queue and survive a hub restart. A batch's membership is fixed when its triggering delivery is recorded; notes arriving afterwards wait for a later delivery. The spoke acknowledgement and the adapter confirmation advance the whole batch together, while history and the journal retain each original message and its stage. The journal's `send` record includes the kind. Unconfirmed injections retry the same batch; an uncertain outcome holds the whole batch for the existing manual retry path.

Unbound progress keeps the existing queue TTL: expired notes are dropped and journalled before binding. Once bound, a note follows its trigger's TTL, and the batch expires together. Retention preserves every member of a pending batch. If a trigger is deleted, surviving pending notes are released to the same queue with their original TTL and the release is journalled. Injected or dropped notes lose their binding and stay settled. Renaming onto a name with any queued, delivered, uncertain or injected delivery is refused with the target and its unacknowledged count before any mutation. A rename also refuses any duplicate message delivery row between the source and target, regardless of state, naming the target and collision count. Other renames follow the existing behavior.

## Asks and the inbox

An **ask** is a question the Coordinator puts to the human inside a topic (spec 4.5, decisions #7 and #10): a message whose text is the question, with a card in the store's `asks` table (the numbered options, whether a free answer is welcome, its state).

- **Only the Coordinator asks.** The spoke tool `ask {topic, question, options, free?}` (frame `{"type":"ask","topic","question","options":[…],"free"?}`) from a session holding any other role, or none, is refused with the typed shape the permission table (#30) answers with: `{"ok":false,"error":"forbidden: ask (only the Coordinator asks the human: Implementer may not ask; …)","code":"forbidden","permission":"ask","role":"implementer","reason":"…"}`, which the spoke hands the model as it is. The permission table (`ask`, the Coordinator's in the defaults; `roles.toml` may grant it elsewhere) is the one rule: the dispatcher refuses first, as for any tool, and the ask handler applies the same `decide` (with the default table on a hub that has no role definitions).
- **The card.** A question (one message, at most the hygiene's size), at most 9 options (one line of at most 200 characters each; the keys 1-9 answer them), `free` true unless given false; options or a free answer are needed. Not in Agents. The result is `{"ask":"<message id>","topic":{"id","title"}}`.
- **Waiting.** An open ask makes its topic `waiting for human` (a `topic` event) and keeps it so: a plain human message, an agent's message, anything but the answer, `resolve` or a close leaves the status there. Several asks may be open in one topic.
- **The answer.** `topic.answer {ask, option?, text?}` (UI): option `n` (1-based) sends that option's text, else `text` is the free answer (refused when the ask takes options only). It is the human's message in the ask's topic, carrying `answerTo` (the ask's id), addressed to the session that asked (or, when that session has since handed over the role it asked as, to the role: its new holder inherits the ask, which `role.state` lists under `asks`) and delivered like any human message (the spoke shows `answer_to` on the channel event). The ask is `answered` with the answer's id and the option; when no ask in the topic stays open the topic waits for the agent (the human spoke last). An ask that is not open takes no answer.
- **Withdrawn and cancelled.** `resolve` (the Coordinator's tool or the human's `topic.resolve`) withdraws the topic's open asks; when the human withdrew them, each asker gets a hub note in the topic (a notice of kind `ask-closed`, through `noticeInTopic`). Closing the topic (`topic.close`) or its bound item cancels its open asks, and each asker gets a hub note (`cland hub: your ask "…" was cancelled: T-1 was closed`). A note does not reopen the topic.
- **Events.** The `message` event of an ask carries `message.ask` (`AskCard`, below); every change of an ask's state is an `ask` event, `{"type":"ask","topic","ask":"<id>","card":AskCard}`. `topic.history` returns each ask with its card and each answer with `answerTo`. The log and the journal record `ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`; Agents records none of it (asks and answers are the human's, not agent-to-agent traffic).

`AskCard` is `{"question","options":[…],"free","state":"open|answered|withdrawn|cancelled","answer"?:"<message id>","option"?:n}`.

The **inbox** (spec 5, `Inbox.dc.html`) is the human's queue, in a fixed order: what only the human can unblock first, oldest first within each section.

| Section | What feeds it |
| --- | --- |
| `asks` | The open asks: `{"id","topic":{"id","title","item"?},"question","options","free","from","label","ts"}`. |
| `approvals` | Launched sessions (the process table) in `waiting for approval`, plus a connected session reporting it: `{"session","label","harness","since","attach"}`; one row per session id (a launched session that renamed itself shows under its new name, with its launch's attach command). The hub does not answer them (spec 4.3): the attach command opens the harness's own prompt. |
| `waiting` | Topics `waiting for human` with no open ask (`Topic`). |
| `notifications` | Dismissable, never blocking: a verdict comment written through the hub, from the verdict the file records (a structured `verdict` or a text whose header lines read back as one) (`T-1 review not clear · rev-1 · run r-1`, with `item`, `session`, `result`), a role assigned, cleared or granted at launch (`rev-1 is Reviewer: assigned`, from the `session.role` event), a handover (one row, the first line of its `handover` notice in Agents: `coord [Coordinator] handed the Coordinator role over to next, with a handover note`; its two `session.role` events make none), a harness that died (`impl-3 [Implementer] died: its harness exited; …`), a session idle longer than the threshold (`impl-1 [Implementer] idle 30 min`), an inject whose outcome is unknown (`coord [Coordinator]: a message may or may not have reached its harness (…); … cland session retry coord <id> sends it again`). Each `{"id","kind":"verdict|role|death|idle|delivery-uncertain","text","ts","item"?,"session"?,"result"?,"dismissed":false}`, stored in `hub.db` (table `notifications`) with its `dismissed` flag. |

`needsYou` counts inbox entries classified `now` by the hub, with default notifications in `watch` until T-171 defines their resolution. Project overrides can raise verdicts, deaths or long idles to `now`; they count until dismissed. See [visibility classification](../docs/visibility.md). Retention never removes an open ask or its message, whatever its age; an answered, withdrawn or cancelled ask goes with its message. Deleting a topic (its asks go with it) and a prune both publish the inbox again. `hub.status` carries it as `needsYou`, so the top bar shows it without computing.

| Request | Result `value` |
| --- | --- |
| `{"type":"topic.answer","id":…,"ask":"<ask id>","option":2}` or `"text":"…"` | `{"message":TopicMessage,"outcomes":[…]}` |
| `{"type":"inbox.list","id":…}` | `Inbox`: `{"asks","approvals","waiting","notifications","needsYou"}` |
| `{"type":"inbox.dismiss","id":…,"notification":"<notification id>"}` | `Inbox`; an ask's or a session's name is refused (`asks and approvals are not dismissed: answer them`), an unknown id too; dismissing twice is harmless |
| `{"type":"inbox.dismiss_all","id":…}` | `Inbox`, its notifications gone; asks and approvals stay |

| Command | What it does |
| --- | --- |
| `cland inbox [--json]` | The inbox from a terminal: one block per open ask (the ask id, the topic title and its bound item, the asker's label, the question, the numbered options), then one line per approval, waiting topic and notification, last `needs you: <n>`. `--json` prints the `Inbox` value as the hub returns it. |
| `cland topic answer <ask id> <option number>` | Answers an ask with its option n (1-based): prints `answered <ask id> in <topic title>: <the answer>`. |
| `cland topic answer <ask id> --text "<free answer>"` | Answers an ask with a free answer (refused when the ask takes options only). The hub's refusals (an ask that is not open, an option out of range, a free answer to an options-only ask) print `cland: <error>` with exit code 1. |

Subscribers get `{"type":"inbox","inbox":Inbox}` whenever any of it changed (an ask, a session's state, a topic, a notification, a dismissal), coalesced to one per turn of the event loop and only when it differs from the last one sent. The idle threshold is `[inbox] idle_minutes` in `.cland/config.toml` (default 30; `CLAND_IDLE_NOTIFY_MS` overrides it, for tests); the clock starts at each transition to `idle`.

## Roles

A session holds at most one role: Coordinator, Lead, Implementer, Reviewer, QA or Aide (spec 4.4, v0.1 §3.3). On a project's hub the role is the hub's state, not the session's (ADR 0001): the human assigns and revokes it, or a launch for the role grants it. A hub with no project (`createHub` in tests) takes a hello's role as declared and delivers no clause.

A Coordinator launches a Lead with `session.launch {"name":"lead-1","role":"lead","item":"T-12"}` (CLI: `cland session launch lead-1 --role lead --item T-12`). The node must be an open container named in `[tracker] levels` (epic or release by default). The hub runs the Lead at the project root, sets `process.item` to the node and takes its durable claim; no task branch or worktree is created. One Lead holds a node, and a Lead claims at most one node. Concurrent launches reserve the node before spawning, and a failed claim stops the new harness. An existing Lead claim must be released before replacement; stop alone retains the claim for resume. A Coordinator or human claim may yield to the launch. Human UI/CLI callers retain their unrestricted access; every agent caller must be the Coordinator, even when another role’s permission file grants `session.launch`, including a name already assigned the Lead role.

Lead scope is checked from the live container claim, stable session identity and current item ancestry on both spoke and CLI requests. Reparenting or releasing a claim changes admission immediately; launch, stop and merge recheck after asynchronous preparation and before mutation. A stopped session is managed according to every open claim or verifier hold it serves; when it has no holds, its launch item supplies the binding. Shared verifiers serving another subtree cannot be stopped by this Lead. Unbound launches/stops, other-node sessions and outside-subtree review/QA request lines are refused with the claimed level and node in the typed `forbidden` response and Agents notice. Releases, sync, push and unscheduled merges remain at the root; extra Lead grants cannot widen these boundaries. Use `item` on a verifier launch to bind its work; legacy Coordinator verifier launches with `cwd` still work. Existing projects apply the exact role-file edits in [T-178 handover](../docs/agents/T-178-handover.md); `cland update` preserves project roles.

`@lead T-12` addresses the nearest lead on that node’s chain (skipping the sender’s own claims), and bare `@lead` addresses the Lead role. The epic row and item fields show `lead-1 [Lead]`; the sessions panel shows its node. Leads are non-exclusive at the role level, so different nodes may have separate Leads. Existing role files inherit the new built-in role when `[lead]` is absent; `init` writes the stanza in new projects. Lead defaults match the Coordinator’s launch defaults. Leads may launch Implementers, Reviewers and QA with an explicit `item` in their live claimed subtree, stop sessions through their own CLI shell, request review/QA and merge scheduled descendant tasks through the ordinary verdict and criteria gate. Planning and node handover are later slices.

Aides work for the human alone and may run concurrently. The default crew clauses state that an Aide speaks for the human, decisions included: its messages are the human's instructions within the recipient's role. Existing projects add that line to the Coordinator, Implementer, Reviewer and QA clauses in `.cland/roles.toml`; cland leaves that file alone. Address them by session name: role tags (including `@aide`), `all` and globs exclude both live and offline Aides. Agents notices and asks do not reach them. `@lead T-n` may select an Aide through its item claim or inherited subtree ownership; otherwise it selects the nearest claiming Implementer, container Lead or the Coordinator. Aides may write to the human in any topic, edit the tracker in full through the eight §3.3 tools, and create or promote artifacts. They cannot manage sessions, ask, resolve, merge, hand over roles, release, sync or `cland push`. Refusals name the Aide rule in v0.1 §3.3; extra permission grants cannot override that boundary.

When the human tells an Aide to take a task, `task.claim` returns its branch and worktree and moves the status to `in progress`. The Aide works in that path; a claim does not change a running harness's cwd. It becomes the item's lead, so human `@lead T-n` mentions and verifier reports addressed to `lead T-n` reach it. Commit and push the task branch to the local territory (`origin`), then set status `review` and report to the Coordinator by session name. Independent review and any required QA pass through the same merge gate; the Aide claimant cannot supply its own verdict, even after changing roles. The supervising Lead, Coordinator or human merges through the gate. Launch with `--item` takes an Implementer’s item or a Lead’s open epic or release; Reviewer/QA launches bind to the item and its worktree without taking the Implementer claim.

When a session becomes an Aide, pending broadcasts and explicit subscription notices from its previous role are dropped, including digest members. Deliveries addressed by name (or its claimed-item lead, including default events) survive; named progress bound to a discarded broadcast waits for the next direct delivery. Addressing provenance is recorded per delivery. Rows written before that provenance existed cannot establish a direct address and are dropped on an Aide transition, apart from the role clause.

### `.cland/roles.toml`

One table per role: `clause` (multi-line text), `skills` (list), `exclusive` (the Coordinator), `[<role>.launch]` with `harness`, `model` and `effort` (`""` is the harness's default) and how the launched session may act (`approval`, `sandbox`, `writable_roots`, `network`: below), and `[<role>.permissions]` `tools`, the permission list the hub enforces (see Permissions below; a role table without `tools` gets the built-in list). A role the file leaves out takes its default; an unknown role or a wrong type makes the file unreadable. The defaults:

| Role | Launch defaults | Approval and sandbox | Skills |
| --- | --- | --- | --- |
| Coordinator (exclusive) | claude-code, `claude-fable-5-1`, effort `max` | none given | wayfinder, to-spec, to-tickets, triage, grilling, code-review, handover |
| Lead (one per node) | claude-code, `claude-fable-5-1`, effort `max` | none given | handover, merge |
| Implementer | opencode, a free model the server lists (`""`; pin one, e.g. `opencode/big-pickle`) | `never`; `danger-full-access` (applied when it is launched on Codex) | implement, tdd, diagnosing-bugs |
| Reviewer | codex, `gpt-6.1-sol`, effort `high` | `never`; `read-only` | code-review |
| QA | codex, `gpt-6-astra`, effort `high` | `never`; `danger-full-access` | diagnosing-bugs |
| Aide (non-exclusive) | claude-code, the human's configured model (no `model` key; set one to override), effort `max` | `never`; `danger-full-access` | none |

The human decided on 2026-10-09 (T-65) that every session of every harness must be able to do any work its role needs. Implementer and QA therefore default to full access with no approval prompts, the equivalent of Claude Code's auto mode. Reviewer stays read-only with no network.

How a launched session may act is read from `[<role>.launch]` at each launch, and again at a relaunch (`session.resume` with `relaunch`). They belong to the role, whatever harness a launch names (the model and effort are the role's harness's only). The Codex adapter applies it (The Codex adapter, below); Claude Code and OpenCode keep their own permission settings and ignore these keys.

| Key | Values | Meaning |
| --- | --- | --- |
| `approval` | `never`, `on-request`, `untrusted`; `""`: the adapter's default, which is `never` too (as with no role) | Whether the session stops to ask the human before a command its sandbox refuses. With `never` nothing waits on the human: the command fails and the session goes on. |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access`; `""`: the harness's own | What the session's commands may write: nothing; the session's cwd and the temp dir; or anything (no sandbox). |
| `writable_roots` | a list of directories, relative to the project root; needs `workspace-write` | More writable directories. One that holds a `.git` directory is writable with it, and with the session's own git directory when that lies there (a worktree's `.git/worktrees/<name>`): this is what lets a session in a worktree commit. |
| `network` | `none`, `local`, `full`; needs a sandbox | `local`: Unix sockets under the project's `.cland/`, the session's cwd and the temp dir, and loopback, so `cland` reaches the hub and tests start their own hubs; every other host is refused. `full`: the whole network. |

A key the table leaves out takes the role's built-in value from the table above, key by key, so a `[<role>.launch]` written before these keys existed still launches with its role's approval and sandbox defaults; only a written value overrides, and `""` asks for none. Inherited roots apply only to `workspace-write`, and `danger-full-access` closes no network. The Coordinator has no built-in values. A wrong value, `writable_roots` with a sandbox that is not `workspace-write`, or `network` or `writable_roots` with `sandbox = ""` makes the file unreadable, as any other mistake in it. `cland role list` shows each role's values. `docs/review-and-qa.md` ("The Codex sandbox") says what each role's sandbox allows, what it cannot, and why.

Projects that prefer T-48's restricted profile can set the following keys in `[implementer.launch]` (and in `[qa.launch]`, omitting `writable_roots` for QA):

```toml
approval = "never"
sandbox = "workspace-write"
writable_roots = ["."]
network = "local"
```

Write `network = "local"` explicitly: omitted keys inherit the current role defaults, whose network is full for Implementer and QA. The profile still supplies writable git directories and local sockets through the named Codex permissions profile; its limits and earlier measurements are in `docs/review-and-qa.md`.

The hub loads the file asynchronously before serving requests, then reads it on a 500 ms timer (`ROLES_REFRESH_MS`), without depending on filesystem watches. A saved edit becomes visible within 500 ms plus the async read and parse time; if a read was already in flight, allow that read to finish plus the next 500 ms tick and read. Slow or unavailable storage can delay refresh, but never blocks a permission check. Each check reads only the last successfully parsed snapshot. A refresh publishes a new map atomically; a check already using the previous map keeps it for that synchronous stretch. Handlers that await file preparation check the current snapshot again before publication, so a grant revoked during the wait refuses the resumed action. Read replay is invalidated when the snapshot changes, so a cached allowed answer cannot survive the refreshed grant. A file that does not parse is logged (`roles-unreadable`); a removed file is logged (`roles-missing`); both keep the last good permissions and launch defaults. An unreadable startup file keeps the built-in defaults. The hub never rewrites an existing file. Launch, relaunch and human role assignment instead await `RolesFile.fresh()`: an asynchronous stat, any older refresh already in flight, and a new read when the file changed. Parsing still publishes only changed valid text. These rare operations immediately see a saved launch-profile or clause edit; hot permission checks retain the bounded-refresh snapshot.

### Assignment

- **The human** assigns with `role.set` (UI) or `cland role set <session> <role>`, and revokes with `role.clear` or `cland role clear <session>`. With a note or `move` the role moves from its holder (see Handover). A live session gets its clause at once (and what was queued for the role); a name not connected yet gets the role when a session takes the name. A role follows the name: a session that reconnects under it has it back.
- **A launch for a role** (`session.launch` with `role`) fills what it does not give from the role's launch defaults: the harness, and the model and effort when the harness is the role's. The launched session's hello is granted that role. Optional `cwd` selects its working directory (absolute or relative to the project root); without it, the project root is used. The directory must exist; otherwise the hub refuses the launch with code `invalid-cwd`.
- **`CLAND_ROLE`** is only a request: a hello whose name holds no role and that the hub did not launch for one is refused with `{"type":"error","code":"no-role","message":"no role: \"rev-1\" holds none … — assign one with `cland role set rev-1 <coordinator|implementer|reviewer|qa>`; the session connects on its next retry"}`. The spoke keeps retrying with its backoff and logs the refusal; once the human assigns the role it connects.
- **Coordinator is exclusive.** Assigning it, or launching for it, while another session holds it (live, or remembered within the queue's TTL) is refused, naming the holder: `role "coordinator" is held by coord [Coordinator] (live): one session holds it at a time — clear it first with `cland role clear coord``. It is checked on every hello too: a holder remembered past the TTL that comes back after another session took the role is refused it (`no-role`), its remembered role is cleared, the log says `role-superseded` and subscribers get its `session.role` (`role` null, `reason` `superseded: …`).
- **A launch reserves its role** in the store before anything is spawned (`role-reserved`), so a second launch for an exclusive role, or the human's assignment of it, is refused while the first is under way. A launch that fails gives back what it reserved, the grant of a spoke that said hello early included (`role-reservation-released`, `reason` `launch-failed`). The reservation is recorded in `hub.db` (`launch_reservations`) with the role and cleared once the launch's process row is written: a hub that dies in between gives the role back at its next start, before it reads any frame, when the name has no running process row and no live session (`reason` `interrupted`). The launch's first hello is granted the launch's role whatever the name held before.
- **A dead holder** (its harness exited, or `session.stop`) leaves its role vacant; the process table keeps the role, so a relaunch (`session.resume --relaunch`) takes it back. The human's assignment or revocation of a launched session is written to its row too, found by the session's id: a rename renames the row (an adapter's files kept by name follow it), and a resume writes back the role the row holds when it ends, never the one it started from.

### The clause

On assignment and on every hello of a session holding a role, the hub records the clause as a hub notice to the session (`from: "hub"`, no topic) and sends it as a `role` frame, ahead of what else waited:

```json
{"type":"role","id":"<message id>","role":"reviewer","clause":"You are a Reviewer: …","skills":["code-review"],"message":{"id":"<message id>","from":"hub","fromKind":"hub","via":"hub","to":["rev-1"],"text":"cland hub: you hold the role Reviewer in this project, shown to others as rev-1 [Reviewer]. …","ts":"…"}}
```

The spoke acks it like a `deliver` and logs it. A spoke that delivers itself shows the message's text as a channel event with `kind="role"` and `role` in its meta; in a launched session the adapter injects it as a turn (the session's first one), with the delivery pipeline's retries. A newer notice supersedes one still waiting (it is marked dropped). Revoking sends a notice with `"role":null` that tells the holder to stop acting in the role. The journal records each delivery: `role-clause` (session, role, reason `hello` | `assigned` | `assigned at launch`, message id) and `role-revoked`; the spoke's ack shows as `acked`.

An adapter whose new session needs a first turn (Codex: a thread has no rollout before one, so attach and resume would fail) declares `clauseAtSpawn` and gets the rendered clause in `spawn`: the first turn carries it, and the hub records that launch's first hello's delivery as injected (`reason` `assigned at launch (first turn)`) instead of injecting it again, also when the name already held the role. Every later hello delivers it as above.

### The frames, the events, the CLI

| Request | Result `value` | Who |
| --- | --- | --- |
| `{"type":"role.set","id":…,"session":…,"role":…}` | `{"session":RoleHolder}` | UI, CLI |
| `{"type":"role.clear","id":…,"session":…}` | `{"session":RoleHolder}` | UI, CLI |
| `{"type":"role.list","id":…}` | `{"roles":[{"role","label","exclusive","skills","launch","holders":[RoleHolder…]}…],"coordinator"}` | UI, CLI |
| `{"type":"role.set","id":…,"session":…,"role":…,"note"?:…,"move"?:true}` | `{"session":RoleHolder}`: the role moves from its holder (Handover) | UI, CLI |
| `{"type":"role.state","id":…,"role":…}` | `RoleState` (Handover) | UI, CLI |
| `{"type":"role.handover","id":…,"to":…,"note":…,"then"?:"implementer"}` | `{"session":RoleHolder}` | spokes whose role grants `role.handover` (the Coordinator) |
| `{"type":"role.state","id":…,"role"?:…}` | `RoleState` of the caller's own role | spokes holding a role |

`RoleHolder` is `{"name","role","label","live"}`, where `label` is the name with its role, `rev-1 [Reviewer]`. `hub.status` and `session.list` carry `"coordinator"`: the live holder's name, or `null` for "no coordinator"; `hub.status` also carries `needsYou` (Asks and the inbox). Presence (`who`, `hub.status`) and `HarnessProcess` carry `label` beside `role`.

Events, after `subscribe`:

```json
{"type":"session.role","session":"rev-1","role":"reviewer","previous":null,"reason":"assigned","ts":"…"}
{"type":"role.vacant","role":"coordinator","ts":"…"}
{"type":"role.filled","role":"coordinator","session":"coord","ts":"…"}
```

`session.role` comes when a role is assigned, cleared (`role` null), granted at launch, handed over (`reason` `handover`, one event for each side), or vacated by its holder's death. `role.vacant` comes when no live session holds the Coordinator any more (cleared, disconnected, dead), right after the change that caused it; `role.filled` when one holds it again. At a hub's start there is no event: `hub.status` says it.

| Command | What it does |
| --- | --- |
| `cland role set <session> <role> [--note-file <file>] [--move]` | Assigns the role; prints `rev-1 [Reviewer]: role set` (`(offline)` when the session is not connected). `--note-file` (a Markdown note) or `--move` moves the Coordinator from its holder (Handover). |
| `cland role clear <session>` | Revokes the session's role. |
| `cland role list` | Each role with its launch defaults and holders, and the coordinator or `no coordinator`; `--json` for the raw value. |

### Handover

A role moves between sessions as hub state, never as a transcript (spec 4.4, ADR 0001, decision #10). The Coordinator hands its own role over with the spoke tool `role.handover {to, note, then?}` (only the Coordinator's table grants it); the human moves a role with `role.set` and a `note` or `move: true` (a plain `role.set` of a Coordinator someone holds is still refused).

- **The note** has four sections, each non-empty: goals now, work in flight, open decisions, waiting on. It is an object `{"goals_now","work_in_flight","open_decisions","waiting_on"}` or Markdown with those four headings (any level, any case). It is mandatory for `role.handover` and optional for the human. A note that misses a section is refused, naming it: `{"ok":false,"error":"handover refused: the note has no \"waiting on\" section — …","code":"note-incomplete","missing":["waiting_on"]}`. The `handover` skill (`.agents/skills/handover`) drafts it.
- **The receiver** must be a session the hub knows for `role.handover`: live, or launched by the hub and running. It may hold another role (it is replaced: one role per session). The human may name any session, as with `role.set`. Coordinator exclusivity holds: a third session holding it refuses the move.
- **The move** is one store transaction: the previous holder loses the role (or becomes an Implementer with `then: "implementer"`), the receiver takes it, the role's record (the note, who moved it to whom, when, the chain of holders, and the tracker claims to move along) is written in `role_state` in `hub.db`, and both Agents notices are recorded; all of it lands or none does. The claims the previous holder held (by session id) live in the tracker's tables: right after the commit they are re-pointed to the receiver's session id from the record, which is then cleared; a hub that died in between does it at its next start (the move is idempotent). When the receiver is a name with no session yet (the human's `role.set --move` to it), the claims follow at that session's first hello. A transfer still pending when the role moves on again (that receiver never connected) is carried into the next move's record, so the first holder's claims follow the role to the end of the chain. `task view` shows the receiver. Everything runs in one synchronous step: no frame is read between the checks and the last event.
- **The receiver** gets its clause with the note in one `role` frame, `{"type":"role","role":"coordinator","clause":…,"skills":[…],"note":{…},"from":"coord","message":{…}}`; the message text is the clause, then `Handover note from coord:` and the note as Markdown. The note rides with every later clause delivery to that holder (its reconnects) until the role moves again. A spoke that delivers itself adds `handover_from` to the channel event's meta.
- **The previous holder** gets the revocation, `{"type":"role","role":null,"reason":"handover","to":"next",…}` (`cland hub: coord no longer holds the role Coordinator (handed over to next). Stop acting as Coordinator…`; meta `reason`, `handed_to`), and every later call is refused `forbidden` as a session with no role. It stays connected until its next reconnect, which is refused (no role), as for any revocation. With `then: "implementer"` it gets the Implementer clause instead, headed `you handed the role Coordinator over to next: stop acting as Coordinator.`
- **The Agents topic** gets two hub notices: `coord [Coordinator] handed the Coordinator role over to next, with a handover note:` and the note (`the human moved the Coordinator role from coord [Coordinator] to next, with no note.` when the human did), then `next [Coordinator] took over the Coordinator role from coord.`
- **Subscribers** get `session.role` for the previous holder and the receiver (`reason` `handover`), and `role.filled` for the new Coordinator; `hub.status.coordinator` names it. The audit log records the call (`args.to`, the note only as `noteChars`; the human's as `role.set`).

**The role's state** is pulled on demand: `role.state` (a spoke reads its own role's; the UI and CLI any role):

```json
{"role":"coordinator","label":"Coordinator","holders":[RoleHolder…],
 "note":{"sections":{…},"markdown":"## Goals now…","from":"coord","to":"next","at":"…"},
 "handover":{"from":"coord","to":"next","by":"coord","at":"…"},
 "waiting":[{"topic":{"id":"general","title":"General"},"status":"waiting for agent","reason":"status","pending":1,"last":"…"}],
 "asks":[],
 "claims":[{"item":"T-1","title":"…","session":"next","sessionId":"…","claimedAt":"…"}]}
```

`waiting` lists the topics waiting for the role: first those whose status is `waiting for agent` (#32) and whose latest human message was delivered to the role's holders (`reason` `status`), else those where a message addressed to the role, or to one of its holders, the current ones and every one it passed through in its handovers, is newer than their last word in the topic (`reason` `addressed`, `pending` such messages). `asks` is empty until asks exist (#33). `claims` are the tracker claims held by the role's holders. `history` with a `topic` returns that topic's messages, so the new holder reads a waiting topic without the old session's transcript.

### Permissions

The hub checks every spoke tool call against the calling session's role, as the hub holds it at that moment (spec 4.4): a `role.set` or `role.clear` changes what the session may do on its very next call, with no reconnect. The table is `[<role>.permissions] tools` in `roles.toml`; the built-in one (`src/roles/permissions.ts`) is what the defaults write. A grant is `tool` (all of it) or `tool:scope` (only that part):

| Scope | Allows |
| --- | --- |
| `send:agents` | `send` to sessions (names, globs, roles, `all`) |
| `send:human` | `send` with no `to`: to the human (`send` alone grants both) |
| `task.edit:review` | the Implementer setting only `review` on its own live claimed item, with no other fields |
| `task.claim:own` | claiming or releasing only the session's own item |
| `task.comment:own` | plain comments (not verdicts) only on the session's own item |
| `task.comment:verdict` | verdict comments (`verdict`, `result`, `run`, or a text that reads back as a verdict header) on any item: a Reviewer only `review` verdicts, QA only `qa` verdicts |
| `topic.create:own` | a topic only bound to the session's own item (the item id trimmed first; ownership must be positive: a blank item, or one that cannot be looked up, is refused) |

**Mentions.** A session without `send:human`, but with some `send` grant, may still `send` to the human in a topic while the human's latest message in that topic was delivered to it, by its name (`@rev-1`) or its role (`@reviewer`): spec 4.5's mention pulls it in, Reviewer and QA included. The delivery is matched by the session id it was recorded for: another session that takes the name later inherits nothing. The topic is the `send`'s `topic` (General when absent). The grant ends with the human's next message there that addresses someone else; in any other topic the call is refused with `send:human`.

The session's own item is one it claims (the tracker's claim, held by session id) or whose `assignee` is it: when the hub writes an assignee (`task.create`, `task.edit`) it binds the item to that name's session id (table `assignees` in `hub.db`), so a rename, or another session taking the name, moves no ownership; an assignee the hub never bound (a hand edit, an import, a name with no session yet) is bound to the first session under that name that acts on the item. Names never change (spec 4.4): only the Coordinator renames, and the `rename` tool refuses any other role whatever `roles.toml` grants.

**Verdicts.** A `task.comment` whose text starts with a verdict header is a verdict: the hub parses the header into the verdict's fields and the tracker writes `by` from the caller (its name and the role the hub holds), never what the text says; a text that would still read as a verdict after its header is refused. A Reviewer records only `review` verdicts and QA only `qa` ones; the Coordinator and the human (the CLI) may record either, as a fallback.

An unknown tool or scope makes the file unreadable (the last good version stays in force). The defaults:

| Role | Tools |
| --- | --- |
| Coordinator | `send`, `ask`, `resolve`, `topic.create`, `task.create`, `task.plan`, `task.edit` (assigning included), `task.close`, `task.claim`, `task.link`, `task.rank`, `task.criterion`, `task.comment`, `session.launch` (and `session.list`), `session.stop`, `session.resume`, `hub.stop` (the last three from its shell: The CLI in a session's shell), `role.handover`, `merge`, `release`, `sync` (release and sync from its shell only), `artifact.create`, `rename`, `who`, `history`, `status`, `task.view`, `task.list` |
| Implementer | `send:agents`, `topic.create:own`, `task.claim:own`, `task.comment:own`, `task.edit:review`, `task.criterion:done`, `task.plan:show`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| Aide | `task.criterion` (done and manage), `task.create`, `task.edit` (any status), `task.close`, `task.link`, `task.comment`, `task.claim`, `task.view`, `task.list`, `artifact.create`, `artifact.promote`, `send` (session names or topics), `topic.create`, `history`, `who`, `status` |
| Reviewer, QA | `send:agents`, `task.hold`, `task.comment:verdict`, `task.criterion:verify`, `task.plan:show`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| no role | nothing (such a session is refused at hello; one whose role is revoked while connected is refused every call) |

`merge` uses the verdict gate below. `role.state` is no table tool: a spoke reads only its own role's state. `task.import` is the human's (the CLI). The heartbeat (`ping`) and acks are not tool calls. A hub with no project (no `roles.toml`) checks nothing. The UI and the CLI act as the human, whom the table does not restrict, with two limits. A client's hello comes over the Unix socket or stdio only: on a project's hub, one over the spokes' WebSocket is refused (`unauthorized`), so the bearer secret a spoke holds makes no human. A CLI `task.*` call acting as a session the hub knows (`as` carries its `sessionId`, which decides before any name: `cland task` in a launched session's shell always sends `$CLAND_SESSION_ID`, whatever `--as` says; or the human's `--as` names a session that holds or held that name) is that session's call: checked against the role the hub holds for it (never the frame's `role`), audited as it (`client: "cli"`), and its claims held by its session id.

A refused call is answered with a typed result, which the spoke hands the model as the tool's result (`isError`), and the hub posts a notice into the Agents topic, which the UI shows there:

```json
{"type":"result","id":"…","ok":false,"error":"forbidden: task.comment (Reviewer may only comment verdicts)","code":"forbidden","permission":"task.comment","role":"reviewer","reason":"Reviewer may only comment verdicts"}
```

`rev-1 [Reviewer] tried task.close T-12: forbidden (Reviewer may not use task.close)` (a hub message in `agents`, `from: "hub"`, addressed to nobody). `permission` names what was missing: `send:human`, `task.comment:verdict`, or the tool itself.

### The CLI in a session's shell

The adapters put `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` in a launched session's shell (Claude Code and Codex; `$CLAND_ROLE` too where there is a role). With either set, every frame the CLI sends carries the session as `as`, the hub takes the call as that session's (by the id first; an id or a name the hub does not know is a roleless session, refused everything that needs a role, never the human), and the audit records the session with `client: "cli"`. What the call may do:

| Command | In a session's shell |
| --- | --- |
| `cland task …` | The session's, checked against its role as its own `task.*` tools are (The tracker, below). |
| `cland session launch`, `list`, `stop`, `resume` (with `--relaunch` too), `cland hub stop` | Decided by the permission table: `session.launch` (which covers `list`), `session.stop`, `session.resume`, `hub.stop`. The Coordinator has all four by default: it launches the sessions, manages them from its shell and restarts the hub after a merge. A Lead may launch and stop within its live claimed subtree; the other roles are refused. From a session's shell `cland hub stop` signals the hub's process only after the hub accepted the request: refused, or unanswered, it exits 1 and signals nothing (the human's fallback to the signal stays). |
| `cland inbox`, `cland role list`, `cland hub status`, `cland worktree list` | Allowed: reading the hub's state. |
| `cland topic answer`, `cland role set`, `cland role clear`, `cland session attach` and `retry`, `cland hub unmute`, `cland worktree prune`, and any other frame (the UI's `topic.send`, `inbox.dismiss`, …) | The human's alone: refused. |

A refusal is the typed error of the table above, with the frame's type as `permission`, and it shows in Agents as any refusal does:

```json
{"type":"result","id":"…","ok":false,"error":"forbidden: topic.answer (only the human may do this; this call is impl-1 [Implementer]'s, by $CLAND_SESSION_ID)","code":"forbidden","permission":"topic.answer","role":"implementer","reason":"only the human may do this; this call is impl-1 [Implementer]'s, by $CLAND_SESSION_ID"}
```

A `roles.toml` written before these grants existed lacks `session.stop`, `session.resume` and `hub.stop` in `[coordinator.permissions] tools` (cland never rewrites the file): add them there, or the Coordinator's shell is refused them. The three are for the CLI only; the spoke has no such tools.

`cland hook` is the session's own plumbing (`session.signal`, `session.bridge`) and carries no actor. Without the variables every command is the human's, as before. What stays open: the CLI's identity is its environment, so a shell that unsets both variables is the human's, as any process holding the hub's socket and secret is.

### The audit log

Every tool call the hub answers, a spoke's (allowed or refused) or the human's through the UI or the CLI, is an `audit` event in the hub's log (`.cland/log/hub.log`) until the journal (#34) takes it over in this shape:

```json
{"ts":"…","event":"audit","session":"rev-1","sessionId":"…","role":"reviewer","tool":"task.close","args":{"item":"T-12"},"outcome":"forbidden","permission":"task.close","reason":"Reviewer may not use task.close"}
{"ts":"…","event":"audit","session":"human","sessionId":null,"role":"human","tool":"topic.send","args":{"to":["impl-1"],"topic":"general","textChars":42},"outcome":"ok","client":"ui"}
```

`outcome` is `ok`, `forbidden` or `error` (with `error`, what the tool answered). `args` keeps what the call was about (item ids, addressees, topic ids, names, flags; a CLI's `as`) and free text only as its length (`textChars`, `bodyChars`, `titleChars`, `commentChars`, a handover's `noteChars`): never a message's text. `session` is the name at call time, `role` the role the hub held then. The hooks' `session.signal` and `session.bridge` are plumbing, not audited. The decision #13 rule on sub-agents (they may not call hub tools through their parent's spoke) is not enforceable over one MCP connection: the audit is how a violation shows.

### Slow and repeated requests

The hub answers every frame on one event loop, so one slow handler holds up every client. Each frame's handling is timed, every stretch of it that runs on the loop: the first, and the synchronous work resumed after a `task.*` Git await or a `session.*` lifecycle await (a verdict's commit, a process-row publication, `"phase":"resumed"`) and the answer going out (`"phase":"answer"`). A stretch over 250 ms is logged as `{"event":"slow-request","tool":"task.list","client":"nvim","ms":812,"budgetMs":250}`. Time spent waiting for Git is not counted as blocking. Separately, receipt-to-answer latency over 5 s (including async waits) is logged as `slow-answer` with `tool`, `client`, `ms` and `budgetMs`; `hub.status` counts it in `requests.slowAnswers`, with the latest as `requests.lastSlowAnswer`. These never increment `requests.slow`. `client` is the UI's or the CLI's client name, or the spoke's session name. These are counted in `hub.status` (`requests.slow`, with the latest as `requests.lastSlow`) and shown by `cland hub status` on its `requests:` line. A `slow-request` means a handler did work that belongs off the request path. The time it measures is the time every other client waited.

A read (`task.list`, `task.view`, `session.list`, `topic.list`, `topic.history`, `inbox.list`, `role.list`, `role.state`, `hub.status`, `who`, `history`, `artifact.list`) that the same connection sends again within 250 ms of the answer to the same read gets that answer again instead of being handled, provided nothing changed in between. A change is any write frame on any connection, any hub or `task` event, or a spoke arriving or leaving. The answer is never older than the one the client would have had by asking a moment earlier, and a client always reads its own writes. The first repeat per connection and tool is logged as `too-fast`, and `requests.replayed` counts them all. Replayed answers are not audited. The Neovim workbench reads `task.list` only on connecting (the `task` events keep its items). It reads sessions and presence on connect and after its own launch or stop; `presence`, `session.process` and `session.usage` events keep the panel current between reads, without a timer.

`cland hub audit [--session <name>] [--since <ISO time | 30s, 15m, 2h, 1d>] [--json]` prints the records, oldest first: one line each (`ts  rev-1 [reviewer]  task.close  item=T-12  forbidden task.close (…)`), or one JSON object per line. `--session human` selects the human's calls.

## The Agents record, the journal and hygiene

**Agents** (spec 4.5, decision #7) is the project's record of what agents do with each other. Every message a session sends to other sessions lands there; one that names another topic is written there and referenced in Agents by an `agent-message` notice (below), its text not repeated. So does every lifecycle event, as a hub notice: a message `from` `hub`, `fromKind` `hub`, addressing nobody, with a `kind` and its facts in `detail`.

| `kind` | When |
| --- | --- |
| `redelivered` | A Codex turn ended without a message it had accepted, and the adapter delivered it again as a new turn or into a newer running turn (`harness-redelivered`). The notice says which destination accepted the recovery. |
| `spoke-joined` | Another spoke of a connected session said hello (`replaced` in the journal): nothing is lost, each spoke is answered. |
| `session-start` | A session was launched (`session-launched`), or re-found after a hub restart (`session-resumed`). |
| `session-stop`, `session-death` | It was stopped through cland; its harness process died (`harness-exited`). |
| `role-assign`, `role-revoke` | The human assigned a role (`(was …)` when it replaced another), a launch granted one at the first hello; the human revoked it, or its session stopped or died. A handover (`role.handover`, #31) is its own `handover` notice (with the note) followed by a `role-assign` for the new holder. |
| `claim`, `release` | A session claimed an item (`taken over from …` when forced); a claim was released, by its holder, by another, or because the item closed. |
| `handover` | A role was handed over (#31): who moved it, to whom, and the note. |
| `mute`, `unmute` | The loop breaker muted a pair; a person lifted the mute. These two are delivered to both sessions of the pair as well. |
| `refusal` | A tool call refused by the permission table (#30). |
| `agent-message` | A session's message to other sessions written into another topic: `alpha [Implementer] → beta in "Review of T-1" (topic-3): message <id>`, `detail` `{from, to, topic, message}`. |

`src/hub/agents-topic.ts` maps the domain events to the notices, as they are logged; the mute, the unmute, #30's refusals and #31's handover call `HubCore.noticeInTopic(topic, { kind, text, to?, detail? })`, the one path into the record. Tool-level noise never enters: commands, outputs, hook signals, state changes, acks and injections are journalled, not recorded in Agents. A lifecycle notice is recorded just after its event's own write; the event's journal line carries the notice's id (`agentsNotice`), and at start the daemon records, under that id, every journalled notice after the newest one recorded: the checkpoint `hub.db` keeps apart from the messages (`meta`, written with each journalled notice, never pruned), else the newest one Agents still holds. A notice whose journal append completed before the hub died is recovered once; notices retention removed never come back. If the stored checkpoint is absent from the surviving journal, recovery skips that entire older prefix: ordered appends prove its records precede the unflushed checkpoint, rather than treating the store as a legacy store with no checkpoint. Recovery persists the final surviving notice id as the new boundary (or clears the checkpoint for an empty prefix), so newer completed records from subsequent runs can still recover after an Agents recording failure. Events still in the async journal queue at a crash may be lost, as described below. (A `hub.db` from before the checkpoint whose notices were all pruned replays its journal once.)

**The journal** (spec 4.2, decision #13) is `.cland/journal.jsonl`: one JSON object per line, `{"ts":"<ISO>","event":"<event>",…}`, the hub log's own shape. It is a filter over the log closure every part of the hub logs through, so an event is journalled by being logged. It holds the domain events: `hub-started` and `hub-stopped` (written by the daemon at each start and clean stop), `config-loaded`; messages as metadata (`send`, `send-refused`, `human-send`: id, topic, sender, addressees, `bytes`, `replyTo`, outcomes; never the text); deliveries (`acked`, `injected`, `dropped`, `role-queue-claimed`); sessions (`hello`, `bye`, `rename`, `replaced`, `kick`, `refused-role`, `session-launched`, `session-stopped`, `session-resumed`, `harness-exited`, `session-state`); roles (`role-assigned`, `role-cleared`, `role-clause`, `role-revoked`, `role-handover`, `coordinator-vacant`, `coordinator-filled`); topics (`topic-created`, `topic-status`); asks and the inbox (`ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`, `notification`, #33); the tracker (`task-written`, `task-claimed`, `task-released`, `task-conflict`, `task-removed`); hygiene (`loop-breaker`, `unmuted`, `rate-limited`); and the audit records (`audit`, #30). The file is opened for appending: a restart adds a `hub-started` line after the last one and never truncates. A last line cut off mid-write (a crash) is ended with a newline before anything else is written, so it stays one unreadable line and every later record parses; a short write is continued until the whole record is out. `Journal.write(record)` enqueues a record that is not a log line. The process log, everything the hub says, stays in `.cland/log/hub.log`, through a separate ordered async append queue. The CLI and every transport use this same sink for ordinary events once serving. Startup, listener and orphan-sweep diagnostics and fatal logging errors retain stderr: a stdio parent can see why listeners failed to bind. Node writes file-backed stdio synchronously, so request-time audit and refusal events never use that sink.

**Append and durability (T-75).** The journal uses one ordered async append queue, to keep disk latency off the shared request path. Serialization and timestamping happen when a record is accepted; producers, including concurrent requests, keep their call order, even across short writes. A tool result acknowledges the action, not journal durability. SIGKILL or a crash may lose records still queued or partially appended; a completed append is in the OS cache, with no `fsync` guarantee against power loss. Clean stop first closes request edges and finishes shutdown logging, queues `hub-stopped`, then drains and closes both log queues before releasing the project lock or resolving `stopped`. Synchronous work after each async append, repair, open, close or error is measured in a resumed request scope; the enqueue captures the originating request identity. Background roles refresh publication and error logging have their own `roles.refresh` scopes. Waiting for I/O is excluded. A disk error reports `journal-failed` directly to the process log, stops further appends to avoid joining later JSON onto a broken tail, and rejects the drain. Shutdown still releases the lock and reports the failure; a restart ends any partial line before appending new records. Queue contents are in memory and grow while storage is slow; no crash replay of those unflushed records is promised. `hub.status` with `flushLogs: true` drains records accepted before the barrier in both queues without closing them; it never replays a cached status. The barrier fails after 5000 ms if storage does not complete, leaving ordinary status calls responsive. It acknowledges append completion, not `fsync` durability; later producers may still be queued.

**Request-path guard.** `test/session-async-processes.test.ts` instruments the native filesystem and process boundaries for the shared permission gate, allowed/refused dispatch and audit logging, alongside T-70's session process paths. The default daemon logger writes the actual process log asynchronously; a production CLI test with file-backed stderr also rejects audit writes through its synchronous sink. It rejects `statSync`, `readFileSync`, `writeSync`, `spawnSync`, `execFileSync` and `execSync` on those exercised paths. T-77 extends this coverage in `test/tracker-native-boundary.test.ts` to tracker mutations (including import), `task.view`, serving-time scans and fallback polling, and the shared session launch layer with a fake adapter. That guard rejects every exported synchronous filesystem function and synchronous process calls, including calls whose errors were swallowed. T-78 adds worktree claim/list/prune, merge refusal/landing/recovery, and release preview/publication/sync, with planted synchronous-call probes for each request path. Startup reads, native adapters' spawn paths (T-79), and the CLI journal reader are outside that filesystem coverage; T-70's production adapter process guard remains in force. `test/agents-checkpoint.test.ts` holds a checkpoint append during simulated crash recovery and proves old pruned notices stay pruned. `test/roles-snapshot.test.ts` verifies bounded refresh, last-good snapshots, deferred permission checks and replay invalidation. `test/journal-async.test.ts` verifies order, failures, the crash-loss window, drain on stop, and the request timer: a held async append allows another request to answer within the blocking budget without a `slow-request`, while a 400 ms deferred failure logger counts exactly once as resumed work.

**Hygiene** (BCAS's, decision #13): a message's size cap, a per-session rate limit and the loop breaker, which mutes a pair of sessions that exchanged more than the threshold within the window with no human message to either in between (a human message to a session starts its pairs' counts afresh). The thresholds are read from `.cland/config.toml` at hub start, so a change applies at the next `cland hub stop` and `start`; a missing or unreadable file means the defaults:

```toml
[hygiene]
rate_limit_max = 30               # messages one session may send to other sessions within the window
rate_limit_window_minutes = 10
loop_breaker_max = 20             # messages between one pair within the window before the pair is muted
loop_breaker_window_minutes = 5
loop_breaker_mute_minutes = 10    # the hard cool-down
max_text_bytes = 8192
```

A refusal is typed, `{"code":"hygiene","rule":"size"|"rate"|"loop","until"?:"<ISO>"}`: the size cap and the rate limit refuse the `send` itself (the result's `error` and `refusal`; the spoke's tool answer carries both), the loop breaker refuses the outcome for the muted addressee (`outcome` `refused`, `reason`, `refusal` with `until`). When the breaker trips, both sessions get the `mute` notice (its `detail` is the refusal and the `pair`; a spoke shows `kind` and `detail` in the channel event's meta) and Agents shows it. Rate windows, pair counts and mutes persist in the `hygiene` table of `hub.db`, keyed by session id: a restart keeps a mute running. `cland hub unmute <a> <b>`, or the UI's `hygiene.unmute`, lifts a mute early and clears the pair's count.

## Not here yet

- **The rest of the human side.** A verdict written by hand into an item's file is no inbox notification (only the hub's writes are).
- **Roles, the rest.** The Coordinator's role requests come later. A handover's `waiting` reads the topics `waiting for agent` (#32), and `asks` the open asks its holders put (#33). The UI shows the role with the name and the "no coordinator" warning with the workbench shell (#25), from the frames and events below.
- **Claims.** A claim stays until released, forced or the item is closed; nothing yet releases it when its session ends.

## cland init and cland update

`cland init [dir]` prepares a project (`dir`, else the project around the current directory); `cland update [dir]` rewrites what cland manages there to the running version and refuses a folder without `.cland/`. Both need no hub, are idempotent and print one line per path they touched (`--json`: `{root, version, changes: [{path, action, note?}]}`, actions `created`, `updated`, `unchanged`, `kept`, `removed`). A file is written only when its bytes change, so a second `cland init` changes nothing, mtimes included.

Every managed file or block carries `managed by cland <version>`. A file or hook without that mark is the project's own and is never written; it is reported as `kept`. The vendored skill files are the exception: they carry no mark of their own (they are upstream's text, byte for byte); the manifest's mark covers every file it lists.

Nothing is written or removed through a symbolic link: every destination and each folder above it inside the project is `lstat`ed first, and a link among them leaves the path alone, reported as `kept` with a note starting `symlink:` (a managed skill file or folder, `AGENTS.md`, `docs/agents`, `.claude`, …). A write goes to a fresh temporary file renamed over the destination, so it never follows a link planted after the check at the file itself. The folders above it are pinned too: each one's device and inode is noted before the temporary file is created and compared again just before the rename, so a folder swapped for a link (or another folder) in between refuses the write (`kept`, `symlink:`) and the temporary file is removed. What remains, as Node has no `openat`/`renameat`: a swap in the instant between that second check and the rename, and a temporary file left in a folder moved away after it was created. `CLAND_TEST_INIT_WRITE_PAUSE_MS` with `CLAND_TEST_INIT_WRITE_PAUSE_PATH` (tests only) holds the write of that path still after its checks. The managed set:

| Path | Committed | How it is managed |
| --- | --- | --- |
| `.cland/.gitignore` | yes | The hub's own rule: rewritten while its first line carries the mark. |
| `.cland/config.toml` | yes | Written with the defaults; `update` rewrites it to the current template and keeps the values it finds. |
| `.cland/crew.toml` | yes | Staffing policy, written once with defaults; reloaded on change, keeping the last good version. |
| `.cland/roles.toml` | yes | Written with the defaults when missing, then the human's: never rewritten (`roles.toml` above). |
| `.cland/tasks/.gitkeep` | yes | A mark line. |
| `.cland/hub.db` | no | The General and Agents topics, created through the store as the hub would at its first start. |
| `.agents/skills/<name>/` | yes | The skills cland ships: every skill of cland's own `.agents/skills/` (the vendored set with cland's patches, `skills/README.md`), read relative to the cland package. `.agents/skills/.cland-manifest.json` (with the mark) lists each skill's files: `update` rewrites those, removes what a newer cland no longer ships, and leaves other files in the folder alone. A skill folder of the same name that the manifest does not list is the project's: cland's is not installed. Ownership is per file: a file the manifest does not list, present where a newer cland ships one, is the human's: `kept` with a `conflict:` note, not adopted (remove it to take cland's). The manifest is validated before anything is touched: the mark in its `managed` field, skill names `[a-z0-9-]+`, relative paths with no `.`, `..` or empty segment, inside `.agents/skills/<name>/`; an invalid one is reported as `kept` and no skill is installed, updated or removed. |
| `.claude/skills` | yes | A relative symlink to `../.agents/skills`. When the project already has a `.claude/skills/` folder it is kept, and gets one symlink per cland skill (`../../.agents/skills/<name>`) beside the project's own. |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | yes | `skills/templates/docs/agents/*` with a first line `<!-- managed by cland <version>: … -->`. An existing file without it is kept and reported. |
| `AGENTS.md` | yes | A block between `<!-- cland:begin managed by cland <version> … -->` and `<!-- cland:end -->` (`skills/templates/AGENTS.block.md`): obey hub events, tasks through `cland task`, artifacts through the hub, sub-agents never use the hub. With a territory: only `cland release` pushes to `github`; without one: pushes to GitHub only on the Coordinator's decision. Rewritten in place; appended to a file without it; the whole file when there is none. Text outside the block is never touched. |
| `CLAUDE.md` | yes | Never created (its presence stops Claude Code from reading `AGENTS.md`). An existing one gets `@AGENTS.md` under a mark comment, unless it imports `AGENTS.md` already. |
| `.claude/settings.json` | yes | The cland hooks merged in: one entry per event of the Claude Code adapter (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, `PermissionRequest`, `PostToolUse`, `Notification`, `Elicitation`, `SessionEnd`), `async`, after the project's own. Their command is `[ -n "$CLAND_SESSION_NAME" ] \|\| ! command -v cland >/dev/null 2>&1 \|\| cland hook <event> # managed by cland <version>`: `cland` from the PATH, no machine path, the mark as a shell comment by which `update` finds and replaces them. Every other hook and setting is kept, in its order; a file whose content does not change keeps its formatting byte for byte. A file that is not valid JSON is kept and reported. |

The project hooks are for a Claude Code session started by hand, and do nothing where `cland` is not on the PATH. A session the hub launches already gets the same hooks, naming its session and hub file, through `--settings`, plus the cland mod (`--plugin-dir`) and the spoke (`--mcp-config`); there `CLAND_SESSION_NAME` is set and the project hooks stand aside. The mod is therefore not provisioned into the project: it needs the session's identity, which only a launch has, and its path would be a machine path. Committed files never hold a machine path or the secret.

### Local git territory

In a Git project, `cland init` creates the local bare repository `.cland/territory.git`, renames an existing `origin` to `github` (including branch upstreams), and makes the territory `origin`. Without an existing origin, it adds only the territory; a non-Git folder gets no territory and the report says so. If both `origin` and `github` already exist, it refuses before changing either: rename the existing `github` first. An unrelated repository already at the territory path is also refused.

All effective origin fetch and push destinations must point to the territory. Re-running init repairs extra URLs or push overrides on an existing territory origin; doctor reports them as failures. Git URL rewrite rules that still redirect the repaired URLs outside the territory are refused and must be fixed in Git config.

It creates `dev` from `main` when absent and seeds `main` and `dev` with a push to the local bare path, never to GitHub. Existing territory refs are preserved. The territory's `HEAD` points to `dev`, and so does the root's `origin/HEAD` (`dev` fetched from the bare path, then `git remote set-head origin dev`), so tools that branch from origin's default branch start from `dev`. One such tool is Claude Code's sub-agent worktrees under `worktree.baseRef: fresh` (decision D8). A clean root on `main` switches to `dev` before any managed files are generated; a dirty root, another branch or detached HEAD stays in place, with a reason in the report. An unborn repository gets the territory but cannot seed branches yet: commit `main` and run `cland init` again. All Git steps appear in text and `--json`, including `unchanged` on a second run. Report paths under `territory.git` include named operations (`remotes/origin`, `local-dev`, `root-branch`) as well as real files.

The root lives on `dev`: the Coordinator commits tracker and docs work there directly; task work reaches `dev` through `cland merge`; `main` moves through `cland release` and `cland sync`. The territory's executable `update` hook refuses updates and deletions of `main` and `dev` without cland's marker and names the required commands. Task branches remain free, force pushes included. This is a workflow guard on a local repository, not a security boundary against its owner.

`cland init --undo [--force]` undoes only the territory step; managed skills, configuration and docs remain. It removes the territory origin and renames `github` back to `origin` only if init performed that rename, carrying upstreams back. If init switched the root to `dev`, undo restores `main` when the root is still on `dev` and has no tracked changes; other or dirty branches stay put with a note. Git refuses any checkout that would overwrite an untracked file. The local `dev` branch is kept. Before any mutation, undo reads every destination in `remote.origin.fetch`, including custom wildcard and exact mappings, to identify the root tracking refs that remote removal will drop. It checks both those root refs (even without a territory copy) and every territory ref against objects reachable from surviving root refs: branches, tags, other remotes and HEAD. Symbolic aliases do not count as independent copies. If work would become unreachable, undo refuses and names the refs; preserve the work under a surviving ref or use `--force` to discard it. A dropped ref whose tip survives in another ref's history needs no force. Undo state is kept in the bare repository's `cland.*` config. Both undo and update rewrite the instruction block for the resulting presence or absence of a territory; update refreshes an existing territory but does not create one in an opted-out Git project.

The D15 migration interim ended when the repository moved its root checkout and task base onto `dev` after T-59. Task work now reaches `dev` through `cland merge`; only `cland release` pushes `main` and a release tag to `github`. `cland sync` imports collaborators' work.

The module interface for later hub commands is small: `territoryPath(root)` gives the absolute bare path; `withTerritoryLock(root, () => ...)` holds synchronous or asynchronous operations exclusively across processes. A synchronous callback returns its value directly; a Promise callback keeps the lock until fulfillment or rejection and returns a Promise with the same outcome. Do not nest locks. `territoryGit(cwd, args, marked = false, input?)` runs Git without a shell, with a 30-second deadline, and returns trimmed stdout or throws; optional `input` supplies stdin (used for reachability traversal without a command-line size limit). Pass `true` only for a guarded cland operation's push to protected refs; it sets `CLAND_TERRITORY_WRITE=1` for the child. The marker is an accident guard: the local owner can set it manually or change/bypass the hook. The lock `.cland/territory.lock` uses the hub lock implementation (exclusive creation, stale-process recovery); an overlapping caller is refused with the live holder's pid and may try again after that operation settles. `provisionTerritory(report, root)` and `undoTerritory(root, force)` acquire it themselves; `territoryProblems(root)` is read-only. The task worktrees add `taskBase(root)`, `ensureTaskWorktree(root, {id, slug, branch})`, `listTaskWorktrees(root)`, `commitsAhead(root, branch, base)` and `removeTaskWorktree(root, item)`. They return Promises and run Git through `territoryGitAsync` (`execFile`, awaited), so the hub's event loop never waits on Git. The two that write take the lock themselves, through `withTerritoryLockAsync`: the same lock file, taken with `acquireLockAsync` (`src/hub/lock.ts`), which awaits its `ps` probes and asks the process's own start time once. The hub queues these operations one at a time (`src/hub/worktrees.ts`), because the lock refuses a second holder instead of waiting for it. Init runs these without a hub; worktree, merge, release and sync commands call this module from the hub under the same lock (T-20 decision D2).

### Task branches and worktrees

In a project with a territory, a task's branch and worktree come from cland, never from the harness (T-58; T-20 decisions D3, D7, D8):

- **A claim.** The first claim of an open item of kind `task` (`cland task claim T-12`, the `task.claim` tool, anyone's) creates the branch `t/T-12-<slug>` at the base branch's tip, the slug being the item file's (`T-12-fix-the-parser.md` → `t/T-12-fix-the-parser`), and the linked worktree `.cland/worktrees/T-12/`. The worktree is linked to the project's own repository, so it shares the root's objects and refs, and the territory stays `origin`. The hub writes `branch:` into the item and records a `worktree` notice in Agents (`T-12: branch t/T-12-fix-the-parser from dev and worktree .cland/worktrees/T-12 created for impl-12`; journal `task-worktree`). An item that already names a branch keeps that branch. Every later claim, including one after a release, reuses the branch and the worktree, and a worktree folder deleted by hand is made again on the same branch. The claim's result carries `worktree: {item, branch, path, base, createdBranch, createdWorktree}`. When there is no worktree, it carries `worktree: null` and a `reason`, and the claim holds all the same. Releases, epics, specs, questions, maps, closed items and projects without a territory get none (`T-1 is an epic: only a task gets a branch and a worktree`, `T-5 is closed: no worktree`, `the project has no territory (cland init makes one): no branch or worktree`). A Git failure gets none either, with the reason prefixed `no worktree:`.
- **The base branch** is the territory's `cland.taskBase` when set, else `dev` when the project has it, else `main` (`taskBase(root)` in `src/territory.ts`). The override must name an existing local branch; `cland doctor`'s `territory` check fails when it does not. On cland's own repository the root stays on `main` until T-59 (T-20's comment of 2026-10-09, the D15 deviation), so task branches start from `main` there: `git --git-dir .cland/territory.git config cland.taskBase main`, removed with `--unset` once `cland merge` lands.
- **A launch with an item.** `cland session launch impl-12 --role implementer --item T-12` (the spoke's `session.launch` with `item`, the launcher form's `item` line) makes or reuses the worktree, starts the session with its cwd there, and only then claims the item for the session, by its session id. A Coordinator's or the human's claim is taken over (Agents: `impl-12 [Implementer] claimed T-12 (taken over from coord)`). Any other session's claim refuses the launch before anything starts, as does a Git failure while making the worktree, so the worktree always exists before its session. If another session takes the claim while the harness is starting, it keeps it: the launch is refused, naming the holder, and the session just started is stopped. A second launch for an item whose launch is under way is refused. `item` is for an Implementer: another role, or `item` together with `cwd`, is refused. A Reviewer or QA session meant to stand in the worktree gets `cwd`. An item that gets no worktree launches at the project root, with the claim and the `reason`. The result is `{process, claim, worktree, reason?}`, and the process row records `item` (the sessions panel shows the item beside the session either way, through its claim).
- **The worktree-creation refusal (D8).** A Claude Code session launched with an item gets a `WorktreeCreate` hook (synchronous, not `async`): `cland hook worktree-create --session <name> --launch <id> --worktree <path>`. Claude Code runs it in place of its own `git worktree add`, for `--worktree` and for sub-agents with worktree isolation alike. It exits 2 with `cland: impl-12 works in its own task worktree <path>; another worktree is refused. Work there (cd <path>), on its branch.` on stderr, which the harness shows. It also tells the hub (journal `worktree-refused`, a `worktree` notice in Agents). Only sessions launched with an item get it: the Coordinator's sub-agents still make their own worktrees, and so does any session launched without an item. Codex and OpenCode make no worktrees of their own.
- **`cland worktree list [--json]`** shows each worktree under `.cland/worktrees/` with its item, branch, the item's title and state, the commits its branch has that the base lacks, and the sessions whose cwd is inside it (connected spokes and running launched harnesses). From a session's shell it is allowed: it only reads.
- **`cland worktree prune [--yes] [--json]`** is the human's (refused from a session's shell with `forbidden: worktree.prune (only the human may do this; …)`). It lists the worktrees of closed items with their unmerged commits (those not on the base branch). It removes each worktree and its branch only after a `y` on stdin (`--yes`: all of them), and keeps one in which a session still stands or a launch for its item is under way. The item's state and the sessions inside are checked again under the territory lock right before each removal, so an item reopened, or a session that entered, while prune read Git keeps its worktree. Git's `worktree remove` refuses a worktree with uncommitted or untracked changes, and the failure is shown. Its first job on cland's own repository is the merged worktrees of T-48 and T-49.

The frames: `worktree.list` → `{worktrees: [{item, path, branch, title, kind, state, sessions, base, ahead}]}`, and `worktree.prune` → `{candidates}` with `dryRun` or no `items`, `{removed, failed}` with `items`.

### The merge gate

`cland merge T-12 [--json]` and the Coordinator spoke's `merge {item: "T-12"}` share one frame, `{"type":"merge","id":…, "item":"T-12"}`. The human may run it from their own shell. Implementer, Reviewer and QA calls, including their shell's CLI calls, are refused by the permission table and recorded in Agents.

Every acceptance criterion must carry both a `done` mark and a `verified` mark. A failed criterion refuses too. `criteria-incomplete` lists each incomplete criterion by id and text and says which marks it lacks; it moves no refs. A checked box alone supplies neither mark. An item with no criteria passes this check. `ready` uses the same check: adding an unmarked criterion or failing one returns a ready task to `in progress`; completing and verifying every criterion permits ready once the required verdicts are clear and current. Verification can come from a clear verdict with `--verified` or a separate Reviewer/QA `task.criterion verify` operation.

The human's `--override "reason"` bypasses verdicts and criteria together. When incomplete criteria are skipped, each merge validation records a `merge-criteria-overridden` journal event with `id`, `override` and `criteria` (the skipped ids, text and missing marks). These audit events describe the bypass even if a later Git check refuses the merge. Sessions cannot override; conflicts and dirty touched files still refuse.

In-flight legacy items use this gate as well. Their checkboxes read as unmarked criteria; the refusal names their text and the migration path. The claiming Implementer runs `cland task criterion T-12 done C1` (the first criterion operation assigns ids in list order), reads `cland task view T-12 --json` for the assigned ids, then marks the remaining criteria done. The Coordinator, human or Aide may also mark done. A Reviewer or QA records a clear verdict with `--verified all` or selected ids. An old clear verdict without verification does not complete this migration. Keep the existing item and branch; no bulk body rewrite is needed.

Merges run one at a time in the hub's territory queue (shared with task worktree operations), under the async territory lock. The gate checks an open task with a branch, the latest hub-written review verdict, and, when the resolved plan policy has a non-none scope and `when: per-item`, the latest hub-written QA verdict. `task.view` exposes `qaPolicy` and `qaCriteria`; tasks outside a plan take `[plan] qa_default` (none/per-item by default). Each must be clear, current, written by a session holding the corresponding role at write time, and from a session that does not claim the item. File-only headers and Coordinator rescue-run verdicts do not satisfy it. Selection follows durable hub write order; if any recorded verdict comment is missing or altered in the item file, `verdict-missing` names its run and commit rather than reviving earlier clear evidence. The role the writer holds now does not change its provenance. The gate refreshes branch tips and the configured task base asynchronously before reading the freshness cache; an unknown patch comparison refuses with `review-pending` or `qa-pending` until the background answer settles. No check command runs in the gate (D16). The retired `qa-required` label has no gate effect; `cland task plan migrate` converts labelled tasks under existing plans to per-item overrides and reports out-of-plan fallback ids. See [QA policy and migration](../docs/review-and-qa.md#qa-policy-from-the-plan).

The target is `taskBase`: normally `dev`, with the territory's `cland.taskBase` override honored during the D15 interim. The root must be checked out on that base. `git merge-tree --write-tree` builds the merged tree, keeping changes from both the base and the task. Conflicts refuse with `merge-conflict` and `files`, asking the Implementer to rebase; the gate never rewrites a task branch. Dirty files the commit touches refuse with `merge-dirty` and `files`. Unrelated staged and unstaged root edits are preserved. Every gate refusal leaves refs unchanged. A failed local ref update or rejected territory push attempts to restore the root checkout and refs while preserving unrelated edits; if either integration ref still holds the prepared commit, the result reports it as merged with recovery pending; the other typed reasons distinguish item/branch/base/checkout failures and review/QA missing, provenance, role, claimant, not-clear, stale and pending failures.

`git commit-tree` creates one commit with a single parent, the base's old tip. Its message is:

```text
The item's title (T-12)

Item: T-12
Reviewed-by: rev-12 (rev-run-id)
QA-by: qa-12 (qa-run-id)
```

`QA-by` appears when QA is required. The hub advances the root checkout, preserving unrelated edits, and pushes the base to the bare territory by its on-disk path with the protected-write marker. It then comments the full commit on the item, closes it and its topic, and releases its claim. Cleanup removes the worktree and branch once no connected spoke or running launched session stands inside and no launch is under way; while they do, cleanup retries in the background. Git keeps dirty worktrees, reporting the cleanup failure for the human to preserve and prune. The result is `{item, commit, base, cleanup}`. A failure after landing remains a successful merge result with `followUp: {step, error}`, whose error says `merged, follow-up failed: <step>`. The prepared commit, task tip, base and override reason are recorded durably before ref movement. A retry checks both integration refs for the recorded `Item:` commit, repairs an interrupted rollback checkout before pending publication, and finishes close, release, topic closure and cleanup without landing another commit, including across hub restarts. Before changing the root checkout, the hub records the exact expected before and after index trees, including unrelated staged edits, and retains that receipt through ref movement. If restoration fails before either ref moves, `merge-recovery` names the prepared commit and base; the next request restores its checkout before rechecking the gate. These recovery-pending events enter the journal and Agents instead of reporting a gate refusal. Rollback uses those snapshots; recovery refuses a subsequently edited index, and completed receipts preserve later staged edits. Cleanup checks the recorded task tip and deletes its ref by compare-and-swap; a moved tip keeps both branch and worktree. Cleanup can also finish branch deletion after its worktree was already removed. `task-merged`, `merge-refused`, `merge-resumed`, follow-up failures and cleanup failures enter the journal and Agents.

`cland merge T-12 --override "<reason>"` is for the human's own shell only, including when the Coordinator would otherwise be allowed to merge. It skips verdict and criteria checks, keeps conflict and root safety checks, omits verdict trailers, and records the reason on the item, in Agents and in the journal. Skipped incomplete criteria are named in `merge-criteria-overridden` journal events. The shipped `merge` skill forbids delegating a merge to a sub-agent: one in the Coordinator's shell would inherit its authority.

### Coordinator dev push

`cland push [--json]` fast-forwards the local territory’s `dev` to the root’s committed `dev`, under the shared territory queue and lock. The Coordinator commits tracker and docs changes on the root’s `dev`, then runs this command from its own shell; the human may also run it. It requires the `push` grant for the Coordinator; existing projects with explicit `[coordinator.permissions] tools` add `"push"` to that list. Implementer, Reviewer and QA shells are refused, even if their environment claims Coordinator. It has no spoke tool. Identity comes from the shell’s session id: sub-agents inheriting a Coordinator shell inherit its authority, so the Coordinator performs this command itself.

Push uses the on-disk territory path and a pinned commit, ignoring configurable push URLs. It fetches objects without writing tracking refs or `FETCH_HEAD`, verifies a fast-forward, and never forces. A behind or divergent root refuses with the territory commits’ hashes and subjects. The root must be on `dev`; pending merge checkout/item completion, release or sync recovery must finish first. Dirty root work is preserved. Repeating a successful push is harmless.

Before publication, authorization, lock, inspection and fast-forward failures leave local and territory refs and the checkout unchanged. A rejected Git push also leaves them unchanged; repair its reported obstruction and retry. If Git loses the reply after acceptance, cland checks the pinned territory commit. If both the push reply and its confirmation fail, `push-outcome-unknown` exits 2, records a distinct outcome event, and names the pinned commit: publication may have occurred. Verify territory `dev` and retry `cland push`; this outcome makes no unchanged-refs claim. Verified refusal exits 1. Success returns `{dev, previous}`; record or lock-release failure after publication returns success with `followUp: {step, error}` saying `pushed; follow-up failed`. In that case dev has landed: repair the named obstruction (a retained lock may need removal once its owner has stopped) and retry to confirm publication without another commit.

`cland merge` refuses unpublished root `dev` before preparing a landing, with `merge-unpublished`, listing those commits and saying `run cland push`. It leaves the checkout, integration refs, item and claim unchanged. Publish explicitly, then retry merge; tracker commits are never silently included in a task landing. A configured task base other than `dev` retains its existing merge behavior.

### Release and sync

Only `cland release` pushes to `github`. Task branches and integration work stay on the local territory. These commands use the hub's queued territory operations, the async Git runner, and the territory lock; no synchronous subprocess runs on a request path.

Worktree operations target a single-user local project and refuse detected path or inode changes, with Git-only rollback of escaped creations; they are not atomic against another local process rearranging directories concurrently.
Escaped worktrees with dirty work or detached HEADs are kept for manual recovery; a branch that moves during rollback keeps or regains its worktree.

`cland release vX.Y.Z [--dry-run] [--json]` sends a `release` frame with `version` and `dryRun`. The human may call it, or the Coordinator from its own shell with the `release` grant. Implementer, Reviewer and QA shells are refused even if their environment claims another role. There is no release spoke tool. The shipped `release` skill commits the tracker, previews the notes and refs, then asks the human for the next patch, minor, major or a free version before publishing. That choice belongs to the human, never the stand-in, and the Coordinator never delegates the release. New projects include the skill and grant in the Coordinator defaults; existing projects with explicit role lists add them to their own `.cland/roles.toml`.

Release pins GitHub's single configured push destination (multiple push URLs refuse) and fetches its main objects without changing local tracking refs or tags. It refuses a missing/malformed version (the accepted form is `vX.Y.Z` with three nonnegative integers and no leading zeroes), an existing local or GitHub tag, an empty `main..dev`, no `github` remote, an in-progress Git operation, or main checked out in any worktree. Keep the root on dev. If GitHub main has commits dev lacks, the error lists their short hashes and subjects and says `run cland sync`. Local main must be an ancestor of dev. Refusals and dry-run move no refs. Dry-run prints the release notes and the GitHub main/tag refspecs and never publishes.

The notes list one `T-12 <tracker title>` line per `Item:` trailer in `main..dev`, in commit order, followed by non-item commit subjects. If an item was removed, its commit subject supplies the title. Git creates an annotated tag object at the pinned dev commit, then one atomic push sends that commit as GitHub main and the tag object as `refs/tags/<version>`. No GitHub API is called and no project version file is changed. Only after that push succeeds does cland advance local main, install the local tag and publish main/tag to the territory. A GitHub hook rejection reports Git's message and leaves all local and remote refs unchanged.

The result is `{version, commit, notes, refs, dryRun}`. A failure after GitHub accepts the push returns `followUp: {step, error}` saying `released; follow-up failed`. Preserve `.cland/release.tmp`, repair the named obstruction and retry the same version. The receipt, written before pushing, pins the annotated tag object and dev commit. A retry checks that exact tag on GitHub and finishes the local refs and territory even after a hub restart or a lost push reply, without publishing later dev work. The receipt is removed when follow-up completes.

`cland sync [--json]` sends a `sync` frame. The human or the Coordinator's shell with the `sync` grant may call it; it has no spoke tool. It refuses while a merge still needs checkout, item, claim or topic completion, preserving that landing's recovery identity. From a clean root on dev it fetches GitHub, requires GitHub main to fast-forward local main, and prepares a replay of `main..dev` on the fetched commit in an isolated checkout. Replay retains merge structure. A dirty root refuses; a conflict aborts preparation, names the files in the error and `files` result field, and leaves every integration ref and the root tree untouched. On success it installs the replay in the root, atomically updates local main/dev, and publishes those refs only to the territory. It never pushes to GitHub.

Sync returns `{main, dev}`. A territory failure after the local refs move returns `followUp` saying `synced locally; follow-up failed`. Preserve `.cland/sync.tmp`, repair the obstruction and retry sync to publish the same replay. A changed root or ref during recovery is refused for manual reconciliation. Finish pending sync before merge or release, and finish a GitHub-accepted release before sync. Previews, releases, syncs and their refusals are recorded in the hub log and journal.

## cland doctor

`cland doctor [dir]` checks the machine and the project (`dir`, else the one around the current directory) and prints one line per check: `ok`, `warn` or `fail`, what it found, and for a `warn` or `fail` the fix after `— fix:`. The text is plain, to paste into an item comment; the verdict is coloured only on a terminal (never with `NO_COLOR`). `--json` prints `{root, version, checks: [{name, verdict, detail, fix?}], summary: {ok, warn, fail}}`. The exit code is 1 when any check fails, else 0: a warning never fails it. It starts nothing and changes nothing; the hub is only asked `hub.status`. Every probe runs with a deadline (20 s for a tool, 3 s for the `ps` that tells whether the hub lock's holder is still the process that took it; `CLAND_DOCTOR_PROBE_TIMEOUT_MS` overrides both, for tests) in its own process group: past the deadline the whole group is killed and its pipes closed, so a hung tool, or a wrapper's child holding its output open, neither blocks the report nor outlives it. A `ps` that does not answer in time counts as "cannot tell", and the live lock holder is kept.

| Check | `ok` when | Otherwise |
| --- | --- | --- |
| `claude-code`, `codex`, `opencode` | The executable (the adapter's `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, else `claude`, `codex`, `opencode` on the PATH) answers `--version` within the tested range: Claude Code `>=2.1.294 <2.2.0`, Codex `>=0.160.0 <0.161.0`, OpenCode `>=2.0.24 <2.1.0` (`src/doctor/ranges.ts`, the one place to widen after re-verifying an adapter). | Missing: `fail`, install it or set the variable. Outside the range: `warn` (older: upgrade; newer: it may work). |
| `claude-code auth` | `claude auth status --json` says `"loggedIn": true`. | `fail`, `claude auth login`. |
| `codex auth` | `codex login status` exits 0 (`Logged in using …`). | `fail`, `codex login`. |
| `opencode auth` | `opencode auth list --standalone --format json` lists a provider with credentials (`--standalone`: a private server for the call, the background service is not started). | None: `warn` (the free models still work), `opencode auth login`; the command failing: `warn: cannot check`. |
| `gh`, `gh auth` | `gh --version`; `gh auth status` exits 0. | `fail`: install gh, `gh auth login`. |
| `neovim` | `CLAND_NVIM`, else the pinned build in the launcher's cache (`nvim/bin/nvim-path.ts`), prints `NVIM <nvim/NVIM_VERSION>`. | Not downloaded: `fail`, run `cland open` (its launcher downloads and verifies it). `CLAND_NVIM` at another version: `warn`. |
| `project` | Only when `.cland/` is missing: then the project checks below are this one `fail`, `cland init`. | |
| `territory` | `origin` is the local bare territory, it holds `main` and `dev`, `HEAD` is on `dev`, and the protection hook is current and executable; a non-Git folder needs none. | `fail` names missing or damaged state; run `cland init` (restore a changed `origin` to `.cland/territory.git` first). |
| `hub` | `hub.json` names a live pid that holds `.cland/hub.lock` and answers `hub.status` on the socket, at this cland's version. | No hub (no file, a stale file): `warn`, `cland hub start`. A lock holder without `hub.json`, an invalid file, a hub that does not answer: `fail`. A stale file (its pid gone, or not the lock's holder) while a live process holds the lock: `fail` naming the holder, `kill <holder>`, then `rm .cland/hub.json` and `cland hub start` (`cland hub start` alone would refuse). Another version: `warn`, restart it. |
| `hub.json` | Valid (socket, port, secret, pid, version), or absent while no hub runs. | Missing while a hub holds the lock, or invalid: `fail`. Stale: `warn`. |
| `secret` | `.cland/secret` is 64 hex digits, mode 0600, the one `hub.json` carries. | Absent before the first start: `warn`; loose mode: `fail`, `chmod 600 .cland/secret`. |
| `roles.toml`, `config.toml` | Parse (`roles.toml` as the hub reads it, `config.toml` as `cland update` does). | `fail` with smol-toml's error and its line and column. Absent: `warn`. |
| `skills manifest` | `.agents/skills/.cland-manifest.json` is valid (validated as `cland update` does: the mark, the names, the paths) and each skill it lists is a folder holding its `SKILL.md` (cland's own repository, the skills' source, needs none). | `fail`, `cland update`. |
| `skills` | `.claude/skills` is a symlink resolving to `.agents/skills`, or the project's own folder whose entry per cland skill is a folder, or a link to one, holding `SKILL.md` (a regular file, or a link to a folder without it, fails). | Missing or broken: `fail`, `cland update` (a link pointing elsewhere: `rm .claude/skills` first). A link of the project's own elsewhere: `warn`. |
| `claude hooks` | `.claude/settings.json` holds the managed hook (`cland hook <event> # managed by cland <version>`) for every adapter event, at this version. | Missing: `fail`; another version: `warn`; both `cland update`. |
| `cland mod` | `hub/mod/cland/hooks/hooks.json` ships with this cland. | `fail`, reinstall cland. |
| `docs/agents`, `AGENTS.md` | The three files exist (a file without the mark is the project's own and fine); `AGENTS.md` has the managed block, at this version. | `fail` (another version: `warn`), `cland update`. |

The fakes answer the same surfaces in the tests (`test/doctor.test.ts`): `claude --version` and `auth status` (`FAKE_CLAUDE_VERSION`, `FAKE_CLAUDE_LOGGED_OUT`), `codex login status` (`FAKE_CODEX_LOGGED_OUT`), `opencode auth list` (`FAKE_OPENCODE_NO_AUTH`), and the fake `gh`'s `--version` and `auth status` (`FAKE_GH_LOGGED_OUT`).

## The project's hub

Run from a project's root, or anywhere inside it. A linked Git worktree resolves to the main worktree's root through its `.git` file and Git's common directory, including worktrees outside the project folder. Its copied `.cland/` without `hub.json` does not hide the main project's hub. Otherwise the CLI uses the nearest ancestor holding `.git` or `.cland/`, else the current directory.

Commands contacting an existing hub (`hub status`, `hub stop`, `hub unmute`, `task`, `session`, `role`, `inbox`, `topic answer`, `hook`) read `CLAND_HUB_FILE` when set, from any current directory; otherwise they read the resolved project's `.cland/hub.json`. `hub start` and `hub serve` start the resolved project's own hub. `init`, `update` and `doctor` resolve the project from the cwd too, unless an explicit directory is given. Tracker writes go through the selected hub into its root's `.cland/tasks`, which is the main worktree's `.cland/tasks` for a linked worktree; the worktree's copy is never written by these commands.

| Command | What it does |
| --- | --- |
| `cland` / `cland open [dir] [nvim args…]` | Runs `cland hub start` (quietly; its output is shown only when it fails), then the Neovim workbench on the project's root, from any directory inside the project, and exits with its status. `CLAND_LAUNCHER` names another launcher. The workbench is described in `nvim/README.md`. |
| `cland --headless --qa <case.lua> [--out <dir>] [--hub stdio\|stub] [--timeout <seconds>]` | Runs one QA case in a headless workbench with no socket, against a fixture project in the temp dir and its own stdio hub (`hub serve --stdio --no-listen`) or the stub hub; one JSON line, exit 0 (`PASS`), 1 (`FAIL`) or 2 (`INCONCLUSIVE`, `BLOCKED`). The case file and the Lua QA API are described in `nvim/README.md`. |
| `cland hub start` | Starts `cland hub serve` detached, waits until it answers, prints its pid, port and socket. A live hub is reported instead of started twice, also when two starts race: the hub that takes the project's lock serves, the other serve exits, and both commands report the one hub. A `hub.json` whose pid is gone, or is a process that does not hold the lock, is replaced. |
| `cland hub status` | Asks the hub over its socket: pid, port, socket, uptime, version, connected sessions with their roles. `--json` prints the raw status. Exit 1 when no hub runs. |
| `cland hub stop` | Asks the hub to stop over its socket and waits for the process to exit. When the socket does not answer it sends SIGTERM, but only to the process holding the project's lock (pid and start time match); a `hub.json` naming any other process is removed and that process left alone. A hub that died without cleaning up has its `hub.json` removed, and its socket file unless another hub holds the lock by now. |
| `cland hub unmute <a> <b>` | Lifts the loop breaker's mute of two sessions (by name) on the running hub, and clears their count; Agents records it. |
| `cland hub journal` | Prints `.cland/journal.jsonl`, oldest first, one record per line (`<ts>  <event>  key=value …`). `--since <ISO date \| 30s \| 10m \| 2h \| 1d>`, `--kind <event>[,<event>…]`, `--json` for the lines as they are. Reads the file: no hub needed. |
| `cland hub serve` | The hub in the foreground, logging JSON lines to stderr. This is what `start` runs. SIGTERM and SIGINT stop it gracefully. |
| `cland hub serve --stdio` | The same, and also the UI's frames on stdin and stdout for the parent that spawned it (`--transport stdio` works too). Stdout carries frames only; the hub stops when stdin ends. It is still the project's hub: it binds the socket and writes `hub.json`, so sessions find it. When either listener cannot bind (a sandbox that forbids it, spec 4.2), it logs `listen-failed`, closes the other and goes on over stdio alone (below). |
| `cland hub serve --stdio --no-listen` | Stdio alone: binds nothing. |
| `cland hub audit` | The audit records in `.cland/log/hub.log`, oldest first; `--session <name>`, `--since <ISO time or 30m, 2h, 1d>`, `--json`. Reads the file: no hub needs to run. See Roles, The audit log. |

A stdio hub without listeners still takes the project's lock: the store is one hub's alone. It writes no `hub.json` (nobody could reach it), plugs in no adapters (so `session.*` requests are refused: a launched session could never connect), and `hub.status` shows port 0 and an empty socket. While another hub holds the lock, `serve --stdio` does not proxy to it: it exits 1 before any frame, with `cland: a hub already runs for <root> (pid <n> holds …)` on stderr. A UI then talks to that hub over its socket, or stops it first.

The project's `.cland/`:

| Path | Committed | What it is |
| --- | --- | --- |
| `.gitignore` | yes | Managed by cland (first line `# managed by cland <version>`); ignores every volatile file below. Remove the mark to take the file over. |
| `tasks/` | yes | The tracker's item files, one per item (below). Written by the hub, editable by hand, never committed by cland. |
| `roles.toml` | yes | The role definitions (below). Written with the defaults (first line `# managed by cland <version>`) when missing, never rewritten: the human's from then on. |
| `config.toml` | yes | Written by `cland init`: `[project] name`, `[tracker] levels` and the `[hygiene]` thresholds (`rate_limit_max`, `rate_limit_window_minutes`, `loop_breaker_max`, `loop_breaker_window_minutes`, `loop_breaker_mute_minutes`, `max_text_bytes`), and `[inbox] idle_minutes` (the inbox's idle threshold, #33). The hub reads it at start (`config-loaded` in its log); missing or unreadable, the built-in defaults apply. |
| `tasks/.gitkeep` | yes | Written by `cland init`, so `tasks/` is committed before the first item. |
| `hub.db` (+ `-wal`, `-shm`) | no | The SQLite store: sessions, messages, deliveries, hygiene counters and mutes; the tracker's index and claims. |
| `secret` | no | 32 random bytes as hex, mode 0600. Kept across restarts, so spokes holding it reconnect. |
| `hub.lock` | no | The hub lock, mode 0600: `{"pid":…,"started":"<ps lstart>"}` of the one hub serving the project, from before it prepares anything until it has shut down. |
| `hub.json` | no | The discovery file, mode 0600, present only while a hub runs. |
| `hub.sock` | no | The Unix socket for the UI and the CLI. |
| `log/hub.log` | no | The process log: startup stdout/stderr plus ordinary events through an async append queue. |
| `run/` | no | The Codex adapter's app-server sockets (`cx-<id>.sock`), while its sessions run. |
| `journal.jsonl` | no | The journal (above): the domain events and the audit records, JSON lines, append-only across restarts. |
| `artifacts/`, `worktrees/`, `territory.git/`, `territory.lock*`, `scratch/` | no | Local artifacts/worktrees, the bare territory and its shared operation lock, and scratch projects agents make for real-harness runs. |

`hub.json` records the hub's root so a copied discovery file still identifies the correct lock and cleanup paths. Older files without `root` remain readable; `hub stop` through an override needs a successful probe to learn their root before signaling or removing a socket. If that root cannot be verified, it leaves the socket alone.

```json
{
  "root": "/path/to/project",
  "socket": "/path/to/project/.cland/hub.sock",
  "port": 53124,
  "secret": "<64 hex chars>",
  "pid": 41234,
  "version": "0.1.0"
}
```

`port` is the 127.0.0.1 WebSocket port for spokes, chosen free at each start. When `.cland/hub.sock` would exceed the Unix socket path limit (about 104 bytes on macOS), the socket is `cland-<hash of the root>.sock` in the system temp dir, and `socket` names it.

The Unix socket speaks the hub's frames as JSON lines, through the same dispatcher as the WebSocket: a spoke's hello works there too when it carries the secret. A client's hello works on the WebSocket only on a hub with no human side (`createHub`, the tests' in-process hub); a project's hub refuses it there. The first frame is `{"type":"hello","protocol":2,"secret":"…","client":"cli"}`; a wrong secret gets `{"type":"error","code":"unauthorized",…}` and the socket closes. After the `welcome`, a client sends `{"type":"hub.status","id":"…"}`, `{"type":"hub.stop","id":"…"}`, a UI request or a `task.*` request (below) and gets a `result` with the same id. Stdio (`cland hub serve --stdio`) speaks exactly the same frames; its hello needs no secret.

### The UI's frames

| Request | Result `value` |
| --- | --- |
| `{"type":"hub.status","id":…}` | Hub state, including `keys: {layouts}` for keyboard layouts and `tracker: {levels}` for loaded container levels, ordered top-down. The UI reads the current values on connect/refresh; no config push event is added. Missing/unreadable config reports the levels in use by the running tracker. |
| `{"type":"topic.list","id":…}` | `{"topics":[Topic…]}`, standing topics first, then those waiting for the human, then by latest activity; a topic with no message last |
| `{"type":"topic.history","id":…,"topic":"general","limit":50}` | `{"topic":Topic,"messages":[TopicMessage…]}`, oldest first, at most 200 |
| `{"type":"topic.send","id":…,"topic":"general","text":"…","to":["…"],"replyTo":"<message id>"}` | `{"message":TopicMessage,"outcomes":[…]}`; `to` is optional (the mentions in the text, else the Coordinator); in Agents only a reply is accepted, and it addresses the sender of `replyTo` |
| `{"type":"topic.create","id":…,"title":"…","item":"T-12"}` | `{"topic":Topic}`; `item` is optional; refused without a title, or for an item that has a topic |
| `{"type":"topic.close","id":…,"topic":…}` | `{"topic":Topic}`, `closed`; refused for General and Agents |
| `{"type":"topic.resolve","id":…,"topic":…}` | `{"topic":Topic}`, `open`; refused for a closed topic and for Agents |
| `{"type":"topic.read","id":…,"topic":…,"upTo":"<message id>"}` | `{"topic":Topic}` with its `unread`; without `upTo`, up to the latest message |
| `{"type":"topic.rename","id":…,"topic":…,"title":…}` | `{"topic":Topic}`; refused for General and Agents |
| `{"type":"topic.delete","id":…,"topic":…}` | `{"deleted":id}`; refused for General and Agents |
| `{"type":"topic.answer","id":…,"ask":…,"option"?:n,"text"?:…}`, `inbox.list`, `inbox.dismiss`, `inbox.dismiss_all` | Under Asks and the inbox above |
| `{"type":"subscribe","id":…}` | `{"subscribed":true}`; events follow on this connection until it closes |
| `{"type":"hygiene.unmute","id":…,"a":"<session>","b":"<session>"}` | `{"lifted":bool,"pair":[a,b]}`: the loop breaker's mute of the pair lifted (false when none ran); refused for a name the hub never knew |

- `Topic` is `{"id","title","status","standing","createdAt","updatedAt","item","unread","lastMessageAt","warning"?}`: `status` is `open`, `waiting for human`, `waiting for agent` or `closed`; `item` the bound item or null; `unread` the human's unread count; `warning` (`no coordinator`) only while a message waits for a role nobody holds.
- A recorded verdict posts a `message` frame with `message.kind: "report"` in its bound item topic (Agents if unbound). Its `message.criteria`, when marks were requested, is `[{ "id": "C1", "mark": "verified" }, { "id": "C2", "mark": "failed", "note": "what failed" }]`: each mark is `verified` or `failed`, and failures carry a note. The text lists the same ids; render the structured field directly, with nothing extra when absent. The field persists in topic history across restart.
- `TopicMessage` is the stored message, `{"id","from","fromKind","fromRole"?,"via","to","text","ts","replyTo"?,"answerTo"?,"topic","stage"?,"kind"?,"detail"?,"ask"?,"criteria"?}`, where `stage` is present when the message had addressees, `kind` and `detail` on a hub notice (the Agents record, above), `answerTo` on the human's answer to an ask, `ask` (`AskCard`) on an ask.

Events, pushed after `subscribe`:

```json
{"type":"message","topic":{"id":"general","title":"General"},"message":{"id":"…","from":"coord","fromKind":"agent","fromRole":"coordinator","text":"…","ts":"…","topic":"general",…}}
{"type":"delivery","topic":"general","message":"<message id>","stage":"delivered"}
{"type":"topic","topic":{"id":"topic-1","title":"…","status":"waiting for agent","item":"T-12","unread":0,"warning":"no coordinator",…}}
{"type":"session.state","session":"coord","sessionId":"…","state":"busy","source":"hook","ts":"…"}
{"type":"presence","sessions":[{"name":"coord","sessionId":"…","role":"coordinator","state":"idle",…}]}
{"type":"session.process","process":{"name":"coord","sessionId":"…","status":"exited","state":"unknown","attach":null,…}}
{"type":"session.usage","session":"coord","sessionId":"…","usage":{"total":{"totalTokens":12300,…},"last":{…}}}
{"type":"task","id":"T-12","item":{"id":"T-12","title":"…","state":"open",…,"claim":{"session":"impl-1",…},"verdicts":[…]}}
```

The role frames (`role.set`, `role.clear`, `role.list`) and events (`session.role`, `role.vacant`, `role.filled`) are under Roles above.

A `message` event comes for every message recorded in a topic, the human's own included, before the `topic.send` result. A `topic` event comes when a topic is created or its status, warning, binding or title changes, and after a `topic.read` (its unread count); a new message alone moves the count without one (the UI counts `message` events). A `delivery` event comes whenever a message's stage changes after the send: an ack, an injection, a delivery dropped past the TTL when its session comes back, or a role's queue merged into a session that already had the message. A `session.state` event comes when a session's state changes (below). `presence` replaces the connected-session list on a hello, the last spoke leaving, a rename, a status or role change. `session.process` replaces a process-table row on launch, resume, exit, stop, rename, model, role or pid changes; it has exactly the view `session.list` returns, including a null attach command after exit. Replace a row by its stable `sessionId` or its name, so a rename removes the old name and a relaunch replaces the old launch. `session.usage` carries the latest adapter totals for one launch: reports within each 1 s window are coalesced into one trailing snapshot, independently per session. Match its `sessionId`, never just the reused name. A pending usage update is cancelled at hub shutdown. `session.cleanup` identifies a failed launch by `sessionId` and reports `pending stop` or `settled`; clients remove only that identity from their accepted-process view, including during snapshot replay. The workbench reads `session.list` and `hub.status` on connect and after its own launch or stop; these events keep it current between reads, without a timer. A `task` event comes on every change to the tracker's index: a hub write, a hand edit the watcher read, a claim taken or released, and a removed file (`item` null); `item` is the item as `task.list` shows it, including its resolved `rank`. A successful rank move emits one additional `task` event for the moved item with `siblings`, all ids under the affected parent in rank-then-id order. Other events have no sibling list; clients compare rank, then numeric id. `hub/test/fixtures/rank-order.json` is the shared hub/client ordering example.

## Adapters and sessions

An adapter launches one kind of harness, tells the hub what each session is doing, and hands it messages (spec 4.3). Claude Code, OpenCode and Codex have one.

A turn that fails is reported separately from the session's idle state. OpenCode's `session.execution.failed`, Codex's `turn/completed` with an error (or failed status), and Claude Code's `StopFailure` make a journalled `turn-failed` notice in Agents and a dismissable inbox notification: `<name> [Role]: its turn failed: <first line of the error>`. Sessions whose hub messages fed the turn (including steers) receive a hub note too; human messages are covered by Agents and the inbox. The harness stays running and the failed turn is not automatically replayed. Failures the adapter misses while its event stream is disconnected cannot be reported. OpenCode drops uncertain sender attribution on stream loss and tracks new deliveries after reconnect. Codex associates only accepted admissions, including ones acknowledged after completion. Claude Code uses the hooks' `prompt_id` to reconcile a failure that arrives before its start hook, keeping at most 64 recent prompt records; missing or evicted identities still produce the public notice, without guessing a sender.

### The contract

`src/adapters/contract.ts`. Mandatory:

| Member | What it does |
| --- | --- |
| `spawn({name, role, model, cwd})` | Launches the harness with the spoke's MCP configuration injected at launch; resolves with the process-table row. Nothing is written into the project. |
| `attachCommand(process)` | The command, as a string, that attaches a terminal to the live session; the harness's own. |
| `inject(process, message, topic)` | Hands the message to the session as a turn. Resolves when the harness confirmed the turn (stage `injected`). Rejects when there is no way in or no confirmation in time: the message then stays `delivered`, the hub logs `inject-unconfirmed` and retries at the session's next transition to `idle`, when its in-session connection comes back, or when the adapter's own connection to the session comes back (`host.reconnected`, state change or not). Rejects with `InjectUncertain` when the request reached the harness and its answer never came: the delivery is `uncertain` and only `session.retry` sends it again. |
| the state stream | Push signals from inside the session go to the hub as `session.signal` frames and the adapter's `interpret` turns them into states. The adapter's own poll and its liveness check report through its host. |
| `stop(process)`, `resume(process, {relaunch})` | Stop through the harness; a stop that cannot confirm the process gone fails and leaves it watched. Re-find a process after a hub restart by the harness's own ids (a pid alone never: it may have been reused), or start it again on its own conversation (`relaunch`). The session layer stops a process that still runs before a relaunch, keeping the row's role: `cland session resume <name> --relaunch` always ends with a new harness process on the same conversation, and without `--relaunch` a live session is only re-found. |

The capability table declares the optional capabilities (`history`, `usage`, `setModel`, `approvalRelay`) and each state signal as `reliable`, `heuristic` or `none`. What is `none` is never emulated. `session.list` returns every adapter's table.

A failed launch that returned a process keeps its identity in durable pending-stop ownership, watches it until verified exit, and retries its ownership-verified stop on restart. The recovery receipt and quarantine of any accepted row commit in one process-table transaction; Before calling stop, the receipt durably records stop intent with the original pid and start identity. If the completion write fails, recovery inspects that identity: gone or reused means settle without signalling the replacement; a matching live original takes the ownership-verified stop path; unreadable identity remains pending. Recovery starts a new adapter watch only after verifying the original identity alive; gone or reused identities dispose supervision by session id through `adapter.unwatch`, without signals. Row removal and its checkpoint share one process-table transaction. Guarded role rollback and its checkpoint share one Store transaction, so a later human assignment cannot be undone by receipt replay. The receipt persists completion of verified stop, row removal and guarded role rollback separately. Recovery resumes the first unfinished stage and never signals a process after stop was verified, even if its pid has since been reused; cleanup clears the receipt only after all stages finish. `session.list.pendingStops` shows this recovery separately from accepted process rows; it never reports the failed launch running or replaces another name owner. Adapter-internal failures before returning a process retain their existing in-memory supervision; durable recovery for those resources remains tracked in T-129.

A failed launch whose row was published still has a terminal transition: verified cleanup commits the final `session.state` fact and closes exact and subscriber-owned subscriptions through the shared terminal path before removing the row. Publication ownership is kept in the recovery receipt, so an interrupted terminal write retries after restart; a launch that never published a row cannot close a conflicting name owner's subscriptions.

An unfinalized launch identity is fenced against rename and role changes (assignment, clearing and either side of a handover), from its early hello until successful acceptance or completed failed-launch settlement. A refusal names the pending launch. The hub gives each launch a distinct credential, passed to the spoke as `CLAND_LAUNCH_TOKEN` and carried in its hello. The credential is a bearer secret, held only by the spawned process and its own spoke, never logged or passed in command arguments. The hub trusts each adapter to report the identity of its own spawned process. Within that trust model, an identity presenting the valid token belongs to the launch; sharing a token with another session or an adapter reporting another process is outside the model. The admission snapshot check below is defence in depth. Only a matching credential proves an early hello belongs to that launch; a foreign owner reconnecting under the launch's name keeps its own role and mutation rights, including an uncredentialed `UNKNOWN_SESSION`. Launch provenance and first-role grants are keyed by credential; the fence accepts only stable ids. A credentialed anonymous hello receives a unique internal stable id before its role is granted. The returned adapter identity adds to the proven identities rather than replacing an early one, and publication records that identity in the authoritative session store. The recovery receipt retains all proven ids and the anonymous binding; cleanup immediately freezes reconnects to those committed identities, and each rollback has its own atomic checkpoint. Acceptance retires the first-role grant; a later hello uses the current human assignment, including a change or clear made while spawn awaited. An unconsumed first-hello credential retains only the published stable id until a successful hello or terminal transition consumes it, outside the pending fence. Core validates a new hello, including its launch name and authoritative identity binding, before registering ownership proof; an existing spoke join adds no proof and consumes no grant. At launch admission the hub snapshots its existing stable identities, including durable aliases and process rows. Neither a credentialed hello nor an adapter return can prove one of those identities, whatever name it holds later. Every resolved proof candidate must also be a stable id, including the candidate chosen for an anonymous hello during the PID probe. A credential cannot make an existing foreign live or offline identity a rollback target. Refused anonymous hellos leave no anonymous binding in the proof set or cleanup receipt. Foreign hellos cannot consume the launch's first-role grant or become rollback targets. Quarantined rows do not publish ordinary process changes; their final fact waits for verified exit. Cleanup and rollback resolve ownership by the proven stable session id, including recovery of a previously renamed identity. A later human grant is allowed after settlement and survives recovery retries.

### Session state

`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown` (spec 4.2). Only adapters set it; the model's `status` tool sets the status line and never the state. Presence (`who`, `hub.status`) carries it, and subscribed clients get `session.state`. A session no adapter launched is `unknown`, and so is a launched one whose process died or was stopped.

- A push signal (a hook, the mod) carries the time it happened; one older than the last push applied is dropped, so out-of-order hooks never move a session back. For a hook that time is when its `cland hook` process started (the harness fires the event by starting it; the process may take hundreds of milliseconds more to run), for the mod the event's own time. The hub's receipt order is not used: two hook processes started in one order often arrive in the other.
- A signal or a bridge names its launch (`--launch`, the cland session id the launch gave the hooks and the mod). One from an earlier launch under the same name is ignored (`signal-other-launch` in the log) or refused: it never changes the row of the process that replaced it. A signal never revives a row that is not `running`; only resume does.
- A retry asked for while an inject of the same message is still waiting for its confirmation (an `idle`, a bridge that connected) is made when that inject gives up, if the message still waits. A rename takes the session's `delivered` messages along, so their retry and confirmation find them. At a launch, the bridges that connected early are registered before the early signals are replayed.
- A polled signal counts only while no push came for `CLAND_PUSH_TRUST_MS` (15 s), or while nothing is known yet.

### The process table

`harness_processes` in `hub.db`: name, harness, role, model, cwd, pid, the harness's handle (Claude Code's background id, Codex's app-server socket), cland's session id (the spoke's `CLAND_SESSION_ID`), the harness's own conversation id where it chose one (Codex: the thread id), start time, the pid's process start time (`ps -o lstart=`, as the hub lock keeps it), `running` | `exited` | `stopped`, and the Lead’s node or item whose task worktree the session was launched in (`item`, else null). No adapter signals a pid before checking that start time (`system-processes.ts` `endProcess`): a pid reused by an unrelated process after a crash or a restart is never signalled (`signal-refused` in the log), and is not taken for the session when resuming. At its start the hub resumes every `running` row. A process found alive under its ids is watched again. Otherwise the row turns `exited`, the state `unknown`, and the log gets `harness-exited`. The watch also catches a process that dies while the hub runs.

### The Claude Code adapter

| | Surface (Claude Code 2.1.294) |
| --- | --- |
| spawn | `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <json> --settings <json> --plugin-dir hub/mod/cland`, in the session's cwd. The MCP config starts `bin/cland-spoke.ts` with `CLAND_HUB_FILE`, `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`, `CLAND_DELIVERY=adapter`. The settings add the hooks below (all `async`; with a task worktree also the synchronous `WorktreeCreate` refusal, Task branches and worktrees) and an `env` the mod reads (`CLAND_SESSION_NAME`, `CLAND_HUB_FILE`, `CLAND_NODE`, `CLAND_CLI`). No secret goes on a command line: everything finds the hub through `hub.json`. `--bg` takes `--session-id` but picks its own id (its prefix is the background id); the hub records it as `harnessSessionId`. The workspace must be trusted once (`claude` in it, accept the prompt), or `--bg` refuses. |
| attach | `claude attach <background id>`; several clients can attach at once. |
| inject | The cland mod keeps `cland hook bridge` running, which receives `inject` frames for its session. It submits each one with `$.prompt.submit`, framed as the plugin's (a turn of its own once the session is idle), and confirms it with `cland hook injected`. A turn whose prompt carries a message's envelope confirms it too. The message reads as `<channel source="cland" from=… msg_id=… topic=…>text</channel>` plus one line naming the `send` tool as the way back. The session's inbox socket is not used, because its message format is undocumented. |
| state | Hooks, run as `cland hook <event> --session <name> --launch <cland session id> --hub-file <path>`: SessionStart → `idle` (and the model), UserPromptSubmit → `busy`, Stop and StopFailure → `idle`, PermissionRequest → `waiting for approval` (`waiting for human` for AskUserQuestion), PostToolUse → `busy`, Elicitation → `waiting for human`, Notification `idle_prompt` → `idle`. The mod adds `turn.start` → `busy` and `turn.complete` → `idle`, which also fires on an interrupt where Stop does not, with the turn's usage. The fallback is `claude agents --json`, polled every `CLAND_ADAPTER_POLL_MS` (5 s), which also catches a dead pid. |
| stop, resume | `claude stop <id>`, then SIGTERM (only to the pid the table recorded, its start time checked) when the pid outlives it by `CLAND_STOP_GRACE_MS` (5 s); the process stays watched until its pid is gone, and a stop that cannot see it go fails with the row still `running`. Resume reads `claude agents --json` and matches the session id or the background id; an entry that only shares the pid is another session, so the row turns `exited`. A relaunch is `claude --bg --resume <its session id>` with the same flags (the harness does not restore them). |

| Capability | |
| --- | --- |
| history | none: the transcript format is internal to Claude Code |
| usage | reliable: the mod's `turn.complete`, summed into `usage.total`, with the turn under `usage.last` |
| setModel | none |
| approvalRelay | none: approvals stay in the harness's TUI (spec 4.3) |
| busy, idle, waiting for approval | reliable (hooks, the mod) |
| waiting for human | heuristic (AskUserQuestion through PermissionRequest, Elicitation, `waitingFor`) |

Signals or a bridge that arrive while a launch is still running belong to the new process and are kept until its row is written. The real SessionStart hook does arrive before `claude --bg` and the first `agents --json` return.

### The OpenCode adapter

`src/adapters/opencode.ts`, with `opencode/client.ts` (the HTTP API and the event stream), `opencode/state.ts` (events to states) and `opencode/server.ts` (the session's server and its files). Launched with `"harness": "opencode"`.

Without an explicit model, launch polls `GET /api/model` every 200 ms: a cold catalog can list another provider before OpenCode Zen arrives. An eligible model from the known-good list (`opencode/big-pickle`) ends the wait immediately. Otherwise, a nonempty catalog must stay unchanged for 1 s before the usual free-model preference applies. The catalog wait has a 10 s budget, including HTTP requests and polling sleeps; at that deadline it uses the latest successful catalog's free choice, or the server's default when none qualifies. Empty catalogs and failed requests are retried within that budget. An explicit model or a restored session skips this wait.

| | Surface (OpenCode 2.0.24) |
| --- | --- |
| spawn | A standalone `opencode serve --hostname 127.0.0.1 --port 0` per session, detached, in the session's cwd; the url comes from its `server listening on …` line. The spoke is a local MCP server of a generated config passed as `OPENCODE_CONFIG` (`mcp.servers.cland: {type: local, command, environment}` with the same `CLAND_*` variables as Claude Code's), and the server gets a password of its own as `OPENCODE_PASSWORD`. Both live in `.cland/opencode/<name>/` (`opencode.json`, `password` mode 600, `serve.log`), which a `.gitignore` of its own (`*`) keeps out of the repository. Then `POST /api/session {title, model, location}`. The model is `<provider>/<id>` (`opencode/big-pickle`); without one, a free model of `GET /api/model` (zero input/output price, tools supported, enabled and active). The known-good preference list is `opencode/big-pickle`; if it is not offered free, use the first free OpenCode Zen model, else the first free model from another provider. Selection is deterministic and makes no launch-time probe request; a listed model that later fails is reported as a failed turn. The row keeps the server's pid, its url as `harnessId` and the `ses_…` id as `harnessSessionId`. The server starts its MCP servers when the session is created, so the spoke connects right after the launch. |
| attach | `OPENCODE_PASSWORD="$(cat <password file>)" opencode --server <url> --session <ses_…> <cwd>`: the OpenCode TUI as one more client of the session's server, in the session's directory. The password never appears on a command line. The directory matters: the server keeps one instance per directory its clients work in, and each instance starts the configured MCP servers, so a TUI in another directory would start a second spoke under the session's id, which replaces the spoke the session's tool calls go through (found in the T-42 run). Closing the TUI (or Neovim) leaves the server and the session running. |
| inject | `POST /api/session/{id}/prompt {text, delivery}` with the envelope as text: `steer` while the session runs a turn (it joins the turn at the next step boundary), `queue` otherwise. The reply is the durably admitted inbox item (`msg_…`), which confirms `injected`. A failed or timed-out request leaves the message `delivered` for the retry at the next `idle`. |
| state | `GET /api/event` (SSE), one subscription per server, re-opened with backoff while the session is watched; each time it opens, a snapshot (`GET /api/session/active`, `GET /api/session/{id}/permission`, `GET /api/session/{id}/form`), since the stream is live-only. `session.execution.started` → `busy`; `.succeeded`, `.failed`, `.interrupted` → `idle`; `permission.asked` → `waiting for approval` until `permission.replied`; `form.created` → `waiting for human` until `form.replied` or `form.cancelled`. A pending approval outranks a pending form, which outranks a running turn. States reach the hub with source `sse`. A stream that ends with its server, or a pid gone at the `CLAND_ADAPTER_POLL_MS` check, is `unknown`. |
| usage | `session.step.ended` (one per assistant message): `{model, inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost}`, the model from `session.step.started`. |
| stop, resume | Stop is SIGTERM to the server (its start time checked first), which ends its MCP servers, the spoke among them. Resume finds the session when the pid is alive and the server answers `GET /api/session/{id}` with the recorded password; the state comes from the snapshot. A relaunch starts a new server on the same config and password, then reopens the same session (OpenCode keeps sessions in its own database) or creates it again under its id. |

| Capability | |
| --- | --- |
| history | none: the messages are readable (`GET /api/session/{id}/message`), but not read in v0 |
| usage | reliable: per message, from `session.step.ended`, summed into `usage.total`, with the step under `usage.last` |
| setModel | none: `POST /api/session/{id}/model` exists, but the contract has no setModel yet |
| approvalRelay | none: approvals stay in the OpenCode TUI (spec 4.3) |
| busy, idle | reliable: the server reports a turn's start and end |
| waiting for approval, waiting for human | heuristic: the server has no waiting status, so they are derived from a pending `permission.asked` or `form.created` |

`CLAND_OPENCODE_BIN` names the `opencode` executable. The server's environment drops `CLAND_*`, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT` and `OPENCODE_PASSWORD` from the hub's own. The user's global OpenCode config still applies, merged with the generated one.

### The Codex adapter

`src/adapters/codex.ts`, with `codex/app-server.ts` (the JSON-RPC client on the app-server's Unix socket). Launched with `"harness": "codex"`; `CLAND_CODEX_BIN` names the `codex` executable.

| | Surface (Codex 0.160.0) |
| --- | --- |
| spawn | `codex app-server --listen unix://<socket>` in the session's cwd, detached in its own process group (it outlives the hub; its output goes to `.cland/log/codex-<name>.log`). The socket is `.cland/run/cx-<id>.sock`, or `$TMPDIR/cland-run/cx-<id>.sock` when that path is too long for a Unix socket. Its environment is the hub's without its `CLAND_*` variables (`CLAND_CODEX_BIN` stays), plus `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE`, with the directory of the hub's own `node` first on `PATH`: the session's shell inherits them, so `cland task` run there acts as the session and `node` and `npm` are the hub's (Codex runs commands in a login shell, `zsh -lc`; a profile that puts another Node ahead of the inherited `PATH` would still win). The spoke is passed to the app-server only, as `-c mcp_servers.cland.*` overrides (`command`, `args`, `env.CLAND_HUB_FILE`, `env.CLAND_SESSION_ID`, `env.CLAND_SESSION_NAME`, `env.CLAND_ROLE`, `env.CLAND_DELIVERY=adapter`, `enabled`, `required`, `default_tools_approval_mode="approve"`); nothing is written to `~/.codex/config.toml`. Then `thread/start {cwd, model, approvalPolicy, permissions?}` (policy, below) and a first turn (`turn/start`, with the launch's `effort` when there is one: the app-server's schema takes it there, for this turn and the next ones) carrying the role's clause from `roles.toml` (with a line on how hub events arrive; a launch with no role carries that line alone): a thread without a turn has no rollout, and `thread/resume` (attach, a restarted hub) refuses it. Codex 0.153.4 or newer is required. |
| policy | From the role's `[<role>.launch]` (`roles.toml` above), in `thread/start` and in the `thread/resume` of a relaunch. `approvalPolicy` is the launch's `approval`, `never` when it gives none. `permissions` names the sandbox: `:read-only`, `:workspace` or `:danger-full-access` when that is all it is; otherwise the profile `cland`, which three more `-c` overrides on the app-server's command line define: `default_permissions="cland"`, `permissions.cland={extends, filesystem, network}` and `features.network_proxy`. `filesystem` marks each writable root `write`, and the git directories named above; `network` for `local` is `{enabled, allow_local_binding, unix_sockets}`, the sockets allowed under `.cland/`, the cwd and the temp dir and denied under `.cland/run/` and `$TMPDIR/cland-run/` (the app-servers' own). With no `sandbox` in the launch, `permissions` is left out and Codex's configuration decides. |
| attach | `codex resume --remote unix://<socket> --cd <cwd> <thread id>`. Never a `-c` or a `--profile`: either one puts the TUI in embedded mode, which has no external surface (spec 9). The first attach in a new folder asks to trust it. |
| inject | Idle: `turn/start {threadId, input: [], toolOutput: {name: "hub_event", namespace: "cland", output: <envelope>}}`. During a turn: `turn/steer {threadId, expectedTurnId, input}` with the envelope as text. The JSON-RPC result confirms `injected`; an error answer, or a connection that was not there to send on (or whose write of the request failed), leaves the message `delivered` for the next `idle` or the next reconnect. A request that went out and got no answer within `CLAND_INJECT_TIMEOUT_MS`, or whose connection closed, failed or brought a frame that is not JSON before its answer, is ambiguous (the turn may have started): the delivery is `uncertain`, never replayed on its own. A steer the app-server refuses because the turn just ended (`no active turn to steer`) falls back to `turn/start`. **What `injected` guarantees for Codex:** the app-server accepted the message, as a turn of its own or into the running turn; accepted into a running turn means the turn takes it up at its next step, which may be a while into a long command. Measured with Codex 0.160.0 (11 steers sent 5 to 120 ms after a turn's final answer): an accepted steer was always taken up, the turn going on to answer it, and a steer that came after the turn's end was always refused; none was accepted and lost. The adapter does not rest on that alone. It holds an input as owed only after its request is accepted, preserving any uptake or completion that arrived before the reply. Pending or uncertain requests are never recovery obligations. An accepted input stays owed, with the shape it was admitted in, until the turn announces it among its inputs (`item/started` or `item/completed` with an input item carrying the envelope's `msg_id`). Measured with Codex 0.160.0 (T-68), the check reads two item types: text input (a steer, a `turn/start` with `input`) is a `userMessage` whose `content` holds the text; a `turn/start` with a `toolOutput` (every delivery into an idle thread) is a `functionCallOutput` with `name: "hub_event"`, `namespace: "cland"` and the envelope as `output`. When a turn ends well with an input still owed, the adapter reads the turn back (`thread/read {includeTurns: true}`) and hands over again with `turn/start` whatever is missing from that turn's inputs. It judges only what the record can show: an input owed as a tool output needs a `hub_event` item in the turn (it started that turn), and a steer needs some input item there (it may join a turn of either shape). When the record shows no such item, the turn is missing from it, or it cannot be read, nothing is delivered again: the journal and the log get one `harness-turn-unread` per readback (`session`, `turn`, `ids`, `error`; an input whose acceptance came after its turn ended is read back on its own, so one turn can have two). A message delivered once and unverified is the lesser harm; until T-68 the check read `userMessage` items only, so every delivery into an idle thread was run three times and reported lost. If a newer turn starts during readback, the recovery can join it; that accepted recovery remains owed in the actual turn until taken up. Recovery uses the same admission reconciliation as the original injection, including failures that precede the reply. After two accepted recovery attempts still missing from their turns, the adapter stops and reports failure, so recovery cannot loop or disappear silently. The log and the journal have `harness-redelivered` (`session`, `id`, original `turn`, `admittedTurn`, `intoActiveTurn`) and Agents a `redelivered` record; a redelivery that fails is `harness-redelivery-failed` and is reported as a failed turn is (Agents and the inbox), and the original sender is told. An unanswered recovery request is reported as ambiguous (it may have been accepted) in that failure and is never replayed automatically. A turn that fails is not redelivered: the failure names the messages it held (`turn-failed`), steered ones included, and their senders are told. A lost connection to a live app-server is reopened at the next poll and what waits for an inject is retried then. |
| state | `thread/status/changed` for the session's thread id (the app-server sends it to every connection; other threads, such as ephemeral helpers, are ignored): `idle` → `idle`, `active` → `busy`, `active [waitingOnApproval]` → `waiting for approval`, `active [waitingOnUserInput]` → `waiting for human`, `systemError` → `idle`, `notLoaded` → `unknown`. Source `app-server`. The pid is checked every `CLAND_ADAPTER_POLL_MS` (5 s), and a lost connection is reopened and resubscribed. |
| usage | `thread/tokenUsage/updated` (the thread's total and last normalised under `usage.total` and `usage.last`; the original report including context window stays under `usage.tokens`) and `account/rateLimits/read` after each turn, plus `account/rateLimits/updated` (`usage.rateLimits`). |
| stop, resume | Stop sends SIGTERM to the app-server (its MCP children end with it), then SIGKILL after 5 s, each only after checking the pid's start time. Resume needs the pid alive and the socket answering `thread/resume` for the recorded thread (or `thread/read` while the thread has no turn yet). A relaunch starts a new app-server on the same socket and resumes the thread from its rollout. |

| Capability | |
| --- | --- |
| history | none: `Thread.path` is unstable and the rollout format is not a stable interface |
| usage | reliable: token counts and the account's rate limits |
| setModel | none |
| approvalRelay | none: server requests (approvals, questions) are left to the attached TUI; the hub only logs `harness-request`. With `approval = "never"`, the default, a launched session sends none for its commands |
| busy, idle, waiting for approval, waiting for human | reliable (`thread/status/changed`) |

What the real Codex showed in the first smoke (0.160.0, `gpt-5.6-luna`): `turn/start`'s result arrives before the turn's `thread/status/changed`, so the adapter counts an accepted turn as `busy`. The TUI does not render the `hub_event` tool output, only the model's `cland.send` call and its answer. With `default_tools_approval_mode="approve"`, the cland tools ran without a prompt.

### The frames and the CLI

| Request | Result `value` | Who |
| --- | --- | --- |
| `{"type":"session.launch","id":…,"name":…,"role"?,"model"?,"harness"?,"effort"?,"cwd"?,"item"?,"brief"?}` | `{"process":HarnessProcess}`; a role's launch defaults fill the rest. `brief`: text or an artifact id, carried once after the clause in the first input. With `item`: `{"process","claim","worktree","reason"?}` (Task branches and worktrees) | UI, CLI, spokes whose role grants `session.launch` (the Coordinator) |
| `{"type":"session.list","id":…}` | `{"processes":[HarnessProcess…],"adapters":{"claude-code":Capabilities,"opencode":Capabilities,"codex":Capabilities},"coordinator"}` | UI, CLI, spokes whose role grants `session.launch` |
| `{"type":"session.attach","id":…,"session":…}` | `{"command":"claude attach 1a2b3c4d"}` | UI, CLI |
| `{"type":"session.stop","id":…,"session":…}` | `{"process":…}` | UI, CLI |
| `{"type":"session.resume","id":…,"session":…,"relaunch"?:true}` | `{"found","reason"?,"process"}` | UI, CLI |
| `{"type":"session.retry","id":…,"session":…,"message":"<message id>"}` | `{"retried":true}`; refused unless that delivery is `uncertain` | UI, CLI |
| `{"type":"session.signal","id":…,"session":…,"launch"?:…,"event":…,"at":…,"payload":{…}}` | `{"applied","state"?}` | `cland hook` |
| `{"type":"session.bridge","id":…,"session":…,"launch"?:…}` | `{"bridged":true}`, then `{"type":"inject","session","message","text"}` frames | `cland hook bridge` |

`HarnessProcess` is `{"name","harness","role","label","model","cwd","item","pid","harnessId","sessionId","harnessSessionId","startedAt","status","state","attach","usage"?}`; `hub.status` lists them as `harnesses`.

`usage.total` is the running total for that launched session; `usage.last` is its latest Claude Code turn,
OpenCode step (one assistant message), or Codex turn. Both use the same shape:
`{totalTokens, inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost?}`.
`inputTokens` counts uncached input; cache reads and writes are separate. `totalTokens` includes all input
(including cache) plus output; reasoning is a subset of output and is not added again. Codex's own
`totalTokens` is authoritative; its input count is normalised by subtracting cached input. Token categories
not reported by a harness are zero (Codex has no cache-write count). `cost` is USD when the harness reports it,
including zero, and otherwise absent; the hub does not estimate it from model prices. `usage.model` names
the latest reported model, not a model for the whole accumulated total.

The sessions panel shows `usage.total.cost` when positive, otherwise `usage.total.totalTokens`; the item view's
cost is the claiming session's `usage.total.cost`, including zero, or unknown when unreported. Counts are absent
until a usage report arrives (Codex can report only rate limits at first). Claude Code and OpenCode totals live
in adapter memory and reset when the hub restarts; they sum reports received by this hub and cannot recover
ones missed while it was disconnected. Codex supplies its thread's running total, which survives with the thread
and replaces the hub's total on each report. A new launch under a reused name starts a new total.

| Command | What it does |
| --- | --- |
| `cland session launch <name> [--role r] [--model m] [--harness claude-code\|opencode\|codex] [--effort e] [--cwd dir \| --item T-<n>] [--brief text\|A-<n>]` | Launches a session through the hub; with `--role`, the role's launch defaults fill what is not given. `--item` starts an Implementer in its task worktree, or a Lead on an open epic/release at the project root, with the node's claim. `--brief` starts its first turn on that text or artifact's content after the role clause. |
| `cland session list` / `attach <name>` / `stop <name>` / `resume <name> [--relaunch]` / `retry <name> <message id>` | As the frames above. |
| `cland hook <event> --session <name> [--launch <id>] --hub-file <path>` | Posts one signal, stamped with the process's start time (or the payload's `at`), with the harness's JSON payload from stdin. Only the fields the hub reads are kept, and a prompt is reduced to the message ids it carries. Always exits 0: a hook never fails the harness. |
| `cland hook worktree-create --session <name> --worktree <path> [--launch <id>] --hub-file <path>` | Claude Code's `WorktreeCreate` hook in a session launched with an item: names the session's own worktree on stderr, tells the hub, exits 2. The one hook that fails the harness. |
| `cland worktree list` / `prune [--yes]` | Task branches and worktrees, under Local git territory. |
| `cland hook bridge --session <name> --hub-file <path>` | The mod's connection to the hub. It prints each `inject` frame as a JSON line, reconnects through `hub.json` after a hub restart, and ends with its parent. |

`CLAND_CLAUDE_BIN` names the `claude` executable, `CLAND_INJECT_TIMEOUT_MS` (60 s) how long an inject waits for its confirmation.

## The tracker

One Markdown file per item in `.cland/tasks/`, `T-<n>-<slug>.md` (spec 4.6, ADR 0002). Ids are sequential per project and never reused: the hub hands out one above the highest in the folder and in the index. The file name keeps the slug of the title the item was created with.

```markdown
---
id: T-1
kind: task            # release | epic | spec | task | question | map
title: Add the login page
state: open           # open | closed
status: backlog       # tasks only: backlog | planned | in progress | review | qa | ready | done
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
commit: 0123456789abcdef0123456789abcdef01234567

Looks right.
```

A comment is headed `### <author> · <ISO time>`; one whose first lines are `verdict:` (`review` | `qa`), `result:` (`clear` | `not clear`), `by:` (`<session> [<role>]`) and `run:` is a verdict. Its optional `commit:` pins the Git commit covered by that run; older verdicts without it still parse.

`cland task view T-n --json`, MCP `task.view` and the socket's `task.view` return
`item.criteria`, read from the body's `## Acceptance criteria` section. A missing or
empty section returns `[]`. Each criterion has `id` (`C1`, `C2`, etc., or `null` for
a legacy criterion), `text`, `checked`, `marks` and `malformedMarks`. The checkbox
state is kept independently: a checked legacy criterion has `checked: true` and
`marks: []`. Wrapped text is joined with newlines; fenced examples and nested
supporting checklists do not create criteria.

Mark sub-items are indented two spaces below the criterion, in file order:

```markdown
## Acceptance criteria
- [x] C1. The clause arrives again on reconnect
  - done: impl-57 · 2026-10-09T10:00Z
  - verified: qa-12 [QA] · run q-0117 · 2026-10-09T11:00Z
- [ ] C2. A reconnect keeps the clause
  - failed: rev-3 [Reviewer] · 2026-10-09T12:00Z · note Reconnect lost the clause
```

The first criterion's JSON is:

```json
{
  "id": "C1",
  "text": "The clause arrives again on reconnect",
  "checked": true,
  "marks": [
    { "kind": "done", "by": "impl-57", "at": "2026-10-09T10:00Z" },
    { "kind": "verified", "by": "qa-12 [QA]", "run": "q-0117", "at": "2026-10-09T11:00Z" }
  ],
  "malformedMarks": []
}
```

Failed marks carry `kind: "failed"`, `by`, `at` and `note`. Times retain their
original ISO spelling, with minutes, optional seconds/fractions, and a `Z` or
numeric timezone. `by` retains the file's session name and optional `[Role]`;
these marks are parsed file claims, not authenticated verdict evidence. Valid
marks remain visible even beside malformed ones. Each malformed mark is returned
verbatim as `{line, text, reason}` in its criterion's `malformedMarks` and in
`item.criteriaWarnings`; warnings also report orphan mark lines that belong to
no criterion. `line` is one-based within `item.body`. All warnings are an empty
list for valid sections. Spaces or tabs after a mark's bullet are accepted;
tab-indented marks and unrecognized indented list sub-items (including supporting
checklists, empty bullets and ordered items) are reported verbatim. Hand edits
are re-indexed and survive restart, preserving
the ids, text and marks in the file. This slice only reads the section: views do
not assign ids, rewrite marks or change checkboxes.

- **Task status (T-120).** Tasks carry explicit frontmatter `status`: `backlog` at creation, `planned`, `in progress`, `review`, `qa`, `ready` or `done`; containers, questions, specs and maps have none. The hub writes and indexes it on the tracker's single queue and carries it in view, list and the existing `task` event. A new Implementer or Aide claim or a not-clear verdict sets `in progress`; a merge or close sets `done`; a reopen without an explicit status sets `backlog`. Done tasks are closed and all other statuses are open. Migration on index persists `done` for closed tasks and `in progress` for open claimed tasks, otherwise `backlog`. Hand edits are re-indexed, including close/reopen edits to state.
- **Manual status.** The Coordinator, the human and an Aide use `cland task edit T-n --status <status>` or MCP `task.edit`'s `status` to choose any status. `done` closes the task and releases the claim; choosing another status reopens it at that status. The Implementer hands over with `task.edit {id, status: "review"}` on its own live claimed item, with no other edits. The permission table checks this right again after file I/O; assignment alone is insufficient. Other sessions cannot set status, even under a whole-tool `task.edit` grant. An explicit state and status in the same edit must agree. Verifier holds and clear, current verdicts also move status as described below.
- **Release planning (T-118).** Kind `release` adds optional frontmatter `version`, semver without the `v` (for example `0.1.0`, including prerelease/build suffixes). Create it with `cland task create "v0.1" --kind release --version 0.1.0`; omit the version until planned and set it with `task edit --version` (`none` clears it). The first configured level owns version and Notes, even when renamed. Other kinds cannot carry a version; malformed versions are refused. Its body holds the goal and `## Notes`, which creation and kind conversion add if missing. The version is indexed, returned in view/list/events and preserved through writes and restarts. Releasing from an item is a later slice.
- **Parenting rule (T-118).** Container kinds are read at hub start from `[tracker] levels = ["release", "epic"]` in `.cland/config.toml`, ordered top-down. `cland init` writes them and `cland update` preserves changes. The default levels are `release` › `epic`: a release has no parent; an epic takes a release or none; a leaf (`task`, `question`, `spec`) takes either container or none. Maps stay outside the ladder: no parent, children of kind `question` or `task` only (the wayfinder task exception). Create and link share the hub's check; changing a kind through edit or import cannot leave children under a leaf; both share the child-parenting check, including closed children. A hand edit that changes a kind in conflict with its children remains authoritative and posts a notice naming the file. A refusal names the parenting rule. Legacy imported/hand-edited trees remain readable; unrelated edits do not rewrite them. A container takes only the immediately preceding level or none; leaves take any configured container or none. For example `levels = ["release", "epic", "feature"]` accepts a feature under an epic and refuses it under a release. `levels = []` gives a flat tracker. Names must be unique lowercase kind names, and `task`, `question`, `spec`, `map` are reserved; an invalid ladder produces an Agents refusal notice and the defaults stay in force. Unknown item kinds are refused at index with a notice naming the file; valid items continue loading. Restart the hub after changing levels. Closing a configured container with open children is refused, naming each child; close or move them first. There is no force flag, and `task edit --state closed` applies the same guard. A container close or kind change scans the tasks directory once inside the tracker queue, after the final write await and immediately before rename. It reads every task file to discover children by their current disk parent, including hand reparents not yet indexed. Any unreadable task file blocks the operation and is named; child discovery never relies on watcher timing. A hand edit while the directory scan or rename is in flight remains outside the single-user, non-atomic threat model (T-61/T-78); the accepted disk-edit window covers the scan plus rename. A malformed child retains its last known index row and refuses close with its file named until repaired; only an unknown kind removes the index row.
- **Subtree and header (T-118).** `cland task list --under T-n` lists every descendant, excluding the named root, by effective rank then numeric id. It traverses closed ancestors and combines with all other list filters; an unknown root is refused. `task view` prints the root-to-item path in its first line (`T-1  v0.1 › T-2  Schema › T-4  Parser`). CLI JSON and MCP views return it as `item.ancestry`, an ordered array of `{id, kind, title}` including the item. `item.path` remains the file path. Missing/cyclic legacy parents cannot hang a read. MCP tools mirror CLI arguments: `task.create` takes `kind: release` and `version`, `task.edit` takes `version` (null clears), `task.list` takes `under`, and `task.view` returns ancestry.
- **Criterion writes (T-155).** MCP `task.criterion` takes `id`, `op` (`done`, `verify`, `fail`, `add`, `edit`, `remove`), and the stable `criterion` id (except add). `text` supplies add/edit text, `run` supplies the verifier run, and `note` supplies a failure's single-line reason. CLI: `cland task criterion T-n done C1`, `verify C1 --run rev-1`, `fail C1 --note "reason"`, `add "text"`, `edit C1 --text "text"`, `remove C1`. The live claimant Implementer, Coordinator, Aide or human may mark done; Reviewer and QA may verify/fail; Coordinator, Aide or human may add/edit/remove. These limits apply even to a role granted the whole tool. Default grants are Coordinator/Aide `task.criterion`, Implementer `task.criterion:done`, Reviewer/QA `task.criterion:verify` (verify and fail); `task.criterion:manage` is the add/edit/remove scope. An Aide needs no claim for done or management, and cannot verify/fail. First touch assigns legacy ids in order and persists `criterion_seq` in frontmatter so removed ids survive restart. Done writes a sub-item and checks the checkbox. Fail replaces current marks with its note, unchecks the checkbox and reopens in progress; done after a failure requires fresh verification. Edit preserves marks. Malformed sub-items and duplicate ids refuse writes; add also refuses an insertion point inside an unclosed Markdown code fence. An unknown human CLI --as name retains human done/manage rights; known session names retain their session permissions. Subscribers receive `task` events naming `criterion marked`, item, criterion and mark/operation. Criterion writes capture the source and publish without replacing a newer editor save; stale input is refused for retry. A publication race retains the captured source at the `.conflict` path named in the error for recovery. Successful writes also retain captured sources for late saves through old editor handles and log each path as `task-criterion-source`; recovery files are not indexed as items. Keep them until editors have closed them; recovery files and capture-intent markers are ignored by Git in provisioned projects. Startup recovers a missing live item from an atomic capture-intent marker before indexing; existing live files win. Other tracker operations keep their existing concurrent-write policy.

- **Verdict criteria (T-156).** CLI verdict comments accept `--verified C1,C3|all` on clear verdicts or repeated `--failed "C2=note"` on not-clear verdicts. MCP `task.comment` accepts `verified` (the ids string or `all`) and `failed` (`[{criterion, note}]`); socket frames carry them inside `verdict`. Only Reviewer/QA with the criterion verify grant can mark them. The verdict, legacy id assignment and all marks share one tracker write using the criterion hand-save protections. Unknown ids, malformed criteria or invalid notes refuse the whole verdict. Verification carries the verdict run; failure has the same effect as `task.criterion fail`. Successful marks emit criterion events, and the verdict report lists its marks and carries structured `Message.criteria` (message-frame section above).

- **Rank (T-122).** Tasks and configured containers below `tracker.levels[0]` may have an explicit safe integer `rank` in frontmatter. An absent rank resolves to the numeric id times ten; new items omit it and legacy files are not rewritten. Lists (CLI, MCP and subtree queries) use one shared comparator: effective rank ascending, then numeric id ascending. View, list and event rows always carry the resolved rank, including for unranked kinds. `cland task rank T-n --top`, `--before T-m` or `--after T-m` and MCP `task.rank` move among items with the same parent; another parent or a self-reference refuses. The default Coordinator takes the lowest-ranked unblocked planned task in the current release: the open configured top-level container with the lowest semver version. Ranking is granted to the Coordinator and the human by default.
- **Rank writes.** An item already in position is untouched. Otherwise the hub chooses a sparse integer between its neighbors (equal ranks are allowed when numeric ids retain order); a dense interval scans outward once on each side, picks the smaller feasible window and fills it evenly, retaining the moved rank when possible. The computation is linear. If no bounded gap exists, the whole rankable sibling list gets spacing ten; an unrankable fixed boundary refuses that fallback. Neighbors commit first, the moved item last, through the tracker queue. The response returns `item`, `changed` ids and ordered `siblings`. After the temporary-write awaits, the hub re-reads disk sibling ranks and parents before rename and refuses stale plans or revoked permissions. The directory scan plus rename remains the accepted hand-edit window. Each file commits atomically; a failed batch reports its committed prefix and can be retried, with no rollback of earlier files. The final event has `siblings`; per-file events expose each committed rank.
- **Retiring the priority label.** After merging T-122, restarting the hub and adding `task.rank` to this project's Coordinator permissions, run `node hub/bin/migrate-high-rank.ts` from the root. It lists items through the CLI and refuses before any writes when more than one item under a parent carries the label (open or closed), naming those items. Each singleton is ranked to the top unless already first, then its label is removed through the hub. Multiple-item support would need stable numeric id order: the original implicit ranks are id × 10 and migration never changes ids. Its JSON report names moved items, old/new ranks, parents and changed ids, plus retired ids. A successful rerun writes nothing; a failed label removal retries without moving the already-first item. The JSON report preserves the committed prefix even on failure. No item files are edited by the script.
- **Writes (T-77)** go through the hub and await an ordered read–change–write–rename–index cycle. One tracker-wide queue admits file mutations, import batches, watcher reads, serving-time rescans and views in call order. A view waits for earlier writes; hand renames, moved frontmatter ids and reindexing cannot put writes to the same file on different queues. Verdict Git resolution runs inside its admitted operation, so later tracker operations wait behind it. A task claim writes its status through the queue and publishes the claim after the file and index commit; it survives a racing comment. Fallback directory listings and stats are asynchronous and share the queue. Import batches reserve the queue before lookup and id allocation, so concurrent first imports cannot duplicate a GitHub reference. Nothing is committed to Git.
- **Atomicity and completion.** Item text is written to a temporary file in the same directory, then renamed over the item. A failed temporary write or rename rejects the call and cleans up its temporary file; the old item stays intact. A process crash before rename may leave a temporary file, which scans ignore. Results wait for rename, index/evidence updates and notifications; verdict evidence is available when the call returns. As before, there is no `fsync`: completion promises process-crash durability of the replacement, not a power-loss guarantee. Every mutation rechecks the caller's permission immediately before rename; a revoked call removes its temporary file and refuses. Comment writers also recheck their identity, preserving verdict provenance. Each synchronous continuation after Git or file I/O is measured as resumed request work; nested scopes of the same request count as one continuous stretch; disk waits are excluded. Shutdown drains admitted commits and watcher work before closing the index.

**Epic plans (T-183).** The second configured container level (`tracker.levels[1]`,
`epic` by default) keeps its plan in one `## Plan` section containing
one fenced `yaml` (or `yml`) block. Stages run in list order; each lane is an ordered
list of tasks worked in parallel with the other lanes of that stage. For example,
where T-55, T-57, T-58 and T-63 are tasks under the epic and T-63 has criterion C1:

```yaml
stages:
  - name: schema and CLI
    qa: { scope: affected, when: after-stage }
    lanes:
      - [T-55, T-57]
      - [T-58]
  - name: panels
    qa: { scope: full, when: per-item }
    lanes:
      - [T-63]
items:
  T-58:
    qa: { scope: none, when: per-item }
  T-63:
    qa: { scope: affected, when: per-item }
    qa_criteria: [C1]
```

Stage names are unique, nonempty single lines. Stages, lanes and each lane's item
list must be nonempty. Each task appears once, must exist, and must be a descendant
of the epic. Plans may cover a subset of its tasks. Every stage supplies `qa.scope`
(`none`, `affected`, `full`) and `qa.when` (`per-item`, `after-stage`). The optional
root `items` mapping holds per-item `qa` overrides and/or `qa_criteria`: stable
criterion ids that exist on that task. Overrides for items outside the lanes,
duplicate criterion ids, unknown fields and malformed or duplicate YAML keys are
refused with a reason. This slice stores the policy; gate enforcement, approval,
stage QA and the plan view follow in later slices of T-114.

Save the example as `plan.yaml`, then run:

```sh
cland task plan set T-<epic> --file plan.yaml
cland task plan show T-<epic>
cland task plan show T-<epic> --json
```

`--file -` reads YAML from stdin. MCP `task.plan` takes `{id, op: "set", yaml}` or
`{id, op: "show"}`; frames use `type: "task.plan"` and `item` in place of `id`.
Set/show return `{id, plan}`; no plan is `null`. `task view --json` and MCP
`task.view` also return `item.plan`. Set replaces only the Plan section, preserving
other body sections and comments, and never changes the lane items. Generic body
writes validate plans too, so `task.edit` cannot publish an invalid plan.

A refused tool write leaves the file and accepted plan intact. An invalid hand
save remains on disk for repair: the watcher logs `task-plan-refused`, retains the
last accepted plan in the index, and view/show report its `planError` beside that
plan. The retained version survives hub restarts. A valid hand save replaces the
snapshot; removing the section clears the plan. When child criteria or membership
change, the tracker retries dependent plan candidates, including an epic save
indexed before its child save. A read that sees a valid save before the watcher
retains and journals that same version before showing it. The files remain the source of
truth: a fresh database rebuild reads valid plans after indexing their lane tasks.
Changes are journalled as `task-plan-changed` with the epic id, author, source,
and full previous/new plans; rejected hand saves name the validation reason.

The default Coordinator has `task.plan` (set and show). Implementer, Reviewer and
QA have `task.plan:show`; `task.plan:set` grants writes separately. The human can
set/show from their own shell. Existing projects with explicit permission lists
must add `"task.plan"` to `[coordinator.permissions] tools` and `"task.plan:show"`
to the Implementer, Reviewer and QA lists to use these tools. Lead/Aide grants and
approval arrive in their own slices. No role clause changes in T-183.

- **Synchronous read API.** Construction, the initial `start()` scan and its initial directory stamp run before serving and retain synchronous filesystem calls. `view()`, `mergeView()`, `files()`, `reserveId()` and `rescan()` remain synchronous for standalone/bootstrap use; `cland init` keeps its own synchronous provisioning code. The task CLI has no offline tracker writer: its mutations and reads all call the hub. Serving-time `task.view`, mutations, imports, topic creation and the shared item-launch path use asynchronous APIs. Merge/worktree/release/sync checks also use queued asynchronous views (T-78), including `mergeViewAsync()` for durable verdict evidence; native adapter spawn filesystem calls remain T-79.
- **Hand edits** are picked up by a watcher on the folder (debounced 100 ms) and re-indexed, about 120 ms after the write as the hub log's `task-reindexed` stamps it (the test asserts under a second on that stamp; a `cland task list` poll adds its own process start-up, seconds on a loaded machine); a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), or a hand edit landing while the hub writes the item (between its read and its rename: the file is checked just before the rename and the replaced file just after; the hand edit is overwritten), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **Verdict commits and provenance.** `task.comment` accepts `verdict.commit` on the wire, `commit` on the spoke tool, or `--commit <sha>` on the CLI. An explicit SHA must resolve to a commit and is written in full; without it, the hub records the tip of the item's local `branch`, if it resolves. The result includes `commit: {sha, source: "explicit" | "branch" | "none", note}` and the plain CLI prints the note, including when no commit could be recorded. Text verdict headers accept `commit:` too.
- **Durable verdict evidence.** `tracker_written_verdicts` holds item, kind, result, run, commit, writer session id, role at write time and comment time, plus a fingerprint of the exact comment. This table is never rebuilt from item files. The separate file index gains `commit_sha` and `comment_key` with additive migrations. `task.view` and `task.list` give every verdict `source: "hub" | "file"`; a hub verdict also carries `writer: {sessionId, role}` from the stored evidence, never from `by:`. Each durable record matches at most one comment in write order; duplicate comments and out-of-order replays have file provenance, including when the original occurrence is removed. An unrelated hand edit preserves it; changing the verdict or its comment removes the match. Imported and hand-written verdicts have `file` provenance, even if their `by:` claims a Reviewer.
- **Freshness.** The latest verdict of each kind in file order carries `current: true | false` on view and list. It is current when its commit is the branch tip, or the whole diff from its own merge base has the same `git patch-id --stable` as the tip's diff from its own merge base. The base is the territory’s configured `cland.taskBase`, else `dev` when present, else `main`; `verdictBase` says which was used (null if neither exists). Missing or unresolvable commits are stale, and so is a branch with no tip (once a tip read that started after the question finds none: until then it is unknown); unavailable Git facts never establish patch equivalence. Earlier verdicts omit `current`. The Neovim item view and plain CLI show the short commit, current/stale and from the hub/file; Neovim marks stale red. The merge gate selects the latest hub-written verdict, separately from file-only headers.
- **When freshness is computed** (T-67). Read requests (`task.list`, `task.view`) read only the cache; Git work for writes and merges is asynchronous. The hub keeps a cache of answers keyed by (verdict commit, branch tip, base, base tip) and reads every branch tip with one `git for-each-ref` every 2 seconds and about 50 ms after any tracker change; a verdict written through the hub records the tip it just resolved, so it is current at once. An answer the cache does not hold yet (a tip that moved, a verdict hand-edited in) is computed in the background, one at a time, and `current` is absent until then: absent means unknown, not stale. When it arrives, the item is announced again as a `task` event, only if its freshness changed. So after a commit, a rebase or a branch rename, `view` and `list` can show the old answer for up to about 2 seconds, then no answer, then the new one. The background work never starts inside a read: a read that finds a new question only queues it. `verdictBase` comes from the same tip read (null until the first read). A verdict's commit (`--commit`, or the branch tip by default) is resolved with Git before the item is written, asynchronously, so a verdict write blocks no event-loop work; later queued tracker operations wait for it. When Git does not answer at all (it timed out or could not start), the write is refused with code `git-unavailable` and a message naming the commit or branch it could not resolve; nothing is written.
- **Ready and pending freshness (T-121).** Ready uses the merge gate's own durable provenance and freshness evaluation: a current clear Review is always required, plus current clear QA when the resolved stage or item override requires per-item QA. Tasks outside a plan use `[plan] qa_default`. QA-marked criteria require QA verification; plan changes recheck descendant tasks. It rejects evidence from the holder of an Implementer or Aide claim. Verdicts and branch-tip changes schedule this check off the merge path; status writes use the tracker queue and recheck branch tips, file evidence and the item index revision before rename. Every item index change requeues the check; a changed revision drops a prepared write. Status converges after queued watcher/index events, and merge always re-reads the gate evidence. During `review-pending` or `qa-pending`, the UI keeps the last settled status and the gate still refuses merge. Once the check settles, an unchanged patch keeps `ready`; a changed patch or failed/timed-out patch-id check returns it to `in progress`. A new verdict or changed branch/base tips provides a new cache key for another check. Invalidated or failed readiness checks retry with a 50 ms–1 s backoff and stop after ten failed attempts, posting one Agents notice with the item and error. The next item index, verdict or branch-tip event starts the check again.
- **Verifier holds.** Reviewer and QA take `task.hold` (`cland task hold T-n [--release]`) beside the Implementer claim; Reviewer sets `review`, QA sets `qa`. The assignee and claim stay independent. Holds live in `hub.db`, appear as `holds` in view/list/task events, and release on their holder's verdict, explicit release, session stop/death, or item close. A first hello atomically adopts claims, holds and durable verdict writer provenance (including text-header verdict comments) from the provisional name to the session id. The in-memory alias is published only after commit; a failed adoption fences verdict, claim and hold work until a queued retry succeeds. At hub startup and Sessions binding, the hub scans durable provisional claims, holds and writer provenance, reconstructs fences for every known session identity, and retries atomic adoption before real-id work. Unknown identities remain provisional. Gate and ready evidence also resolve identities through the hub’s authoritative session mapping. At startup, binding Sessions reconciles holds of known non-running process identities; unknown and direct identities keep their holds. Release without a verdict preserves the review or QA status while gate evidence is missing or pending, including release on stop and startup reconciliation. If the required verdicts are already clear and current, the gate evidence takes priority and the queued check settles at ready, including after a repeated hold is released.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. A claim is held by the claimer's identity, not its name: a spoke's session id (a rename keeps the claim; another session taking the old name gets none of it), or `human` / `cli:<name>` for the CLI, which is never a session. `view` shows the holder's name (`session`) beside its identity (`sessionId`); the holder claiming again refreshes the name. Another holder's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set) it always acts as that session and sends its `$CLAND_SESSION_ID`: `--as` (the human's name, another session's, the Coordinator's) cannot change that, and a different `--as` only earns a note on stderr. Outside a session it acts as `--as <name> [--role r]`, else `human`. On the wire a frame's session id decides before its name: a frame carrying one is that session's call even when it names `human`. What stays open: a shell that unsets both variables is the human's, as any process holding the hub's socket is (the CLI's identity is its environment). Acting as a session the hub knows (by that id, or a name a session holds or held), the call is that session's: checked against the role the hub holds for it, audited as it, its claims held by its session id (Roles, Permissions); the frame's `--role` is then ignored. A name no session ever had is a CLI actor (`cli:<name>`), unrestricted as the human is. The hub refuses a name outside the session-name grammar (`[a-z0-9][a-z0-9-]{0,23}`, not reserved) and a role that is not one of the role names: both are written into item files.

| Command | Tool | What it does |
| --- | --- | --- |
| `cland task create <title> [--kind] [--version] [--body \| --body-file] [--label]… [--assignee] [--parent] [--blocked-by]… [--topic] [--branch]` | `task.create` | Writes a new item file. |
| `cland task view <id>` | `task.view` | Frontmatter, file path, ancestry, body, plan (and planError on an invalid hand save), criteria and their warnings, comments, verdicts and the claim. |
| `cland task plan <set\|show> <epic-id> [--file plan.yaml]` | `task.plan` | Validates and writes, or shows, the epic plan (Epic plans above). |
| `cland task list [--under T-n] [--state] [--label]… [--kind] [--assignee] [--verdict review=clear]` | `task.list` | Queries the index. Each item carries its claim and its verdicts in file order (the latest last). |
| `cland task comment <id> <text> [--verdict review\|qa --result clear\|"not clear" --run <id> [--commit <sha>]]` | `task.comment` | Appends a comment, or a verdict. |
| `cland task edit <id> [--version] [--title] [--body] [--kind] [--state] [--status] [--label]… [--add-label]… [--remove-label]… [--assignee]` | `task.edit` | Changes fields; `none` clears the assignee. |
| `cland task close <id> [--comment]` | `task.close` | Closes the item. |
| `cland task link <id> [--parent] [--blocked-by]… [--unblock]… [--topic] [--branch]` | `task.link` | Sets the links; `none` clears one. |
| `cland task hold <id> [--release]` | `task.hold` | Reviewer or QA takes/releases its own verifier hold beside the Implementer claim. |
| `cland task criterion <id> <op> …` | `task.criterion` | Done, verify, fail, add, edit and remove criteria with role and claim checks. |
| `cland task rank <id> --top/--before T-n/--after T-n` | `task.rank` | Moves among siblings with minimal rank writes; returns changed and ordered sibling ids. |
| `cland task claim <id> [--release] [--force]` | `task.claim` | Takes or releases the claim. Claiming an open task in a project with a territory makes or reuses its branch and worktree (Task branches and worktrees). |
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

### Tests

Implementers use `cland suite` for full runs and wait for its artifact-backed result;
see [the agent test workflow](../docs/agents/tests.md). The package commands below
are also available for humans and isolated CI.

Run one full suite at a time, using `npm test` at the root (hub, then Neovim),
`npm test --workspace hub`, or `npm run test:nvim`. A hub-only run takes
`/tmp/cland-suite.lock`; a Neovim-only run queues once for joint admission to
`/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock`. Every phase takes the machine lock, so
hub and Neovim runs serialize across projects and worktrees. `npm test` queues
once for joint admission to both locks before hub starts, and keeps them through
Neovim; each phase cleans up its processes and temporary root before the next
starts. Neovim-only and full-run waiters hold neither lock until both are free
under their recovery guards, so
live legacy Neovim-first waiters can drain without an opposite-order cycle.
See [agent test notes](../docs/agents/tests.md). A second run prints the holder's
pid, start time, worktree and its own queue position. Atomic PID/start-time
tickets published before guard polling in `<lock>.queue/` order admission by monotonic enqueue time; dead
waiters are swept and interrupted waiters remove their own tickets. The queue
survives release and recovery of the ownership directory. Automatic runs publish a PID/start-time sidecar
before creating the directory. After a one-second grace period, a dead holder
(including a reused PID) is reclaimed: its verified processes exit and its run
directory is removed before the replacement suite starts. The short, unique
run-root path is recorded before directory creation, so interrupted setup is
recoverable too. A live older-version holder with an unreadable start time is
preserved until its PID exits; the waiter identifies it as an older version.

An empty lock from the manual `mkdir` convention has no recorded owner and is
never reclaimed by age. Once a minute the waiter prints its age and recovery
guidance, with a warning after 15 minutes. If no suite is running, remove an
abandoned manual lock with the `rmdir` command printed by the waiter, naming
either `/tmp/cland-suite.lock` or `/tmp/cland-suite-nvim.lock`.
`CLAND_TEST_SKIP_LOCK=1` skips the lock in isolated CI jobs.

The suites run at concurrency 4. Targeted single-file runs are free:
`node --test hub/test/daemon.test.ts`. If calling the runner directly, use
`node hub/test/run-suite.ts hub` or `node hub/test/run-suite.ts nvim`; raw
`node --test` is reserved for targeted runs.

The runner uses a short temporary directory for each run (Unix socket paths must
fit), verifies process start identities and either cwd containment in an owned
directory or a current parent chain to its recorded runner before signalling,
and prints any final leftovers, including detached hook bridges. Test helpers register temporary
project ownership before spawning: their after hooks kill owned descendants
(and groups only when every member and the leader are verified)
before removing the directory, and signal handlers cover SIGINT/SIGTERM where
Node's test after hooks do not run. New process fixtures must use `tempProject`
or `ownDirectory` and register teardown before awaiting process startup.
Each test runner waits at startup until its PID/start identity is durably
recorded. Environment markers only identify candidates; they never prove
ownership. Ambiguous candidates are preserved and printed in the sweep report.
Cleanup uses `ps` plus `lsof` on macOS, or `/proc` on Linux.
Each suite invocation prints its elapsed duration and peak sampled one-minute
machine load, which includes other activity on the machine.

### `cland` on the PATH

The project hooks `cland init` writes into `.claude/settings.json` call `cland` from the PATH, and do nothing when it is not there (a Claude Code session the hub launches does not need it: its hooks name the CLI by path). To run them for a session started by hand, and to type `cland` instead of `node hub/bin/cland.ts`, put the CLI on the PATH once, from the repository root, with either:

```sh
npm link                                              # links the package's `cland` bin into npm's global bin folder
ln -s "$PWD/hub/bin/cland.ts" ~/.local/bin/cland      # or a symlink into any folder on the PATH
```

Both point at this checkout, so `git pull` updates the command; `npm unlink -g cland` or `rm ~/.local/bin/cland` removes it. Node resolves the CLI's imports from the link's target, so either works from any directory.


## Artifacts

Show a file with the spoke tool `artifact.create`:

```json
{"kind":"diagram","title":"Merge flow","content":"graph TD; A-->B","topic":"topic-3"}
```

Kinds are `prompt`, `note`, `page`, `diagram`, and `file`. Give exactly one of `content` or `path` (relative to the session's working directory). A path is copied, so deleting its source or worktree leaves the artifact readable. Text content defaults to `.md` for prompts/notes, `.html` for pages, `.mmd` for diagrams and `.txt` for files; copied files retain their extension. Files live under `.cland/artifacts/A-<n>-<slug>.<ext>`, with a durable hub index containing the id, title, kind, creator, time, topic, status and absolute path. Every create is a new id, initially `shared`; prompt creation can request `status: "draft"` to save without publishing a message.

The result includes `artifact`, `id`, and `path`. The topic message carries a structured `artifact` field, and session deliveries name `artifact_id` and `artifact_path` in their envelope. Publication obeys the message size cap and the session's send rate limit; refusal leaves no file or index entry. The file content itself is not subject to the message text cap (wire frames retain their existing maximum size).

The Coordinator and Aides may share in any topic. Other roles may share in their claimed or assigned item's topic or a topic where a request was delivered to them; General and Agents are available to the Coordinator and Aides. Invalid kinds, missing files, unknown topics, invalid titles, and ambiguous sources return typed errors; forbidden topics return `forbidden`. The CLI enforces the same session identity and permissions as spoke calls.

```sh
cland artifact create --kind diagram --title "Merge flow" --content 'graph TD; A-->B' --topic topic-3 --json
cland artifact create --kind page --title Preview --path preview.html --topic topic-3
cland artifact create --kind note --title Findings --content-file - --topic topic-3 < findings.md
cland artifact list --topic topic-3 --json
```

Directory sources are copied as a single folder artifact, with `folder: true` and a project-owned directory `path`. Its `entry` is a relative file name: supply it at creation or let the first `.md` in sorted relative-path order become the entry. `folder: true` without a source creates an entry file (`index.md` by default), optionally filled from `content`. A copied folder must contain its entry, and only regular files and directories are accepted; symlinks and special files are refused. Folder contents have no separate ids. The entry is used for prompt sending, attachments, launch briefs and opening the chip in the workbench.

`artifact.list` is also a spoke tool. With `artifact: "A-3"` it resolves that id and returns `{artifact, files}` for a folder (`files` is a sorted list of relative file names), or `{artifact}` for a file. Without an id it lists the project or a supplied topic. Files are discovered on request, so editing or adding them does not require reindexing.

The UI can send `artifact.create` and `artifact.list` frames; list returns `{artifacts: [...]}` for the project or a supplied `topic`. Drafts are included in lists and emit `artifact` events for subscribed clients. A human `prompt.send` frame (`artifact: "A-3"`, optional `attach: true`) reads the saved prompt and posts its text when it fits `[hygiene].max_text_bytes` (8 KiB by default). Above the cap, or with `attach`, it posts `Prompt A-3: <title>` with the artifact attached. The pointer is bounded to the byte cap on a complete UTF-8 character boundary; the full title remains in attachment metadata. The message and `sent` status commit together before publication: a failed post or status write leaves the draft and no delivery. A prompt already sent cannot be posted again through `prompt.send`.

The spoke's `send` accepts `artifacts: ["A-3", "A-4"]` alongside `text`, `to` and `topic`. Each id must exist in that topic, be unarchived, and have a readable file; unknown or foreign-topic ids refuse the whole send. Availability and caller permissions are checked again after asynchronous file preparation. Attached prompt drafts become `sent` with the post. Deliveries include an `artifacts` array of metadata and durable paths; `artifact_id` and `artifact_path` name the first attachment for compatibility. Attachment messages retain their text alongside chips in the workbench.

Artifact creation prepares and cleans up its files asynchronously, with serialized id reservation, indexed ownership checks, and measured request continuations. The shared permission gate reads the in-memory roles snapshot, and journal appends use an ordered asynchronous queue (T-75).
### Promote, archive and retention

The human can keep an artifact in the repository with `cland artifact promote A-3 docs/design/merge-flow.mmd`, or press `p` in the topic's artifact list and enter a project-relative path. An Aide can promote through the `artifact.promote` spoke tool or from its shell. The Coordinator can promote agent artifacts from its own shell through the `artifact.promote` grant; Implementer, Reviewer and QA cannot. The UI frame is `{"type":"artifact.promote","artifact":"A-3","path":"docs/design/merge-flow.mmd"}` and returns `{artifact}`. Promotion copies the bytes, creates missing parent directories, records `promoted` in the index, and stages or commits nothing. Existing destinations, absolute paths, `..` segments, paths under `.cland/` or `.git/` (including case variants), and symlinked parent directories are refused. After copying, a resolved path outside the project or under `.cland/` or `.git/` is removed and refused. Promotion confines paths against the project tree as it is, not against concurrent filesystem changes by other processes. The list and picker show `promoted: <path>`. Promoted artifacts keep their original source and are exempt from archive and retention.

Closing a topic, directly or by closing its bound item, marks its unkept agent artifacts `archived` and records `archivedAt`. A message reopens the topic and restores surviving automatically archived artifacts to `shared`; explicitly archived artifacts stay archived. Archived files are deleted in the background at hub start and daily after `[artifacts] retention_days` (default `30`; `0` makes them eligible immediately). Deleting a closed topic leaves its archived entries eligible for retention. The index entry remains with `fileDeleted: true`, shown as **file deleted** in the CLI, topic list and picker. Reopening a topic does not restore deleted artifacts. Artifact-change events update connected workbenches.

Artifacts record immutable author kind and role at creation. The human's and Aides' artifacts are never archived or deleted automatically, including after the author changes role. A manual archive only changes their layer. `artifact.keep {artifact: "A-3"}` sets `kept: true`, exempts an agent artifact from retention; `kept: false` releases it, archiving it if its topic is already closed. Keeping an archived artifact restores it to shared. Kept-to-watch classification is the T-205 follow-up. `artifact.archive {artifact: "A-3"}` explicitly archives it. Agents cannot mutate a human or Aide artifact through these tools, move, or promotion; an Aide may act for the human.

`artifact.move {artifact: "A-3", folder: "A-4", name: "notes.md"}` absorbs a file into a folder. `name` is optional and defaults to the original file name. Existing names, dot segments, folder-to-folder moves, moved sources and destinations the caller cannot edit are refused. A human or Aide file requires a human or Aide folder so absorption preserves its protected lifetime. The source index becomes `status: "moved"` with `movedTo: {folder, path}`; it disappears from ordinary lists and follows the destination folder's lifetime. The old id still resolves through `artifact.list`, history chips, attachments and launch briefs to its file inside the folder. Move publishes the redirect before removing the old hard link; a housekeeping failure returns success with `followUp`, and retention retries removal without deleting a different file recreated at the old path.

Folder retention uses a rename to a deterministic `.retained` directory until the index commits. Failed index writes or a concurrent keep/reopen restore the entire folder; interrupted cleanup recovers on the next sweep. Deletion or housekeeping failures remain retryable. Ordinary file retention keeps its existing hard-link recovery.

The built-in role tool lists now grant `artifact.keep`, `artifact.move` and `artifact.archive`. Existing explicit `roles.toml` lists need those grants added; `artifact.list` uses the existing history/read grant. No role clause changes are required. Folder promotion and the expanded artifact CLI belong to the next artifact slice.

`cland init` writes `[artifacts]` with `retention_days = 30`. `cland update` adds that section to managed configurations that lack it and keeps changed values, including zero. It leaves unmarked config files and existing `roles.toml` files alone; an existing explicit Coordinator tool list needs `"artifact.promote"` added by the human.

Promotion reserves its artifact across asynchronous I/O, rechecks permission and the latest index state after copying, and rolls back its exclusive destination if the index write fails. A notification failure after the index commit keeps both the copied file and its promoted mark, returning a successful result with a `followUp` warning; a retry sees the existing promotion. Subscriber and error-logger failures cannot reverse committed promotion, archive or reopen state. Retention retains a hard link until deletion and its index write finish, so a topic reopened during deletion or an index write failure restores the original bytes. Interrupted retention is recovered on the next sweep; failed housekeeping is retried. A concurrent promotion/cleanup of the same artifact is refused with `artifact-busy` and can be retried.

### Harness termination and orphan sweep

`cland session stop <name>` waits for the launched OpenCode server, Codex app-server or Claude Code process tree to exit. It verifies each PID’s recorded start time immediately before signalling that positive PID, sends SIGTERM, and escalates after the grace period (`CLAND_STOP_GRACE_MS`, default 5000 ms). Before SIGKILL, it freezes verified PIDs with SIGSTOP, walks the tree again to capture and stop late children, and confirms the entire captured tree is stopped. It then kills each verified PID and confirms that every captured identity is gone. It never signals an entire process group: new group members cannot inherit ownership from an earlier snapshot. Every exit path sends SIGCONT to the PIDs this call stopped unless their identities are confirmed gone, including when process inspection is unavailable. If death or PID reuse happens without being observed before inspection fails, this recovery SIGCONT can reach a replacement process; the policy accepts that tradeoff because CONT does not affect a process that is not stopped. A refused or unverifiable escalation reports incomplete termination. Relaunch waits for that same termination before starting the replacement. `harness-ended` in `.cland/journal.jsonl` names the server PID, captured descendants and whether killing was necessary. An unverifiable PID is never killed; stop/relaunch fails and retains its running row and supervision.

After opening its sockets, a new hub sweeps this project’s harness servers whose session is exited, stopped or offline, or whose process-table row is missing. Ownership requires a verified OS cwd under this project or descent from a PID/start-time-verified wrapper with a project cwd. When a process row exists, its recorded PID and start time must match; an unknown start time or reused PID is preserved even when socket or log hints match. A recorded launch, project-specific Codex socket/log or OpenCode `serve.log` identifies candidates but never proves ownership alone. This also covers a Codex socket placed under the temp directory because the project path is too long. Verified running roots and their descendant trees are preserved for resume. Pending launch and resume reservations also protect servers before their process-table rows are published; the sweep rechecks these protections immediately before every signal. A PID/start-time-verified lock under `.cland/run/orphan-sweep.lock` serializes startup and doctor sweeps per project; a contender reports “sweep busy”. Within one sweep, workers atomically claim each process they capture, and ancestor candidates settle before queued descendants are reassessed. Cleanup runs in parallel in the background with a shared 12-second deadline, so it cannot delay socket readiness. Startup points to `cland doctor`, which reports the PIDs ended since the latest hub start from the journal (`orphan-ended`). Ambiguous candidates are reported as `orphan-preserved` and left alive. Sweep diagnostics also reach stderr.

`cland doctor [dir]` reports orphan servers, names their recorded session and status, and recommends `cland doctor --fix`. The fix ends verified orphan harness servers while preserving running sessions and unverifiable identities. An unpublished server is preserved while another live hub holds the project lock, because doctor cannot see that hub’s in-flight launch reservations; stop that hub before retrying cleanup. Doctor also reports cland hub daemons whose project directories were deleted, using their OS cwd and open project files to prove ownership, and `--fix` ends those daemons. Doctor tests scope deleted-project discovery to their fixture root with `CLAND_TEST_ORPHAN_ROOT`, so parallel fixtures cannot end each other’s hubs. If the OS cannot supply ownership evidence, inspect the candidate manually. On Linux the sweep reads `/proc`; on macOS it uses bounded asynchronous `lsof` calls. Every session start-time probe and termination probe uses asynchronous `ps`, keeping process inspection off the hub’s synchronous request path.

### The item’s review and QA loop

The Implementer’s claim makes it the item lead. After committing and pushing its branch to `origin`, it sets status `review` and sends kind `report` to `reviewer`, first line `review request T-<n>`, naming branch/head, criteria and scope. Reviewer and QA accept requests from that claimant, a supervising Lead within its subtree, or the Coordinator. For QA, the Coordinator writes and commits `qa/briefs/T-<n>.md` before launch; the lead names it in `qa request T-<n>`. Without a brief, the lead requests review only, unless QA is required: a missing brief or verifier is a blocker to report to the Coordinator.

Verifiers take `task.hold`, record their verdict and report with kind `report` to `lead T-<n>` in the request topic. The claimant fixes not-clear findings, pushes and requests another pass itself. The hub checks current verdicts and marks the item `ready`; that one status event starts the supervising Lead’s or Coordinator’s turn and stands for the lead’s ready report. The supervising Lead or Coordinator merges through the gate without relaying verdicts. Keep the claim until merge. For unclaimed items the lead address resolves to the Coordinator; closed or unknown items must be addressed to `coordinator` directly.

Routine updates use kind `progress` and wait for the next turn; requests, verdicts and blockers use `report` or `question`, decisions use `decision`. Coordinator reports to the human appear in Watch, while questions and decisions needing attention appear in Now. Default subscriptions handle the lead’s intermediate events; use `subscribe` for additional subjects and `subscriptions` instead of polling. See [review and QA](../docs/review-and-qa.md).

### Event subscriptions

A session calls `subscribe({ subject: { session: "impl-3" }, events: ["session.state"] })`
or `subscribe({ subject: { item: "T-58" }, events: ["task"] })`. It gets a subscription
with an `id`, `subject`, `events` and `digest: "turn"`. Repeating the same request returns
the same id. `subscriptions()` lists only the caller's subscriptions;
`unsubscribe({ subscription: "<id>" })` removes one of its subscriptions. These tools
are available to the four crew roles (Coordinator, Implementer, Reviewer and QA). Aides cannot subscribe; retained explicit subscriptions from a previous role do not deliver events while the session is an Aide. An Aide claimant receives its item's default subscriptions as direct lead deliveries. Existing projects can grant `subscribe`,
`unsubscribe` and `subscriptions` in each role's `permissions.tools` list.

The CLI uses the same subscriptions and the session identity of a launched shell:

```sh
cland subscribe session impl-3 --event session.state
cland subscribe item T-58 --event task
cland subscriptions --json
cland unsubscribe <subscription-id>
```

From the human's shell, add `--as <session>` to act as a known session. CLI calls are
checked against that session's hub-held permissions. A session can subscribe to a
session name before it launches. A rename moves session subjects to the new name;
subscriptions belong to the subscriber's stable session id, so its own rename keeps
them. Item and subtree subjects must name existing items; topic and role subjects
must exist. A subtree includes its root and all descendants, following the current
item tree. Item/subtree events also include sessions working on those items and
artifacts/topics bound to them. Role subjects follow sessions holding that role,
including their usage and artifacts. Session subjects support `session.state`,
`usage` and `artifact`; topic subjects support `topic` and `artifact`.

Session events are idle, busy, waiting for human, waiting for approval, launched,
stopped and died. Task events are status changed, claimed, verdict posted and closed.
Topic events report waiting for human, closed and deleted; artifact events report created
and shared (including a sent prompt). Usage subscriptions require exactly one
positive threshold, `{ cost: 3 }` (USD) or `{ tokens: 1000000 }` (total tokens).
A threshold crossing is remembered per subscription and session across hub restarts;
updates remaining above it do not repeat the event. Unknown cost does not mean zero.
Overlapping subscriptions deliver the same occurrence once per recipient.
Each is a one-line delivery from `hub`, for example
`event · session.state · impl-3 died · T-58`. Only the hub emits kind `event`;
a session's `send` cannot use it.

Events remain queued without starting a turn. They join progress notes, in recorded
order, in the ordinary recipient-specific digest with the next turn-starting delivery.
Subscriptions and queued events survive a hub restart. Every recipient row, including
mixed turn/now modes and coalesced counts, commits together before publication or
steering. Observer, transport and logger faults after commit are isolated and logged;
they leave the committed rows and artifact bytes intact. Events use the same delivery
stages, acknowledgement, injection, immutable retry batches, TTL, retention and
message-deletion rules as progress. Unsubscribe stops future matching events when
it returns; events already recorded remain queued or bound to their existing digest.
The UI's connection-scoped `subscribe` stream frame is unchanged: session tools use
`event.subscribe`, `event.unsubscribe` and `event.subscriptions` frames.

Use `digest: "now"` to deliver immediately through the same queue: Codex and OpenCode
steer a running turn or start one while idle; Claude Code and unmanaged sessions
fall back to the next-turn digest. The CLI accepts `--digest now`, `--cost 3` and
`--tokens 1000000`, with subjects `session`, `item`, `topic`, `role` and `subtree`.
For example:

```sh
cland subscribe subtree T-50 --event task --event topic
cland subscribe role implementer --event usage --cost 3 --digest now
cland hub subscriptions --json
```

Consecutive equal events on the same concrete subject coalesce while queued and unbound within
60 seconds of their first occurrence, with `×N` on the delivered line. A different
event for that subject breaks the run, preserving every lifecycle transition. A bound
recipient's batch never changes; another recipient can still coalesce its own
unbound row. A digest shows at most 10 event lines, prioritizing final subject facts
and then the oldest events, with `and N more` for overflow. Progress notes remain
uncapped. All underlying event rows move through acknowledgement and injection
with the batch, including the summarized rows.

Stopping or losing a subscriber ends its subscriptions. A session stop/death, an
item close/removal or a topic close/deletion sends a final event and ends subscriptions to
that exact subject, including a subtree's root. A role or subtree subscription
survives the death of a member. Removal uses the item's pre-removal ancestry;
reparenting sends a final membership fact to subtrees the item left. Startup
reconciles committed stops and persists their final-event checkpoint with cleanup,
so another restart does not repeat them. Reopening or relaunching an exact subject requires
a new subscription. Unsubscribe and lifecycle closure leave previously recorded
events in their existing queue/batch.

Events have a separate durable recipient limit under `[hygiene]`:
`event_limit_max = 120` and `event_limit_window_minutes = 10`. Each occurrence,
including a coalesced occurrence, uses that allowance; final subject events bypass
it so closure is reported. Events consume no message or pair-loop allowance.
The human's `cland hub subscriptions` lists all session owners and subscriptions;
sessions keep caller-only `subscriptions`. Subscriptions create no inbox entries.
The journal records event ids, subjects, kinds, recipients, counts and limiting,
never bodies.

Default subscriptions are derived from the current item claims. The Coordinator covers
open items without an active Implementer or Aide lead in their ancestry; each lead
covers its claimed items and their descendants, excluding subtrees with their own
active lead. Ownership walks up to the nearest active lead using stable session
identities; anonymous hellos retain distinct provisional name identities. Both subscription listings include these rows with `default: true`, a stable
`default:<session-id>:<item-id>` id, `events: ["task", "session.state"]` and `digest: "turn"`.
They follow claims, handovers, renames and reconnects; `unsubscribe` removes only
explicit requests. Closing an item delivers its final event and removes its default.

Default task events cover status changes, verdicts and final close/removal events.
A transition to `ready` also reaches the Coordinator with `digest: "now"`, even without an explicit subscription; it starts a turn through the ordinary queue on adapters without steering. Intermediate claimed-item events stay lead-only and digested. Explicit subscriptions may widen this traffic, and overlap still delivers once per recipient;
claim events require explicit subscriptions. Default session events cover death/stop, waiting for approval and idle beyond
`[inbox] idle_minutes` (30 minutes by default, zero disables idle events). Launched
item membership and current claims or Reviewer/QA holds identify which items a
session works on, including pooled verifiers. A lead's own death/stop or long idle
reaches the next active lead up the item tree, falling back to the Coordinator; a
disconnected lead still receives queued events. A verified stop ends ownership even
when its durable cleanup receipt remains pending. Ordinary
busy/idle, launch and waiting-for-human transitions require explicit subscriptions.
Explicit requests can also widen the event types or request `digest: "now"`; an
overlap still delivers an occurrence once per recipient. Verdicts, deaths and long
idles also create inbox notifications classified by the shared visibility policy. Harness approval prompts remain in the inbox
because they require the human to answer.

### Crew staffing

`.cland/crew.toml` is committed project staffing policy. Init and the first hub start write it once; init/update preserve existing files. `roles.toml` continues to hold role definitions, permissions and harness defaults.

The top-level `leads` is a unique list of configured container levels (empty for a flat crew). Tables `[crew.<role>]` accept `policy` (`per-item`, `per-group`, `pool`, `singleton`), optional positive integer `size`, boolean `keep_context` and `subagents`, and `stop_after` (`merge` or `never`). Unknown roles and keys are refused. Missing roles/keys take built-in defaults: Coordinator singleton; Lead per-item; Implementer per-item stopping after merge; Reviewer pool of one with kept context; QA singleton; Aide per-item without a cap. Only Coordinator and Lead allow sub-agents by default. Pool size defaults to one; singleton size must be one. Per-item/per-group size may be omitted for no cap. `per-group` is accepted for epic plans to staff later.

`cland crew show [--json]` returns the effective policy and its summary. `cland crew set reviewer.size 2` validates and atomically saves a complete TOML file; values accept TOML booleans, integers and quoted strings, or bare policy names. `cland crew set leads '["epic"]'` changes lead levels. Set normalizes the file, including filling omitted defaults. The human, Coordinator, Lead and Aide may set it; other session shells may show it. No role-clause or permission-file changes are needed.

The hub reloads every 500 ms off the request path. A malformed, invalid or missing file emits an Agents refusal notice to the Coordinator and retains the last good crew (built-in defaults before the first valid load). Set refuses to overwrite an invalid file. `crew.show` returns `{config, summary}`; `crew.set` takes `{key, value}` and returns the same shape. `hub.status.crew` carries that snapshot, and a `crew` event carries `{config, summary}` when the effective policy changes. The sessions panel header follows both snapshots and events, for example `impl per item · rev pool 2 · qa 1 · leads: epic`. Launch caps, pool reuse, merge stops and clause enforcement are implemented in the next staffing slice.
