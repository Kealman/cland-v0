## The project's hub

Run from a project's root, or anywhere inside it. A linked Git worktree resolves to the main worktree's root through its `.git` file and Git's common directory, including worktrees outside the project folder. Its copied `.cland/` without `hub.json` does not hide the main project's hub. Otherwise the CLI uses the nearest ancestor holding `.git` or `.cland/`, else the current directory.

Commands contacting an existing hub (`hub status`, `hub stop`, `hub unmute`, `task`, `session`, `role`, `inbox`, `topic create`, `topic answer`, `hook`) read `CLAND_HUB_FILE` when set, from any current directory; otherwise they read the resolved project's `.cland/hub.json`. `hub start` and `hub serve` start the resolved project's own hub. `init`, `update` and `doctor` resolve the project from the cwd too, unless an explicit directory is given. Tracker writes go through the selected hub into its root's `.cland/tasks`, which is the main worktree's `.cland/tasks` for a linked worktree; the worktree's copy is never written by these commands.

Before starting the hub, `cland open` prints `next: cland setup` once on stderr
when the project is initialized but not set up, then opens the workbench as usual
and returns the launcher's exit code. `projectSetUp(root)` and `CHOSEN`, exported
from `src/roles/editor.ts`, define setup's mark: the trailing comment
`# the human's favourite, chosen in cland setup` on `[aide.launch]`'s `harness`
line in `.cland/roles.toml`. Setup writes that comment with the human's choice;
the default roles remain unmarked. A missing, unmarked or malformed file counts
as not set up; malformed roles do not block open, and the hub reports them as usual.

| Command | What it does |
| --- | --- |
| `cland` / `cland open [dir] [nvim args…]` | Requires a project with `.cland/`; otherwise prints `not a cland project: run cland init` to stderr and exits 1 without starting a hub or writing anything. HOME is never a project, including when it holds legacy `~/.cland/` state. Applies the check to `dir` when supplied. Runs `cland hub start` (quietly; its output is shown only when it fails), then the Neovim workbench on the project's root, from any directory inside the project, and exits with its status. `CLAND_LAUNCHER` names another launcher. The workbench is described in `nvim/README.md`. |
| `cland --headless --qa <case.lua> [--out <dir>] [--hub stdio\|stub] [--timeout <seconds>]` | Runs one QA case in a headless workbench with no socket, against a fixture project in the temp dir and its own stdio hub (`hub serve --stdio --no-listen`) or the stub hub; one JSON line, exit 0 (`PASS`), 1 (`FAIL`) or 2 (`INCONCLUSIVE`, `BLOCKED`). The case file and the Lua QA API are described in `nvim/README.md`. |
| `cland hub start` | Starts `cland hub serve` detached, waits until it answers, prints its pid, port and socket. `--autostart` honors the deliberate-stop grace period (Neovim uses it); an explicit start bypasses and clears it. `--client cli\|nvim\|other` identifies the starter (default `cli`). The `hub-started` journal record includes `starter: {client, parentPid, cwd}` from the initiating CLI invocation, before it detaches: its parent's PID and its original cwd, never its environment. A live hub is reported instead of started twice, also when two starts race: the hub that takes the project's lock serves, the other serve exits, and both commands report the one hub. A `hub.json` whose pid is gone, or is a process that does not hold the lock, is replaced. |
| `cland hub status` | Asks the hub over its socket: pid, port, socket, uptime, version, connected sessions with their roles. `--json` prints compact status. `--history` explicitly includes full suite/cover history and duplicated harness rows. Exit 1 when no hub runs. |
| `cland hub stop` | An accepted stop writes `.cland/run/hub-stop.json` before closing connections, then refreshes its ten-second grace period on shutdown. Autostart checks it again inside the startup lock; expired markers do not delay recovery. A crash writes no marker. Asks the hub to stop over its socket and waits up to ten seconds for the process to exit. If that process held the lock before acknowledging stop, then released it but remains alive, reports `stopped, lock released, process still alive` with its pid and exits 1, leaving the process and any successor's files alone. When the socket does not answer it sends SIGTERM, but only to the process holding the project's lock (pid and start time match); a `hub.json` naming any other process is removed and that process left alone. A hub that died without cleaning up has its `hub.json` removed, and its socket file unless another hub holds the lock by now. |
| `cland hub unmute <a> <b>` | Lifts the loop breaker's mute of two sessions (by name) on the running hub, and clears their count; Agents records it. |
| `cland hub journal` | Prints `.cland/journal.jsonl`, oldest first, one record per line (`<ts>  <event>  key=value …`). `--since <ISO date \| 30s \| 10m \| 2h \| 1d>`, `--kind <event>[,<event>…]`, `--json` for the lines as they are. Reads the file: no hub needed. |
| `cland hub serve` | The hub in the foreground, logging JSON lines to stderr. This is what `start` runs. SIGTERM and SIGINT request cleanup and exit after it finishes; if cleanup remains incomplete after two seconds, the process reports the deadline on stderr and exits 1. Repeated signals keep the first deadline. |
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
| `hub.lock` | no | The hub lock, mode 0600: `{pid, started, token, hostIdentity: {hostname, bootId, pidNamespace}, heartbeat}` of the one hub serving the project, from before it prepares anything until it has shut down. |
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

### Background work

<!-- cland-allow-closed-wording: until afterwards describes startup scheduling, not pending items -->
Declare whether startup work is needed for the first protocol reply; defer history scans and maintenance until afterwards and keep them off stage and merge-gate paths. Native background commands check cancellation before each launch, settle teardown after child close/reap and record abandonment explicitly. Watchdogs distinguish byte progress from liveness and preserve valid late replies; maintenance sleeps until its next eligibility deadline (A-8634 R6; T-1008, T-1039, T-1060, T-1062, T-1050, T-1067; A-9063 R8 source T-1084).

Startup indexes and recovers the tracker before serving. Automatic planned-stage
checks wait with readiness checks until the serving receipt; a slow planning write
does not hold the listeners or status replies. Freshness announcements refresh
their source rows and ancestors as a batch before flushing explorer aggregates,
so a tip read does not recompute shared ancestors once per verdict-bearing item.

### The UI's frames

The Neovim workbench places its four panels with `:Cland panel items|inbox|sessions|topics left|right` or the palette's **<Panel> on the left/right** actions. Each panel has a home side, with one visible panel per side; moving a panel closes its old side. Buffer keys and hub events follow the panel. `gm` inside any of the four panels moves it to the other side; the action registry exposes **Move <kind> to the other side** in the palette and Keys. Panel toggles, top-bar chips, `gp` and scoped palette actions use its home side; centre `C-h`/`C-l` focus the panels currently on the left/right. Neovim's `CTRL-W H/L/r/x` remain native and are not panel placement controls. Optional `panel_homes` and `panels.left_kind` in version-2 `.cland/ui.json` save homes and occupants, including Items on the right; the restart snapshot carries them too. Older files keep default sides; invalid assignments fall back with one amber notice while retaining other preferences. Presets retain homes. Manual widths are per side (`sizes.left`/`sizes.right`) and follow the side through panel moves, view/preset changes and restarts. The Topics dock (`␣T`) stacks above whichever panel is on the right, appears only once and keeps `sizes.dock`; the explorer card can temporarily replace any right occupant without changing its home or visibility preference. `:Cland panel reset` and **Reset panel layout** restore default homes and side widths and save immediately, keeping the dock height and open panels. Panels move to default sides when possible; if both target the same side, both stay in place and subsequent toggles follow default homes. The default layout and wire frames are unchanged. See [Panels](../../nvim/README.md#the-shell) for the client commands.

The Neovim workbench starts its independent list snapshots on connection and installs each answer as it
arrives; item loading cannot hold back the session count or Coordinator header. Live events keep the
installed state current. Reconnect reads new baselines once. A missing snapshot alone retries after
30 seconds with exponential backoff capped at five minutes, retaining its original late reply and newest
attempt; whichever answers first completes it and cancels the others. Answered lists are never retried
by that timer. Each attempt has a bounded event journal; overflow invalidates that attempt before a new
read. See `nvim/README.md`, “Hub data” and snapshot replay, for the client contract.

| Request | Result `value` |
| --- | --- |
| `{"type":"hub.status","id":…}` | Hub state, including `keys: {layouts}` for keyboard layouts and `tracker: {levels, ladder}` for loaded container levels, ordered top-down. `ladder` is the nested array of all kinds at each level; `levels` keeps only each level's first kind for older clients. The UI reads the current values on connect/refresh; no config push event is added. Missing/unreadable config reports the levels in use by the running tracker. |
| `{"type":"topic.list","id":…}` | `{"topics":[Topic…]}`, standing topics first, then those waiting for the human, then by latest activity; a topic with no message last |
| `{"type":"session.history","id":…, "session":"impl-12","limit":50,"before":123}` | `{messages: (Message & {seq:number})[], more:boolean, before?:number}`; human clients on Unix or web, sent and received traffic across topics, newest last |
| `{"type":"topic.history","id":…,"topic":"general","limit":50,"after":0}` | `{"topic":Topic,"messages":[TopicMessage…],"runs":[ThreadRun…],"more"?:true,"before"?:messageId,"after"?:seq}`, oldest first, at most 200 and byte-capped (see Startup replies) |
| `{"type":"topic.withdraw","id":…, "topic":"general","message":"<message id>"}` | `{text, message:TopicMessage}`; human-only, before adapter submission; emits `withdrawn` |
| `{"type":"topic.send","id":…,"topic":"general","text":"…","to":["…"],"replyTo":"<message id>","kind":"question"}` | `{"message":TopicMessage,"outcomes":[…]}`; `to` is optional (the mentions in the text, else the Coordinator); in Agents only a reply is accepted, and it addresses the sender of `replyTo` |
| `{"type":"topic.create","id":…,"title":"…","item":"T-12"}` | `{"topic":Topic}`; `item` is optional; refused without a title, or for an item that has a topic |
| `{"type":"topic.close","id":…,"topic":…}` | `{"topic":Topic}`, `closed`; refused for General and Agents |
| `{"type":"topic.resolve","id":…,"topic":…}` | `{"topic":Topic}`, `open`; refused for a closed topic and for Agents |
| `{"type":"topic.read","id":…,"topic":…,"upTo":"<message id>"}` | `{"topic":Topic}` with its `unread`; without `upTo`, up to the latest message |
| `{"type":"topic.rename","id":…,"topic":…,"title":…}` | `{"topic":Topic}`; refused for General and Agents |
| `{"type":"topic.delete","id":…,"topic":…}` | `{"deleted":id}`; refused for General and Agents |
| `{"type":"topic.answer","id":…,"ask":…,"option"?:n,"text"?:…,"declined"?:true,"reason"?:…}`, `inbox.list`, `inbox.decline`, `inbox.read` | Under Asks and the inbox above |
| `{"type":"events.list","id":…, "before"?:"<cursor>", "limit"?:200, "filter"?:{kinds?, warnings?, subject?, muted?}}` | `{rows: EventRow[], before: string|null, more: boolean}`; newest first, at most 200, with an exclusive cursor for the next older page |
| `{"type":"subscribe","id":…}` | `{"subscribed":true}`; events follow on this connection until it closes |
| `{"type":"hygiene.unmute","id":…,"a":"<session>","b":"<session>"}` | `{"lifted":bool,"pair":[a,b]}`: the loop breaker's mute of the pair lifted (false when none ran); refused for a name the hub never knew |

- `Topic` is `{"id","title","status","standing","createdAt","updatedAt","item","unread","lastMessageAt","warning"?}`: `status` is `open`, `waiting for human`, `waiting for agent` or `closed`; `item` the bound item or null; `unread` the human's unread count; `warning` (`no coordinator`) only while a message waits for a role nobody holds.
- A recorded verdict posts a `message` frame with `message.kind: "report"` in its bound item topic (Agents if unbound). Its `message.criteria`, when marks were requested, is `[{ "id": "C1", "mark": "verified" }, { "id": "C2", "mark": "failed", "note": "what failed" }]`: each mark is `verified` or `failed`, and failures carry a note. The text lists the same ids; render the structured field directly, with nothing extra when absent. The field persists in topic history across restart.
- `TopicMessage` is the stored message, `{"id","from","fromKind","fromRole"?,"via","to","text","ts","replyTo"?,"answerTo"?,"topic","stage"?,"kind"?,"detail"?,"ask"?,"criteria"?}`, where `stage` is present when the message had addressees, `kind` and `detail` on a hub notice (the Agents record, above), `answerTo` on the human's answer to an ask, `ask` (`AskCard`) on an ask.

### Events view

`events.list` reads `.cland/journal.jsonl` backwards in 32 KiB blocks, retaining the selected page, coalescing-window metadata and the partial record at a block boundary. It reads far enough to finish the selected equal-event groups; sparse filters and dense bursts can require more blocks. `limit` is a positive integer, defaults to 200 and is capped at 200. Pass the returned `before` unchanged for the next page; new appends cannot repeat or skip rows behind that cursor. Cursors are opaque: when interleaved equal-event groups cross a page boundary, the continuation carries the byte position and group exclusions. `more` says whether another usable row remains. Invalid cursors are refused; malformed records are skipped. The frame waits for accepted journal appends before reading.

An `EventRow` is `{id, ts, kind, subject: {kind, id}, glyph, text, item?, session?, topic?, artifact?, bookkeeping?, warning?, count?, firstTs?, replaces?}`. The ten event kinds are session, task, verdict, suite, release, artifact, usage, topic, heartbeat and rule; a subject is an item, session, topic, artifact or rule (its number as a string). Navigation references are present where known. A subscribed UI receives each new row as `{"type":"event","row":EventRow}` through the existing log tap, with the same newest-event id and classification as the page. A coalesced live row carries `replaces` naming the prior row id; clients replace that row rather than prepending a duplicate. Announced events are journaled once with their text and subject even without session subscribers. Suite result records include their branch, item, outcome and counts; notification journal records retain their subject and verdict result.

Bookkeeping launches, resumes, stops, claims, status moves, criterion marks and topic closes carry `bookkeeping: true`. Not-clear verdicts, deaths, configured promotions to now and failed suites on `dev` carry `warning: true` and `glyph: "⚠"`; a failed task-branch suite is ordinary. Heartbeat firings retain separate rows. Other equal kind/subject/text events whose consecutive occurrences are within 60 seconds coalesce, even when other events interleave. `count` is their multiplicity and `firstTs` the oldest occurrence; the row's timestamp and id are the newest occurrence. Coalescing crosses page boundaries without repeats. Startup restores recent coalesced groups from the journal tail before announcements begin, including groups beyond the first page, so a first equal event after restart replaces the restored row. Optional restoration failures are logged; the journal retains its error and the normal stop path still rejects while releasing the project lock. Pending inbox approval notices and waiting-topic events are omitted; asks, requests and messages are not translated into event rows. Follow-up events such as plan approval can appear.

`filter` accepts `kinds` (any of the ten kinds), `warnings: true`, `subject: {kind, id}` and `muted: [{kind, id}]`. A subject is an item (with descendants), session, topic, artifact or rule; navigation references also match subject filters. The cap applies to matching, coalesced rows. These mutes affect only the response; they do not write the hub's visibility preferences. Neovim keeps `events.filter` and `events.muted` in `.cland/ui.json`; the browser keeps its filters and day folds in local storage. Both use the human's shared hub `marks.events` last look. The browser's Inbox events line follows unfiltered older pages to that mark, independently of needsYou and the selected filter.

Usable historical launch, stop, death, handover, claim, merge, topic, release and notification records are translated too. Older periods may lack suite and artifact rows: there is no backfill from `hub.db`. Usage events currently require a subscription threshold crossing; no default threshold is added, so that kind may be empty.

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

`rule.list {all:true}` supplies the complete rulebook. After every successful rule write or valid file reload, subscribed workbenches receive `{type:"rules.changed", rules:Rule[]}` with that complete list, including retired rules. A workbench (`nvim` or `ui`) writes as the human with `rule.add`, `rule.edit` and `rule.retire`; the hub assigns origin `workbench` itself. Invalid file reloads retain the last good list and emit no replacement. Clients replay changes received while `rule.list` was pending after installing its snapshot.

The role frames (`role.set`, `role.clear`, `role.list`) and events (`session.role`, `role.vacant`, `role.filled`) are under Roles above.

A `message` event comes for every message recorded in a topic, the human's own included, before the `topic.send` result. A `topic` event comes when a topic is created or its status, warning, binding or title changes, and after a `topic.read` (its unread count); a new message alone moves the count without one (the UI counts `message` events). A `delivery` event comes whenever a message's stage changes after the send: an ack, an injection, a human withdrawal, a delivery dropped past the TTL when its session comes back, or a role's queue merged into a session that already had the message. A `session.state` event comes when a session's state changes (below). `presence` replaces the connected-session list on a hello, the last spoke leaving, a rename, a status or role change. `session.process` replaces a process-table row on launch, resume, exit, stop, rename, model, role or pid changes; it has exactly the view `session.list` returns, including a null attach command after exit. Replace a row by its stable `sessionId` or its name, so a rename removes the old name and a relaunch replaces the old launch. `session.usage` carries the latest adapter totals for one launch: reports within each 1 s window are coalesced into one trailing snapshot, independently per session. Match its `sessionId`, never just the reused name. A pending usage update is cancelled at hub shutdown. `session.cleanup` identifies a failed launch by `sessionId` and reports `pending stop` or `settled`; clients remove only that identity from their accepted-process view, including during snapshot replay. The workbench reads `session.list` and `hub.status` on connect and after its own launch or stop; these events keep it current between reads, without a timer. A `task` event comes on every change to the tracker's index: a hub write, a hand edit the watcher read, a claim taken or released, and a removed file (`item` null); `item` is the item as `task.list` shows it, including its resolved `rank`. A successful rank move emits one additional `task` event for the moved item with `siblings`, all ids under the affected parent in rank-then-id order. Other events have no sibling list; clients compare rank, then numeric id. `hub/test/fixtures/rank-order.json` is the shared hub/client ordering example.


<!-- Implementation guidance moved from the implement skill. -->

For remote terminal commands, token rotation or messenger status/test callbacks,
use `docs/agents/tests/hub-test-remote-cli.test.ts.md`; retain lazy CLI imports,
legacy optional callbacks and previous-hub refusal coverage.
For public remote documentation, use `docs/agents/tests/hub-test-remote-docs.test.ts.md`
and `docs/agents/tests/hub-test-remote-docs-pairing.test.ts.md`: keep site-only
dependency isolation, vocabulary checks, executable pairing blocks and README's
built-in Discord and dual-messenger media/history checks in step.
Doctor's `ps` prerequisite uses the injected command probe in
`docs/agents/tests/hub-test-doctor-harness-probe.test.ts.md`; Linux requires
`procps` for the hub lock. Never remove or shadow the machine's `ps` in tests.
For doctor's remote diagnostics, use
`docs/agents/tests/hub-test-doctor-remotes.test.ts.md`: local secret resolution
and Unix status frames only, with the shared General cause/fix table and optional
`stopCause` compatibility. Prove native Telegram stops at the liveness seam;
Discord structured test stops do not claim native transport coverage.

## Hub lock acquisition identity (T-1615)
