# Hub extraction from the BCAS driver hub

Issue #21 moved the reusable core of the BCAS driver hub into `hub/` (ADR 0003). The survey that decided what to keep is `docs/research/bcas-hub.md` on the branch `research/bcas-hub`, written for issue #2; its section 8 is the reuse list this extraction follows. `hub/README.md` describes the modules as they are now.

## Kept

| BCAS source | cland module | What changed |
| --- | --- | --- |
| `src/protocol.ts` | `hub/src/protocol.ts` | Only `hello`, `welcome`, `error`, `result`, `deliver` and the requests `send`, `who`, `status`, `rename`, `history`, `ping`. The hello carries a session id, a cwd, an optional name and an optional role. Added after the extraction (protocol 2): `deliver` carries the message id and the spoke answers with an `ack`, because spec 4.2 counts a message delivered only once the spoke accepted it. |
| `src/address.ts` | `hub/src/address.ts` | `@name`, `@all`, `@glob*`, and `@role` in place of groups and human handles. |
| `src/names.ts` | `hub/src/names.ts` | Generated names are `session-<n>`; the role names are reserved. The session id, not the name, is the identity: a generated name is never reused for another session (see `hub/README.md`, "Identity and delivery"). |
| `src/hub/store.ts` | `hub/src/hub/store.ts` | Sessions, messages and deliveries only; the migration mechanism is kept as a list of added columns. |
| `src/hub/hygiene.ts` | `hub/src/hub/hygiene.ts` | Unchanged in substance. |
| `src/hub/core.ts` | `hub/src/hub/core.ts` | Presence, names, same-session takeover, routing and store-and-forward; everything else removed. |
| `src/hub/server.ts` | `hub/src/hub/server.ts` | No human side, no attach door, no slot or incident sweeps. |
| `src/hub/telemetry.ts` (its log closure) | `hub/src/log.ts` | JSON lines only; no OTLP. |
| `src/channel/hub-client.ts` | `hub/src/spoke/hub-client.ts` | No probe, no role frame, no identity records. |
| `src/channel/spoke.ts` | `hub/src/spoke/spoke.ts` | Five tools; configuration from `CLAND_*` environment variables instead of a per-machine config directory. |
| `test/harness.ts` and the tests of the kept modules | `hub/test/` | Same seams; the cases that depended on dropped features were removed, the rest adapted. |

## Dropped, and why

- **Discord and the `HumanSide` port.** In cland the human side is the Neovim UI over a Unix socket (#23). Slash commands, forum and epic threads, the `**name** ›` signature parsing and the Discord id maps went with it.
- **Asks, roles and claims.** Re-implemented as cland features (#29–#33). A session may declare one of the four role names in its hello so that `@role` routes; that is all.
- **The Codex supervisor** (`src/codex/`). Redone as the Codex adapter (#26).
- **BCAS's own process machinery.** The evidence CLI, boards, machine slots, the SRE on-call flow and incidents, groups, record footers, hierarchy linking, citations, usage and model reports, and file attachments.
- **Deployment and identity.** The committed `hub.json` with its secret, per-machine config and name records, `deploy/`, Caddy and systemd. cland binds loopback only with a per-project secret file that is never committed (#22).
- **Prose protocol documents** (`CODEX.md`, the long instructions). The rules a session follows will live in skills and role clauses.
