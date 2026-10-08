# hub

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Modules

| Path | What it is |
| --- | --- |
| `src/protocol.ts` | The versioned frames: `hello`, `welcome`, `error`, request `result`, `deliver`; the heartbeat interval and the frame size limit. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, messages, per-addressee deliveries (queued → delivered, or dropped past the TTL), additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair. The thresholds are constants for now. |
| `src/hub/core.ts` | Presence, names, same-session takeover, routing, store-and-forward. Transport-free. |
| `src/hub/server.ts` | The WebSocket edge: secret check, hello timeout, frame size limit, heartbeat sweep. `createHub` starts it with no human side at all. |
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, retries a requested name before taking a generated one, stops on a same-session takeover (close code 4002). |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send`, `who`, `status`, `rename`, `history`; exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI; today only `--version` and `--help`. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; the tests touch nothing else. |

The spoke reads its configuration from the environment: `CLAND_HUB_URL`, `CLAND_HUB_SECRET`, and optionally `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`. Delivering a message into the session uses Claude Code's channel notification, kept small and isolated in `spoke.ts` until the Claude Code adapter takes it over (#24).

## Not here yet

- **The human side.** The Neovim UI talks to the hub over a Unix socket (#23); until then a loop-breaker mute is only journalled.
- **Roles as hub state.** A session may declare one of the four role names so `@role` routes; clauses, permissions and handover come with #29–#33.
- **The daemon.** `cland serve`, discovery and the per-project secret file come with #22.
- **Adapters.** Claude Code (#24), Codex (#26) and OpenCode (#27) launch, attach and deliver into sessions.

## Running

From the repository root:

```sh
npm install
npm run typecheck
npm test
node hub/bin/cland.ts --version
```

`npm run check` inside `hub/` runs the typecheck and the tests together. `CLAND_TEST_VERBOSE=1` streams every spoke's stderr while the tests run.
