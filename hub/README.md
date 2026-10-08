# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames: `hello`, `welcome`, `error`, request `result`, `deliver`; the heartbeat interval and the frame size limit. The Unix socket's client hello (it carries the secret) and its requests `hub.status`, `hub.stop`. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, messages, per-addressee deliveries (queued → delivered, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. The thresholds are constants for now. |
| `src/hub/core.ts` | Presence, names, same-session takeover, routing, store-and-forward. Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests, client requests (`hub.status`, `hub.stop`), refusals. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/server.ts` | The WebSocket edge: bearer secret check, frame size limit, heartbeat sweep. `createHub` starts it with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. |
| `src/hub/daemon.ts` | The hub serving one project in the background: `.cland/` prepared, store on `hub.db`, both edges bound, `hub.json` written last and removed first. |
| `src/project.ts` | The `.cland/` layout, the managed `.gitignore`, the secret, the discovery file, finding the project root. |
| `src/cli/hub.ts` | `cland hub start`, `status`, `stop`, `serve`. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, retries a requested name before taking a generated one, stops on a same-session takeover (close code 4002). |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send`, `who`, `status`, `rename`, `history`; exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `hub …`, `--version`, `--help`. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket. The tests touch nothing else. |

The spoke finds its hub through the nearest `.cland/hub.json` walking up from its cwd, and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional. Delivering a message into the session uses Claude Code's channel notification, kept small and isolated in `spoke.ts` until the Claude Code adapter takes it over (#24).

## Not here yet

- **The human side.** The Unix socket answers only `hub.status` and `hub.stop`; the UI's protocol comes with #23, and until then a loop-breaker mute is only journalled.
- **Roles as hub state.** A session may declare one of the four role names so `@role` routes; clauses, permissions and handover come with #29–#33.
- **Adapters.** Claude Code (#24), Codex (#26) and OpenCode (#27) launch, attach and deliver into sessions.

## The project's hub

Run from a project's root, or anywhere inside it. The project root is the nearest ancestor holding `.git` or `.cland/`, else the current directory.

| Command | What it does |
| --- | --- |
| `cland hub start` | Prepares `.cland/`, starts `cland hub serve` detached, waits until it answers, prints its pid, port and socket. A live hub is reported instead of started twice; a `hub.json` whose pid is gone is replaced. |
| `cland hub status` | Asks the hub over its socket: pid, port, socket, uptime, version, connected sessions with their roles. `--json` prints the raw status. Exit 1 when no hub runs. |
| `cland hub stop` | Asks the hub to stop over its socket, falls back to SIGTERM, waits for the process to exit, removes `hub.json` and the socket file. |
| `cland hub serve` | The hub in the foreground, logging JSON lines to stderr. This is what `start` runs. SIGTERM and SIGINT stop it gracefully. |

The project's `.cland/`:

| Path | Committed | What it is |
| --- | --- | --- |
| `.gitignore` | yes | Managed by cland (first line `# managed by cland`); ignores every volatile file below. Remove the mark to take the file over. |
| `tasks/`, `roles.toml`, `config.toml` | yes | Not written by the hub yet (#29 onward). |
| `hub.db` (+ `-wal`, `-shm`) | no | The SQLite store: sessions, messages, deliveries, hygiene counters and mutes. |
| `secret` | no | 32 random bytes as hex, mode 0600. Kept across restarts, so spokes holding it reconnect. |
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

The Unix socket speaks the hub's frames as JSON lines, through the same dispatcher as the WebSocket: a spoke's hello works there too when it carries the secret, and a client's hello works on the WebSocket. The first frame is `{"type":"hello","protocol":1,"secret":"…","client":"cli"}`; a wrong secret gets `{"type":"error","code":"unauthorized",…}` and the socket closes. After the `welcome`, a client sends `{"type":"hub.status","id":"…"}` or `{"type":"hub.stop","id":"…"}` and gets a `result` with the same id.

## Running

From the repository root:

```sh
npm install
npm run typecheck
npm test
node hub/bin/cland.ts --version
```

`npm run check` inside `hub/` runs the typecheck and the tests together. `CLAND_TEST_VERBOSE=1` streams every spoke's stderr while the tests run.
