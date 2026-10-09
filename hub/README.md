# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames (protocol 2): `hello`, `welcome`, `error`, request `result`, `deliver` and the spoke's `ack` of it, the `role` frame (a role's clause); the heartbeat interval and the frame size limit. The client hello (it carries the secret on the Unix socket), the client requests `hub.status`, `hub.stop`, `topic.*` (`topic.answer` among them), `inbox.*`, `role.*`, `hygiene.unmute`, `subscribe`, the pushed events `message`, `delivery`, `topic`, `ask`, `inbox`, `session.state`, `session.role`, `role.vacant`, `role.filled` and `task`, the typed `forbidden` result, the `inject` frame to an in-session bridge; session states and the process table's view. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/watch.ts` | A folder watch that falls back to polling every 500 ms where watching is refused (a macOS sandbox denies FSEvents): used for `.cland/tasks/` and `roles.toml`. |
| `src/hub/topics.ts` | The topic model (spec 4.5): the status moves, the mentions of a human message, the "no coordinator" warning, the port to the tracker a binding goes through. |
| `src/hub/asks.ts` | Asks (spec 4.5, #33): the Coordinator's question with numbered options; the human's answer with `answer_to`; withdrawn by `resolve`, cancelled by a close. |
| `src/hub/inbox.ts` | The inbox (spec 5, #33): asks, approvals, waiting topics and notifications, the "needs you" count, the `inbox` event; the idle threshold from `.cland/config.toml`. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, topics (status, binding, the human's read mark), messages (each in a topic), per-addressee deliveries (queued → delivered on the spoke's ack → injected on the adapter's confirmation, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. Its constants are the defaults; `.cland/config.toml` `[hygiene]` overrides them at hub start (`src/init/config.ts`). |
| `src/hub/journal.ts` | The journal, `.cland/journal.jsonl`: a tap on the log closure that appends the domain events as JSON lines (opened for appending: a restart never truncates), `write` for a record of its own, and the reader behind `cland hub journal`. |
| `src/hub/agents-topic.ts` | The Agents record: maps the hub's lifecycle events (session start, stop, death; role assignment and revocation; claims and releases) to hub notices with a `kind`, posted through `HubCore.noticeInTopic`. |
| `src/hub/core.ts` | Presence, names keyed to session ids, same-session takeover, routing, store-and-forward with acks, the standing topics, the human's messages, each session's state (set only through the adapters), the events subscribed clients receive, each session's role (assignment, the clause's delivery, Coordinator exclusivity and vacancy). Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests and acks, client requests (`hub.status`, `hub.stop`, `topic.*`, `subscribe`), the `task.*` requests from either, the `session.*` requests (`src/adapters/requests.ts`), refusals. A spoke's frames count only while its socket is open and still holds the session's name. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/server.ts` | The hub without listeners (`createHubBase`: core, dispatcher, prune) and the WebSocket edge (bearer secret check, frame size limit, heartbeat sweep). `createHub` is both, with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. Bound under a private name and renamed into place; on close it removes the path only while the path is still the socket it bound. |
| `src/hub/lines.ts` | The JSON-lines framing both byte-stream edges share: complete lines split off first, each held to the frame limit on its own, then only the unfinished remainder. |
| `src/hub/stdio.ts` | The stdio edge for a UI that spawned the hub as its child (`cland hub serve --stdio`): JSON lines on stdin and stdout, no secret, the hub stops when stdin ends. |
| `src/hub/lock.ts` | The project's hub lock, `.cland/hub.lock`: created whole or not at all, holding the holder's pid and process start time; a stale one (pid gone, or reused by a process started at another time) is broken under a guard. |
| `src/hub/daemon.ts` | The hub serving one project in the background: the lock taken first, `.cland/` prepared, store on `hub.db`, both edges bound, the adapters plugged in, `hub.json` written last; the launched sessions re-found once it is reachable. Shutdown runs backwards: edges closed, `hub.json` removed, the lock released last. For a stdio hub the listeners are optional (below). |
| `src/adapters/contract.ts` | The adapter contract (spec 4.3) and its capability table; the message envelope a harness reads. |
| `src/adapters/processes.ts` | The process table: the harness processes the hub launched, in `hub.db` (table `harness_processes`), through a connection of its own; and the one way an adapter signals a process (`signalProcess`: only after its recorded start time matches). |
| `src/adapters/sessions.ts` | The hub's side of the adapters: launch, attach, stop, resume, the state signals, and the delivery pipeline's last stage (delivered → inject → injected). Transport-free. |
| `src/adapters/requests.ts` | The `session.*` frames and their handler. |
| `src/adapters/claude-code.ts` | The Claude Code adapter. |
| `src/adapters/codex.ts` | The Codex adapter; `src/adapters/codex/app-server.ts` is its JSON-RPC client for an app-server's Unix socket. |
| `src/adapters/index.ts` | The adapters a project's hub runs with, and their timings from the environment. |
| `mod/cland/` | The cland mod, loaded into every Claude Code session the hub launches (`--plugin-dir`): it submits the hub's messages as turns and reports turn starts and ends. |
| `src/project.ts` | The `.cland/` layout, the managed `.gitignore`, the secret, the discovery file, finding the project root. |
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
| `src/cli/init.ts` | `cland init [dir]`, `cland update [dir]`. |
| `src/cli/doctor.ts` | `cland doctor [dir]` (below). |
| `src/doctor/` | Its checks: `toolchain.ts` (the harnesses, `gh`, Neovim), `project.ts` (the hub, the config files, what `cland init` provisioned), `ranges.ts` (`TESTED_RANGES`, the harness versions each adapter was built against), `report.ts` (the verdicts, the text and the runner). |
| `src/init/provision.ts` | What `cland init` and `cland update` provision, step by step (below); `src/init/` holds one module per managed part: `config.ts` (`config.toml`, also read by the hub), `skills.ts`, `instructions.ts` (`AGENTS.md`, `CLAUDE.md`, `docs/agents/*`), `claude-settings.ts` (the hooks), `files.ts` (write-only-when-changed and the report). |
| `src/roles/config.ts` | `.cland/roles.toml`: parsed (smol-toml), written with the defaults when missing, watched and read again when it changed. |
| `src/roles/default-roles.ts` | The default `roles.toml`: the four roles' clauses, skills, launch defaults, permissions. |
| `src/roles/clause.ts` | The text a holder reads when its clause (or its revocation) is delivered. |
| `src/roles/note.ts` | The handover note: its four sections, read from an object or from Markdown headings, the typed refusal naming what is missing, its rendering. |
| `src/roles/handover.ts` | A role's handover (`role.handover`, the human's `role.set` with a note or `move`): the claims move with the role, the core moves it; the role's state for its holder (`role.state`). |
| `src/roles/permissions.ts` | The permission table: the tools each role may use and how far (scopes), seeded from spec 4.4; `decide`, which the dispatcher asks on every spoke tool call. |
| `src/hub/audit.ts` | The audit record (every tool call, allowed or refused), its argument summary, and reading it back from the hub's log (`cland hub audit`). |
| `src/cli/open.ts` | `cland open [dir]`, and `cland` with no command on a terminal: the project's hub started if none runs, then the workbench (`nvim/bin/cland-nvim`) on the project's root. |
| `src/cli/hook.ts` | `cland hook <event>`, run from inside a launched session by its hooks and the mod; `cland hook bridge`, the mod's connection to the hub. |
| `src/cli/task-import.ts` | `cland task import-github`: reads the issues through `gh` and sends them to the hub in `task.import` frames. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, asks again for the name it was welcomed under, retries a requested name before taking a generated one, stops on a same-session takeover (close code 4002). Acks every delivery and hands each message id to the session once. Fails a request after its deadline, heartbeats while connected and reconnects after two unanswered heartbeats; before the welcome, a hub that does not answer the hello within the request deadline is left and reconnected to. |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send` (into a topic, to the human or to sessions), `topic.create`, `resolve`, `ask`, `who`, `status`, `rename`, `history` (a session's traffic, or a topic's with `topic`), `session.launch`, `role.handover`, `role.state` and the `task.*` tools (`src/spoke/task-tools.ts`); exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `open`, `init`, `update`, `doctor`, `hub …`, `task …`, `session …`, `hook …`, `--version`, `--help`. With no command it opens the workbench when stdin and stdout are a terminal, and prints the help otherwise. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket; puts a fake Claude Code first on a daemon's PATH. The tests touch nothing else. |
| `test/fakes/claude-code/` | The fake Claude Code the adapter is tested against (`claude`, a script; `fake-claude.ts`): `--bg` with the MCP config, the settings hooks and the plugin dir, the real spoke as its MCP server, the real cland mod against a small `$`, `agents --json`, `attach`, `stop`. Like the real one it also runs the project's `.claude/settings.json` hooks and reads `CLAUDE.md` with its `@` imports, else `AGENTS.md`; what a session loaded goes to `jobs/<id>.context.json`. |
| `test/fakes/codex/` | The fake Codex the adapter is tested against (`codex`, a script; `fake-codex.ts`): `app-server --listen unix://…` speaking Codex's JSON-RPC over a WebSocket on the socket, with the real spoke started from the `-c mcp_servers…` overrides; `resume --remote …`, which refuses any `-c`/`--profile`; `--version`. |

The spoke finds its hub through `.cland/hub.json` (`CLAND_HUB_FILE` names it, else the nearest one walking up from its cwd), and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional; on a project's hub `CLAND_ROLE` is only a request (see Roles). `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_HEARTBEAT_MS` and `CLAND_HUB_REQUEST_TIMEOUT_MS` set the timings, for tests. A session an adapter launched sets `CLAND_DELIVERY=adapter`: the spoke then only accepts deliveries and the adapter injects them. Otherwise the spoke delivers into the session as a Claude Code channel notification (a research preview, kept small and isolated in `spoke.ts`). `CLAND_TEST_TASK_WRITE_PAUSE_MS`, read by `cland hub serve`, holds every tracker write still between its temporary file and the rename, so a test can land a hand edit in that window; nothing else sets it. Also for tests only: `CLAND_QUEUE_TTL_MS` shortens the queue TTL (how long a queued message and a remembered name last), and `CLAND_TEST_CRASH_AT=handover-committed` kills the hub right after a handover's transaction committed (`launch-reserved`: right after a launch reserved its role, before the spawn).

The spoke's `session.launch` tool takes `name` and optional `role`, `model`, `harness`, `effort` and `cwd`. `cwd` is an absolute path or a path relative to the project root; omitting it runs the session at the project root. For example, `session.launch {"name":"impl-45","role":"implementer","cwd":".cland/worktrees/T-45"}` launches the Implementer in that worktree. A missing, inaccessible or non-directory path is refused before launch with `{"ok":false,"code":"invalid-cwd","error":"…"}`.

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
- A delivery whose inject reached the harness and got no answer (Codex: a `turn/start` or `turn/steer` sent, its result lost or late) is `uncertain`: the turn may or may not have started. It shows as `delivered`, is logged (`inject-uncertain`) and noted in the inbox (`delivery-uncertain`), and is never sent again on its own (no idle, no reconnect replays it); the human sends it again with `session.retry` or `cland session retry <name> <message id>`.
- Each delivery keeps the session id its addressee had when it was recorded (or when a role's queue was claimed), and an agent's message the session id it was sent from: a grant tied to a delivery (the mention rule) and a reply to a message follow the session, never a name another session may take later.
- A session no adapter launched (a spoke started by hand) has nobody to confirm a turn: its messages stay `delivered`.

## Topics

A topic is a thread in the human's chat with agents (spec 4.5, decision #7): an id, a title, a status, a `standing` flag, at most one bound item, creation and activity times. Every message belongs to one, and the `deliver` frame carries it as `"topic":{"id":…,"title":…,"item":…}` (`item` only when bound; the spoke shows them as `topic`, `topic_title` and `topic_item` on the channel event).

- **General** (`general`) and **Agents** (`agents`) are created at the project's first hub start and are standing: renaming, deleting or closing them is refused. The system creates no other topic.
- **Creation.** The human creates a topic from the UI (`topic.create`), an agent with the `topic.create` tool (the Coordinator any topic, an Implementer only one bound to its own item: the permission table below); a title is required (at most 200 characters). The id is `topic-<n>`. `item` binds the topic to a unit of work: the item must exist and be open, and has one topic at most, so a second `topic.create` for it is refused with the topic it has (`T-1 already has a topic: "…" (topic-1); one topic per unit of work: write there`). The binding is written into the item's file (`topic: topic-1`) through the tracker. A hub with no project has no tracker and refuses a binding; a blank `item` is refused, not taken as none. `task.link --topic` (the CLI's `cland task link`, the `task.link` tool) and `task.create` with a `topic` bind through the same rule: the topic must exist and not be standing, an item already bound elsewhere is refused (`T-1 already has a topic: …`), and so is a topic bound to another item (`topic-2 is already bound to T-1; one item per topic`); the item's file and the topic's `item` change together, and `--topic ""` (null) unbinds both. At start the hub reconciles the bindings with the tracker: a bound item closed while no hub ran (a hand edit, a pull) closes its topic and cancels its asks. A topic with no message yet is listed last (a task's topic appears with its first message).
- **Status** follows the direction of the messages (`src/hub/topics.ts`): a human message makes the topic `waiting for agent`; an agent's message to the human makes it `open` (a topic `waiting for human` stays so: an ask is answered by the human); a message from an agent the human's latest message addressed, to other sessions in the topic, answers that wait too (`open`); any message reopens a `closed` topic to the status its direction implies. `resolve` clears a wait back to `open` and withdraws the topic's open asks: the `resolve` tool (the Coordinator's, by the permission table) and the UI's `topic.resolve`; a closed topic has nothing to clear and is refused. The human closes a topic (`topic.close`), and closing its bound item (`task.close`, `task.edit --state closed`, a hand edit to `state: closed`) closes it; a message reopens the topic, never the item. An `ask` (#33) makes it `waiting for human`, and while any ask in it is open it stays so whatever else is written (below); closing cancels its open asks. Agents keeps `open`.
- **The warning.** While a message in a topic waits for a role nobody holds (a delivery queued under `@coordinator`), the topic carries `"warning":"no coordinator"` (`no reviewer`, … for another role). It clears when a session takes the role (its hello, or the human's `role.set`) and the queued delivery moves to it.
- **Unread.** The human's unread count per topic is the messages from others since the human last read it: the UI sends `topic.read` when the thread is in view, and a message the human writes reads what came before it. It never moves back. The watermark is a message's place in one monotonic sequence the store keeps (`counters.message_seq`, `messages.seq`), never a rowid: retention emptying the table does not make new messages read. The sequence starts above every stored seq and every watermark, so a file an older hub left (watermarks migrated from rowids, its messages pruned) hides no new message. Agents have no unread concept.
- **The human** writes through the UI (`topic.send`), into any topic but Agents: Agents is read-only, a record of what agents send each other, and a `topic.send` there is refused unless it is a reply: with `replyTo` naming an agent's message in Agents, the reply is recorded there and addresses that message's sender, found by the session id it wrote from, so a sender renamed since is still reached (a hub notice has no sender to answer). The message addresses `to` when given, else its mentions: `@coordinator`, `@implementer`, `@reviewer`, `@qa` reach the role's live holders, `@<session-name>` that session (a session the hub knows); with no mention, the Coordinator. `@all` and globs stay text for the human; a mention that names no session and no role is reported as `unknown` and addresses nobody. Each address counts once, with or without its `@`. The addressed party answers with `send` and the topic's id, so the reply lands in the same topic. A party other than the Coordinator may answer the human there (no `to`) while the human's latest message in that topic was delivered to it, by its name or its role (see Permissions); elsewhere it writes to the Coordinator.
- **A role, for the human**, reaches its live holders only: a holder that went offline is not an addressee (it was replaced, or will take the role again on its hello). With no live holder the message is queued under the role, and the first session to take the role (its hello) gets it, also a session that was already addressed by name in the same message (one delivery, one ack). The stage stays `queued` until that session acks. One role may have several holders: all of them are reached. The sender is `human`, a reserved name.
- **A session** writes with `send`: with no `to` the message is for the human, in the given topic or General; with `to` it goes to sessions and is recorded in the given topic or Agents. A role reaches its live holders, or, with none connected, the offline holders the hub remembers (queued for them); a role nobody ever held answers `empty`.

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

`needsYou` is asks + approvals + waiting; notifications never count. Retention never removes an open ask or its message, whatever its age; an answered, withdrawn or cancelled ask goes with its message. Deleting a topic (its asks go with it) and a prune both publish the inbox again. `hub.status` carries it as `needsYou`, so the top bar shows it without computing.

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

A session holds at most one role: Coordinator, Implementer, Reviewer or QA (spec 4.4). On a project's hub the role is the hub's state, not the session's (ADR 0001): the human assigns and revokes it, or a launch for the role grants it. A hub with no project (`createHub` in tests) takes a hello's role as declared and delivers no clause.

### `.cland/roles.toml`

One table per role: `clause` (multi-line text), `skills` (list), `exclusive` (the Coordinator), `[<role>.launch]` with `harness`, `model` and `effort` (`""` is the harness's default) and how the launched session may act (`approval`, `sandbox`, `writable_roots`, `network`: below), and `[<role>.permissions]` `tools`, the permission list the hub enforces (see Permissions below; a role table without `tools` gets the built-in list). A role the file leaves out takes its default; an unknown role or a wrong type makes the file unreadable. The defaults:

| Role | Launch defaults | Approval and sandbox | Skills |
| --- | --- | --- | --- |
| Coordinator (exclusive) | claude-code, `claude-fable-5-1`, effort `max` | none given | wayfinder, to-spec, to-tickets, triage, grilling, code-review, handover |
| Implementer | opencode, a free model the server lists (`""`; pin one, e.g. `opencode/big-pickle`) | `never`; `workspace-write`, `writable_roots = ["."]`, `network = "local"` (applied when it is launched on Codex) | implement, tdd, diagnosing-bugs |
| Reviewer | codex, `gpt-6.1-sol`, effort `high` | `never`; `read-only` | code-review |
| QA | codex, `gpt-6-astra`, effort `high` | `never`; `workspace-write`, `network = "local"` | diagnosing-bugs |

How a launched session may act is read from `[<role>.launch]` at each launch, and again at a relaunch (`session.resume` with `relaunch`). They belong to the role, whatever harness a launch names (the model and effort are the role's harness's only). The Codex adapter applies it (The Codex adapter, below); Claude Code and OpenCode keep their own permission settings and ignore these keys.

| Key | Values | Meaning |
| --- | --- | --- |
| `approval` | `never`, `on-request`, `untrusted`; `""`: the adapter's default, which is `never` too (as with no role) | Whether the session stops to ask the human before a command its sandbox refuses. With `never` nothing waits on the human: the command fails and the session goes on. |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access`; `""`: the harness's own | What the session's commands may write: nothing; the session's cwd and the temp dir; or anything (no sandbox). |
| `writable_roots` | a list of directories, relative to the project root; needs `workspace-write` | More writable directories. One that holds a `.git` directory is writable with it, and with the session's own git directory when that lies there (a worktree's `.git/worktrees/<name>`): this is what lets a session in a worktree commit. |
| `network` | `none`, `local`, `full`; needs a sandbox | `local`: Unix sockets under the project's `.cland/`, the session's cwd and the temp dir, and loopback, so `cland` reaches the hub and tests start their own hubs; every other host is refused. `full`: the whole network. |

A key the table leaves out takes the role's built-in value from the table above, key by key, so a `[<role>.launch]` written before these keys existed still launches its role approval-free and sandboxed; only a written value overrides, and `""` asks for none. Inherited roots apply only to `workspace-write`, and `danger-full-access` closes no network. The Coordinator has no built-in values. A wrong value, `writable_roots` with a sandbox that is not `workspace-write`, or `network` or `writable_roots` with `sandbox = ""` makes the file unreadable, as any other mistake in it. `cland role list` shows each role's values. `docs/review-and-qa.md` ("The Codex sandbox") says what each role's sandbox allows, what it cannot, and why.

The hub watches the file (where the folder cannot be watched it polls, and logs `roles-unwatched` once) and reads it again before each launch and assignment when it changed on disk, so the next one uses what the human last saved (`roles-loaded` in the log). A file that does not parse is logged (`roles-unreadable`) and the last good version stays in force.

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
| Coordinator | `send`, `ask`, `resolve`, `topic.create`, `task.create`, `task.edit` (assigning included), `task.close`, `task.claim`, `task.link`, `task.comment`, `session.launch` (and `session.list`), `session.stop`, `session.resume`, `hub.stop` (the last three from its shell: The CLI in a session's shell), `role.handover`, `merge`, `artifact.create`, `rename`, `who`, `history`, `status`, `task.view`, `task.list` |
| Implementer | `send:agents`, `topic.create:own`, `task.claim:own`, `task.comment:own`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| Reviewer, QA | `send:agents`, `task.comment:verdict`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| no role | nothing (such a session is refused at hello; one whose role is revoked while connected is refused every call) |

`ask`, `merge` and `artifact.create` have no frame yet (`role.handover` has, see Handover; `role.state` is no table tool: a spoke reads only its own role's state): a spoke's frame for one is checked like any other, and an allowed one is then answered "unknown request type". `task.import` is the human's (the CLI). The heartbeat (`ping`) and acks are not tool calls. A hub with no project (no `roles.toml`) checks nothing. The UI and the CLI act as the human, whom the table does not restrict, with two limits. A client's hello comes over the Unix socket or stdio only: on a project's hub, one over the spokes' WebSocket is refused (`unauthorized`), so the bearer secret a spoke holds makes no human. A CLI `task.*` call acting as a session the hub knows (`as` carries its `sessionId`, which decides before any name: `cland task` in a launched session's shell always sends `$CLAND_SESSION_ID`, whatever `--as` says; or the human's `--as` names a session that holds or held that name) is that session's call: checked against the role the hub holds for it (never the frame's `role`), audited as it (`client: "cli"`), and its claims held by its session id.

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
| `cland session launch`, `list`, `stop`, `resume` (with `--relaunch` too), `cland hub stop` | Decided by the permission table: `session.launch` (which covers `list`), `session.stop`, `session.resume`, `hub.stop`. The Coordinator has all four by default: it launches the sessions, manages them from its shell and restarts the hub after a merge. The other roles are refused, and from a session's shell `cland hub stop` signals the hub's process only after the hub accepted the request: refused, or unanswered, it exits 1 and signals nothing (the human's fallback to the signal stays). |
| `cland inbox`, `cland role list`, `cland hub status` | Allowed: reading the hub's state. |
| `cland topic answer`, `cland role set`, `cland role clear`, `cland session attach` and `retry`, `cland hub unmute`, and any other frame (the UI's `topic.send`, `inbox.dismiss`, …) | The human's alone: refused. |

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

`cland hub audit [--session <name>] [--since <ISO time | 30s, 15m, 2h, 1d>] [--json]` prints the records, oldest first: one line each (`ts  rev-1 [reviewer]  task.close  item=T-12  forbidden task.close (…)`), or one JSON object per line. `--session human` selects the human's calls.

## The Agents record, the journal and hygiene

**Agents** (spec 4.5, decision #7) is the project's record of what agents do with each other. Every message a session sends to other sessions lands there; one that names another topic is written there and referenced in Agents by an `agent-message` notice (below), its text not repeated. So does every lifecycle event, as a hub notice: a message `from` `hub`, `fromKind` `hub`, addressing nobody, with a `kind` and its facts in `detail`.

| `kind` | When |
| --- | --- |
| `session-start` | A session was launched (`session-launched`), or re-found after a hub restart (`session-resumed`). |
| `session-stop`, `session-death` | It was stopped through cland; its harness process died (`harness-exited`). |
| `role-assign`, `role-revoke` | The human assigned a role (`(was …)` when it replaced another), a launch granted one at the first hello; the human revoked it, or its session stopped or died. A handover (`role.handover`, #31) is its own `handover` notice (with the note) followed by a `role-assign` for the new holder. |
| `claim`, `release` | A session claimed an item (`taken over from …` when forced); a claim was released, by its holder, by another, or because the item closed. |
| `handover` | A role was handed over (#31): who moved it, to whom, and the note. |
| `mute`, `unmute` | The loop breaker muted a pair; a person lifted the mute. These two are delivered to both sessions of the pair as well. |
| `refusal` | A tool call refused by the permission table (#30). |
| `agent-message` | A session's message to other sessions written into another topic: `alpha [Implementer] → beta in "Review of T-1" (topic-3): message <id>`, `detail` `{from, to, topic, message}`. |

`src/hub/agents-topic.ts` maps the domain events to the notices, as they are logged; the mute, the unmute, #30's refusals and #31's handover call `HubCore.noticeInTopic(topic, { kind, text, to?, detail? })`, the one path into the record. Tool-level noise never enters: commands, outputs, hook signals, state changes, acks and injections are journalled, not recorded in Agents. A lifecycle notice is recorded just after its event's own write; the event's journal line carries the notice's id (`agentsNotice`), and at start the daemon records, under that id, every journalled notice after the newest one recorded: the checkpoint `hub.db` keeps apart from the messages (`meta`, written with each journalled notice, never pruned), else the newest one Agents still holds. A hub that died between the two loses none, none is recorded twice, and notices retention removed never come back. (A `hub.db` from before the checkpoint whose notices were all pruned replays its journal once.)

**The journal** (spec 4.2, decision #13) is `.cland/journal.jsonl`: one JSON object per line, `{"ts":"<ISO>","event":"<event>",…}`, the hub log's own shape. It is a filter over the log closure every part of the hub logs through, so an event is journalled by being logged. It holds the domain events: `hub-started` and `hub-stopped` (written by the daemon at each start and clean stop), `config-loaded`; messages as metadata (`send`, `send-refused`, `human-send`: id, topic, sender, addressees, `bytes`, `replyTo`, outcomes; never the text); deliveries (`acked`, `injected`, `dropped`, `role-queue-claimed`); sessions (`hello`, `bye`, `rename`, `replaced`, `kick`, `refused-role`, `session-launched`, `session-stopped`, `session-resumed`, `harness-exited`, `session-state`); roles (`role-assigned`, `role-cleared`, `role-clause`, `role-revoked`, `role-handover`, `coordinator-vacant`, `coordinator-filled`); topics (`topic-created`, `topic-status`); asks and the inbox (`ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`, `notification`, #33); the tracker (`task-written`, `task-claimed`, `task-released`, `task-conflict`, `task-removed`); hygiene (`loop-breaker`, `unmuted`, `rate-limited`); and the audit records (`audit`, #30). The file is opened for appending: a restart adds a `hub-started` line after the last one and never truncates. A last line cut off mid-write (a crash) is ended with a newline before anything else is written, so it stays one unreadable line and every later record parses; a short write is continued until the whole record is out. `Journal.write(record)` appends a record that is not a log line. The process log, everything the hub says, stays in `.cland/log/hub.log`.

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
| `.cland/roles.toml` | yes | Written with the defaults when missing, then the human's: never rewritten (`roles.toml` above). |
| `.cland/tasks/.gitkeep` | yes | A mark line. |
| `.cland/hub.db` | no | The General and Agents topics, created through the store as the hub would at its first start. |
| `.agents/skills/<name>/` | yes | The skills cland ships: every skill of cland's own `.agents/skills/` (the vendored set with cland's patches, `skills/README.md`), read relative to the cland package. `.agents/skills/.cland-manifest.json` (with the mark) lists each skill's files: `update` rewrites those, removes what a newer cland no longer ships, and leaves other files in the folder alone. A skill folder of the same name that the manifest does not list is the project's: cland's is not installed. Ownership is per file: a file the manifest does not list, present where a newer cland ships one, is the human's: `kept` with a `conflict:` note, not adopted (remove it to take cland's). The manifest is validated before anything is touched: the mark in its `managed` field, skill names `[a-z0-9-]+`, relative paths with no `.`, `..` or empty segment, inside `.agents/skills/<name>/`; an invalid one is reported as `kept` and no skill is installed, updated or removed. |
| `.claude/skills` | yes | A relative symlink to `../.agents/skills`. When the project already has a `.claude/skills/` folder it is kept, and gets one symlink per cland skill (`../../.agents/skills/<name>`) beside the project's own. |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | yes | `skills/templates/docs/agents/*` with a first line `<!-- managed by cland <version>: … -->`. An existing file without it is kept and reported. |
| `AGENTS.md` | yes | A block between `<!-- cland:begin managed by cland <version> … -->` and `<!-- cland:end -->` (`skills/templates/AGENTS.block.md`): obey hub events, tasks through `cland task`, artifacts through the hub, sub-agents never use the hub, pushes to GitHub only on the Coordinator's decision. Rewritten in place; appended to a file without it; the whole file when there is none. Text outside the block is never touched. |
| `CLAUDE.md` | yes | Never created (its presence stops Claude Code from reading `AGENTS.md`). An existing one gets `@AGENTS.md` under a mark comment, unless it imports `AGENTS.md` already. |
| `.claude/settings.json` | yes | The cland hooks merged in: one entry per event of the Claude Code adapter (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, `PermissionRequest`, `PostToolUse`, `Notification`, `Elicitation`, `SessionEnd`), `async`, after the project's own. Their command is `[ -n "$CLAND_SESSION_NAME" ] \|\| ! command -v cland >/dev/null 2>&1 \|\| cland hook <event> # managed by cland <version>`: `cland` from the PATH, no machine path, the mark as a shell comment by which `update` finds and replaces them. Every other hook and setting is kept, in its order; a file whose content does not change keeps its formatting byte for byte. A file that is not valid JSON is kept and reported. |

The project hooks are for a Claude Code session started by hand, and do nothing where `cland` is not on the PATH. A session the hub launches already gets the same hooks, naming its session and hub file, through `--settings`, plus the cland mod (`--plugin-dir`) and the spoke (`--mcp-config`); there `CLAND_SESSION_NAME` is set and the project hooks stand aside. The mod is therefore not provisioned into the project: it needs the session's identity, which only a launch has, and its path would be a machine path. Committed files never hold a machine path or the secret.

Not provisioned yet: the territory (remotes, the bare repository, `dev`) is slice 2's.

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
| `config.toml` | yes | Written by `cland init`: `[project] name` and the `[hygiene]` thresholds (`rate_limit_max`, `rate_limit_window_minutes`, `loop_breaker_max`, `loop_breaker_window_minutes`, `loop_breaker_mute_minutes`, `max_text_bytes`), and `[inbox] idle_minutes` (the inbox's idle threshold, #33). The hub reads it at start (`config-loaded` in its log); missing or unreadable, the built-in defaults apply. |
| `tasks/.gitkeep` | yes | Written by `cland init`, so `tasks/` is committed before the first item. |
| `hub.db` (+ `-wal`, `-shm`) | no | The SQLite store: sessions, messages, deliveries, hygiene counters and mutes; the tracker's index and claims. |
| `secret` | no | 32 random bytes as hex, mode 0600. Kept across restarts, so spokes holding it reconnect. |
| `hub.lock` | no | The hub lock, mode 0600: `{"pid":…,"started":"<ps lstart>"}` of the one hub serving the project, from before it prepares anything until it has shut down. |
| `hub.json` | no | The discovery file, mode 0600, present only while a hub runs. |
| `hub.sock` | no | The Unix socket for the UI and the CLI. |
| `log/hub.log` | no | The background hub's stdout and stderr: the process log. |
| `run/` | no | The Codex adapter's app-server sockets (`cx-<id>.sock`), while its sessions run. |
| `journal.jsonl` | no | The journal (above): the domain events and the audit records, JSON lines, append-only across restarts. |
| `artifacts/`, `worktrees/`, `territory.git/` | no | Ignored ahead of the tickets that write them. |

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
- `TopicMessage` is the stored message, `{"id","from","fromKind","fromRole"?,"via","to","text","ts","replyTo"?,"answerTo"?,"topic","stage"?,"kind"?,"detail"?,"ask"?}`, where `stage` is present when the message had addressees, `kind` and `detail` on a hub notice (the Agents record, above), `answerTo` on the human's answer to an ask, `ask` (`AskCard`) on an ask.

Events, pushed after `subscribe`:

```json
{"type":"message","topic":{"id":"general","title":"General"},"message":{"id":"…","from":"coord","fromKind":"agent","fromRole":"coordinator","text":"…","ts":"…","topic":"general",…}}
{"type":"delivery","topic":"general","message":"<message id>","stage":"delivered"}
{"type":"topic","topic":{"id":"topic-1","title":"…","status":"waiting for agent","item":"T-12","unread":0,"warning":"no coordinator",…}}
{"type":"session.state","session":"coord","sessionId":"…","state":"busy","source":"hook","ts":"…"}
{"type":"task","id":"T-12","item":{"id":"T-12","title":"…","state":"open",…,"claim":{"session":"impl-1",…},"verdicts":[…]}}
```

The role frames (`role.set`, `role.clear`, `role.list`) and events (`session.role`, `role.vacant`, `role.filled`) are under Roles above.

A `message` event comes for every message recorded in a topic, the human's own included, before the `topic.send` result. A `topic` event comes when a topic is created or its status, warning, binding or title changes, and after a `topic.read` (its unread count); a new message alone moves the count without one (the UI counts `message` events). A `delivery` event comes whenever a message's stage changes after the send: an ack, an injection, a delivery dropped past the TTL when its session comes back, or a role's queue merged into a session that already had the message. A `session.state` event comes when a session's state changes (below). A `task` event comes on every change to the tracker's index: a hub write, a hand edit the watcher read, a claim taken or released, and a removed file (`item` null); `item` is the item as `task.list` shows it.

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
| `stop(process)`, `resume(process, {relaunch})` | Stop through the harness; a stop that cannot confirm the process gone fails and leaves it watched. Re-find a process after a hub restart by the harness's own ids (a pid alone never: it may have been reused), or start it again on its own conversation (`relaunch`). |

The capability table declares the optional capabilities (`history`, `usage`, `setModel`, `approvalRelay`) and each state signal as `reliable`, `heuristic` or `none`. What is `none` is never emulated. `session.list` returns every adapter's table.

### Session state

`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown` (spec 4.2). Only adapters set it; the model's `status` tool sets the status line and never the state. Presence (`who`, `hub.status`) carries it, and subscribed clients get `session.state`. A session no adapter launched is `unknown`, and so is a launched one whose process died or was stopped.

- A push signal (a hook, the mod) carries the time it happened; one older than the last push applied is dropped, so out-of-order hooks never move a session back. For a hook that time is when its `cland hook` process started (the harness fires the event by starting it; the process may take hundreds of milliseconds more to run), for the mod the event's own time. The hub's receipt order is not used: two hook processes started in one order often arrive in the other.
- A signal or a bridge names its launch (`--launch`, the cland session id the launch gave the hooks and the mod). One from an earlier launch under the same name is ignored (`signal-other-launch` in the log) or refused: it never changes the row of the process that replaced it. A signal never revives a row that is not `running`; only resume does.
- A retry asked for while an inject of the same message is still waiting for its confirmation (an `idle`, a bridge that connected) is made when that inject gives up, if the message still waits. A rename takes the session's `delivered` messages along, so their retry and confirmation find them. At a launch, the bridges that connected early are registered before the early signals are replayed.
- A polled signal counts only while no push came for `CLAND_PUSH_TRUST_MS` (15 s), or while nothing is known yet.

### The process table

`harness_processes` in `hub.db`: name, harness, role, model, cwd, pid, the harness's handle (Claude Code's background id, Codex's app-server socket), cland's session id (the spoke's `CLAND_SESSION_ID`), the harness's own conversation id where it chose one (Codex: the thread id), start time, the pid's process start time (`ps -o lstart=`, as the hub lock keeps it), and `running` | `exited` | `stopped`. No adapter signals a pid before checking that start time (`processes.ts` `signalProcess`): a pid reused by an unrelated process after a crash or a restart is never signalled (`signal-refused` in the log), and is not taken for the session when resuming. At its start the hub resumes every `running` row. A process found alive under its ids is watched again. Otherwise the row turns `exited`, the state `unknown`, and the log gets `harness-exited`. The watch also catches a process that dies while the hub runs.

### The Claude Code adapter

| | Surface (Claude Code 2.1.294) |
| --- | --- |
| spawn | `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <json> --settings <json> --plugin-dir hub/mod/cland`, in the session's cwd. The MCP config starts `bin/cland-spoke.ts` with `CLAND_HUB_FILE`, `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`, `CLAND_DELIVERY=adapter`. The settings add the hooks below (all `async`) and an `env` the mod reads (`CLAND_SESSION_NAME`, `CLAND_HUB_FILE`, `CLAND_NODE`, `CLAND_CLI`). No secret goes on a command line: everything finds the hub through `hub.json`. `--bg` takes `--session-id` but picks its own id (its prefix is the background id); the hub records it as `harnessSessionId`. The workspace must be trusted once (`claude` in it, accept the prompt), or `--bg` refuses. |
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
| inject | Idle: `turn/start {threadId, input: [], toolOutput: {name: "hub_event", namespace: "cland", output: <envelope>}}`. During a turn: `turn/steer {threadId, expectedTurnId, input}` with the envelope as text. The JSON-RPC result confirms `injected`; an error answer, or a connection that was not there to send on (or whose write of the request failed), leaves the message `delivered` for the next `idle` or the next reconnect. A request that went out and got no answer within `CLAND_INJECT_TIMEOUT_MS`, or whose connection closed, failed or brought a frame that is not JSON before its answer, is ambiguous (the turn may have started): the delivery is `uncertain`, never replayed on its own. A steer the app-server refuses because the turn just ended falls back to `turn/start`. A lost connection to a live app-server is reopened at the next poll and what waits for an inject is retried then. |
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
| `{"type":"session.launch","id":…,"name":…,"role"?,"model"?,"harness"?,"effort"?,"cwd"?}` | `{"process":HarnessProcess}`; a role's launch defaults fill the rest | UI, CLI, spokes whose role grants `session.launch` (the Coordinator) |
| `{"type":"session.list","id":…}` | `{"processes":[HarnessProcess…],"adapters":{"claude-code":Capabilities,"opencode":Capabilities,"codex":Capabilities},"coordinator"}` | UI, CLI, spokes whose role grants `session.launch` |
| `{"type":"session.attach","id":…,"session":…}` | `{"command":"claude attach 1a2b3c4d"}` | UI, CLI |
| `{"type":"session.stop","id":…,"session":…}` | `{"process":…}` | UI, CLI |
| `{"type":"session.resume","id":…,"session":…,"relaunch"?:true}` | `{"found","reason"?,"process"}` | UI, CLI |
| `{"type":"session.retry","id":…,"session":…,"message":"<message id>"}` | `{"retried":true}`; refused unless that delivery is `uncertain` | UI, CLI |
| `{"type":"session.signal","id":…,"session":…,"launch"?:…,"event":…,"at":…,"payload":{…}}` | `{"applied","state"?}` | `cland hook` |
| `{"type":"session.bridge","id":…,"session":…,"launch"?:…}` | `{"bridged":true}`, then `{"type":"inject","session","message","text"}` frames | `cland hook bridge` |

`HarnessProcess` is `{"name","harness","role","label","model","cwd","pid","harnessId","sessionId","harnessSessionId","startedAt","status","state","attach","usage"?}`; `hub.status` lists them as `harnesses`.

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
| `cland session launch <name> [--role r] [--model m] [--harness claude-code\|opencode\|codex] [--effort e] [--cwd dir]` | Launches a session through the hub; with `--role`, the role's launch defaults fill what is not given. |
| `cland session list` / `attach <name>` / `stop <name>` / `resume <name> [--relaunch]` / `retry <name> <message id>` | As the frames above. |
| `cland hook <event> --session <name> [--launch <id>] --hub-file <path>` | Posts one signal, stamped with the process's start time (or the payload's `at`), with the harness's JSON payload from stdin. Only the fields the hub reads are kept, and a prompt is reduced to the message ids it carries. Always exits 0: a hook never fails the harness. |
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
commit: 0123456789abcdef0123456789abcdef01234567

Looks right.
```

A comment is headed `### <author> · <ISO time>`; one whose first lines are `verdict:` (`review` | `qa`), `result:` (`clear` | `not clear`), `by:` (`<session> [<role>]`) and `run:` is a verdict. Its optional `commit:` pins the Git commit covered by that run; older verdicts without it still parse.

- **Writes** go through the hub and are serialized: each runs read–change–write–index synchronously, the file replaced atomically. Nothing is committed.
- **Hand edits** are picked up by a watcher on the folder (debounced 100 ms) and re-indexed, about 120 ms after the write as the hub log's `task-reindexed` stamps it (the test asserts under a second on that stamp; a `cland task list` poll adds its own process start-up, seconds on a loaded machine); a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), or a hand edit landing while the hub writes the item (between its read and its rename: the file is checked just before the rename and the replaced file just after; the hand edit is overwritten), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **Verdict commits and provenance.** `task.comment` accepts `verdict.commit` on the wire, `commit` on the spoke tool, or `--commit <sha>` on the CLI. An explicit SHA must resolve to a commit and is written in full; without it, the hub records the tip of the item's local `branch`, if it resolves. The result includes `commit: {sha, source: "explicit" | "branch" | "none", note}` and the plain CLI prints the note, including when no commit could be recorded. Text verdict headers accept `commit:` too.
- **Durable verdict evidence.** `tracker_written_verdicts` holds item, kind, result, run, commit, writer session id, role at write time and comment time, plus a fingerprint of the exact comment. This table is never rebuilt from item files. The separate file index gains `commit_sha` and `comment_key` with additive migrations. `task.view` and `task.list` give every verdict `source: "hub" | "file"`; a hub verdict also carries `writer: {sessionId, role}` from the stored evidence, never from `by:`. An unrelated hand edit preserves it; changing the verdict or its comment removes the match. Imported and hand-written verdicts have `file` provenance, even if their `by:` claims a Reviewer.
- **Freshness.** The latest verdict of each kind in file order carries `current: true | false` on view and list. It is current when its commit is the branch tip, or the whole diff from its own merge base has the same `git patch-id --stable` as the tip's diff from its own merge base. The base is `dev` when present, else `main`; `verdictBase` says which was used (null if neither exists). Missing or unresolvable commits/branches are stale; unavailable Git facts never establish patch equivalence. Earlier verdicts omit `current`. The Neovim item view and plain CLI show the short commit, current/stale and from the hub/file; Neovim marks stale red. This evidence prepares the merge gate; recording a verdict alone does not enforce that gate.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. A claim is held by the claimer's identity, not its name: a spoke's session id (a rename keeps the claim; another session taking the old name gets none of it), or `human` / `cli:<name>` for the CLI, which is never a session. `view` shows the holder's name (`session`) beside its identity (`sessionId`); the holder claiming again refreshes the name. Another holder's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set) it always acts as that session and sends its `$CLAND_SESSION_ID`: `--as` (the human's name, another session's, the Coordinator's) cannot change that, and a different `--as` only earns a note on stderr. Outside a session it acts as `--as <name> [--role r]`, else `human`. On the wire a frame's session id decides before its name: a frame carrying one is that session's call even when it names `human`. What stays open: a shell that unsets both variables is the human's, as any process holding the hub's socket is (the CLI's identity is its environment). Acting as a session the hub knows (by that id, or a name a session holds or held), the call is that session's: checked against the role the hub holds for it, audited as it, its claims held by its session id (Roles, Permissions); the frame's `--role` is then ignored. A name no session ever had is a CLI actor (`cli:<name>`), unrestricted as the human is. The hub refuses a name outside the session-name grammar (`[a-z0-9][a-z0-9-]{0,23}`, not reserved) and a role that is not one of the four role names: both are written into item files.

| Command | Tool | What it does |
| --- | --- | --- |
| `cland task create <title> [--kind] [--body \| --body-file] [--label]… [--assignee] [--parent] [--blocked-by]… [--topic] [--branch]` | `task.create` | Writes a new item file. |
| `cland task view <id>` | `task.view` | Frontmatter, body, comments, verdicts and the claim. |
| `cland task list [--state] [--label]… [--kind] [--assignee] [--verdict review=clear]` | `task.list` | Queries the index. Each item carries its claim and its verdicts in file order (the latest last). |
| `cland task comment <id> <text> [--verdict review\|qa --result clear\|"not clear" --run <id> [--commit <sha>]]` | `task.comment` | Appends a comment, or a verdict. |
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

### `cland` on the PATH

The project hooks `cland init` writes into `.claude/settings.json` call `cland` from the PATH, and do nothing when it is not there (a Claude Code session the hub launches does not need it: its hooks name the CLI by path). To run them for a session started by hand, and to type `cland` instead of `node hub/bin/cland.ts`, put the CLI on the PATH once, from the repository root, with either:

```sh
npm link                                              # links the package's `cland` bin into npm's global bin folder
ln -s "$PWD/hub/bin/cland.ts" ~/.local/bin/cland      # or a symlink into any folder on the PATH
```

Both point at this checkout, so `git pull` updates the command; `npm unlink -g cland` or `rm ~/.local/bin/cland` removes it. Node resolves the CLI's imports from the link's target, so either works from any directory.
