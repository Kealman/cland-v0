# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames (protocol 2): `hello`, `welcome`, `error`, request `result`, `deliver` and the spoke's `ack` of it; the heartbeat interval and the frame size limit. The Unix socket's client hello (it carries the secret) and its requests `hub.status`, `hub.stop`. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, messages, per-addressee deliveries (queued → delivered on the spoke's ack, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. The thresholds are constants for now. |
| `src/hub/core.ts` | Presence, names keyed to session ids, same-session takeover, routing, store-and-forward with acks. Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests and acks, client requests (`hub.status`, `hub.stop`), the `task.*` requests from either, refusals. A spoke's frames count only while its socket is open and still holds the session's name. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/server.ts` | The WebSocket edge: bearer secret check, frame size limit, heartbeat sweep. `createHub` starts it with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. Bound under a private name and renamed into place; on close it removes the path only while the path is still the socket it bound. |
| `src/hub/lock.ts` | The project's hub lock, `.cland/hub.lock`: created whole or not at all, holding the holder's pid and process start time; a stale one (pid gone, or reused by a process started at another time) is broken under a guard. |
| `src/hub/daemon.ts` | The hub serving one project in the background: the lock taken first, `.cland/` prepared, store on `hub.db`, both edges bound, `hub.json` written last. Shutdown runs backwards: edges closed, `hub.json` removed, the lock released last. |
| `src/project.ts` | The `.cland/` layout, the managed `.gitignore`, the secret, the discovery file, finding the project root. |
| `src/tracker/item.ts` | The item file format: frontmatter, body, comments, verdicts; parse (lenient for hand edits) and serialize. |
| `src/tracker/index-db.ts` | The tracker's index (items, labels, blockers, verdicts), its id high-water mark and the claims: tables of their own in `hub.db`, through a connection of their own. |
| `src/tracker/tracker.ts` | The tracker: writes the item files (serialized, atomic), watches `.cland/tasks/` and re-indexes hand edits, holds claims. |
| `src/tracker/requests.ts` | The `task.*` request frames and their handler, called from the dispatcher for spokes and clients alike. |
| `src/cli/hub.ts` | `cland hub start`, `status`, `stop`, `serve`. |
| `src/cli/task.ts` | `cland task create`, `view`, `list`, `comment`, `edit`, `close`, `link`, `claim`. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, asks again for the name it was welcomed under, retries a requested name before taking a generated one, stops on a same-session takeover (close code 4002). Acks every delivery and hands each message id to the session once. Fails a request after its deadline, heartbeats while connected and reconnects after two unanswered heartbeats. |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send`, `who`, `status`, `rename`, `history` and the `task.*` tools (`src/spoke/task-tools.ts`); exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `hub …`, `task …`, `--version`, `--help`. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket. The tests touch nothing else. |

The spoke finds its hub through the nearest `.cland/hub.json` walking up from its cwd, and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional. `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_HEARTBEAT_MS` and `CLAND_HUB_REQUEST_TIMEOUT_MS` set the timings, for tests. Delivering a message into the session uses Claude Code's channel notification, kept small and isolated in `spoke.ts` until the Claude Code adapter takes it over (#24).

## Identity and delivery

A session's identity is the session id in its hello (`CLAND_SESSION_ID`; a spoke started without one makes up a random id). A name is what others address it by.

- A generated `session-<n>` name is never one the store knows: a session's row, live or offline, or a name any stored message or delivery carries (so a name a session renamed away from stays retired while its traffic is kept). A new session therefore never inherits another session's queued messages, history or status line. History is still looked up by name: a session that explicitly claims a retired name sees that name's traffic.
- A hello with no name from a session the hub already knows gets that session's previous name back, unless another session has claimed it by name since. The spoke also remembers the name it was welcomed under and asks for it on every reconnect, so it keeps it even when the hub lost its store.
- A requested name is a claim. A live holder of another session refuses it; a live holder of the same session is replaced (close code 4002). A status line is inherited only by the same session id.
- Hygiene (rate windows, pair counts, mutes) is keyed by the session id, so a rename moves nothing.

A delivery row is `queued` until the spoke accepts it, then `delivered` (spec 4.2); `injected` comes with the adapters.

- The hub sends `{"type":"deliver","id":"<message id>","message":{…}}`. The spoke answers `{"type":"ack","id":"<message id>"}`, and only that marks the row delivered.
- On each hello the hub sends everything still queued for the session, including messages a previous socket received but never acked. A spoke may therefore see a message twice. It acks both copies and hands the message to the session once.
- A send's outcome `delivered` means the frame went out on an open socket to a live session. A socket that is closing gets `queued`.

## Not here yet

- **The human side.** The Unix socket answers only `hub.status`, `hub.stop` and the `task.*` requests; the UI's protocol comes with #23, and until then a loop-breaker mute is only journalled.
- **Roles as hub state.** A session may declare one of the four role names so `@role` routes; clauses, permissions and handover come with #29–#33.
- **The journal.** Tracker conflicts and re-indexes go to the hub's JSON-lines log until the journal (#34) exists. A claim stays until released, forced or the item is closed; nothing yet releases it when its session ends.
- **Adapters.** Claude Code (#24), Codex (#26) and OpenCode (#27) launch, attach and deliver into sessions.

## The project's hub

Run from a project's root, or anywhere inside it. The project root is the nearest ancestor holding `.git` or `.cland/`, else the current directory.

| Command | What it does |
| --- | --- |
| `cland hub start` | Starts `cland hub serve` detached, waits until it answers, prints its pid, port and socket. A live hub is reported instead of started twice, also when two starts race: the hub that takes the project's lock serves, the other serve exits, and both commands report the one hub. A `hub.json` whose pid is gone, or is a process that does not hold the lock, is replaced. |
| `cland hub status` | Asks the hub over its socket: pid, port, socket, uptime, version, connected sessions with their roles. `--json` prints the raw status. Exit 1 when no hub runs. |
| `cland hub stop` | Asks the hub to stop over its socket and waits for the process to exit. When the socket does not answer it sends SIGTERM, but only to the process holding the project's lock (pid and start time match); a `hub.json` naming any other process is removed and that process left alone. A hub that died without cleaning up has its `hub.json` removed, and its socket file unless another hub holds the lock by now. |
| `cland hub serve` | The hub in the foreground, logging JSON lines to stderr. This is what `start` runs. SIGTERM and SIGINT stop it gracefully. |

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

The Unix socket speaks the hub's frames as JSON lines, through the same dispatcher as the WebSocket: a spoke's hello works there too when it carries the secret, and a client's hello works on the WebSocket. The first frame is `{"type":"hello","protocol":2,"secret":"…","client":"cli"}`; a wrong secret gets `{"type":"error","code":"unauthorized",…}` and the socket closes. After the `welcome`, a client sends `{"type":"hub.status","id":"…"}`, `{"type":"hub.stop","id":"…"}` or a `task.*` request (below) and gets a `result` with the same id.

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
- **Hand edits** are picked up by a watcher on the folder (debounced 100 ms) and re-indexed; a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. Another session's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. It acts as `--as <name> [--role r]`, else `$CLAND_SESSION_NAME` and `$CLAND_ROLE`, else `human`.

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

The frames are `{"type":"task.<op>","id":"<request id>","item":"T-1",…}` with fields named as in the frontmatter (`labels`, `blocked_by`, `add_labels`, …); a CLI frame may carry `"as":{"name":…,"role":…}`, a spoke's always acts as its own session. The tools take the item as `id`.

## Running

From the repository root:

```sh
npm install
npm run typecheck
npm test
node hub/bin/cland.ts --version
```

`npm run check` inside `hub/` runs the typecheck and the tests together. `CLAND_TEST_VERBOSE=1` streams every spoke's stderr while the tests run.
