# hub

## Start a project with cland

You need Node 24 and Git. Install cland from the release checkout:

```sh
git clone --depth 1 --branch v0.1.4 https://github.com/Kealman/cland-v0.git ~/.local/share/cland && npm --prefix ~/.local/share/cland ci && npm install -g ~/.local/share/cland
```

In your project folder, initialise cland:

```sh
cd /path/to/your-project
cland init
```

Use an empty folder or a full clone of an existing project. A shallow project clone is refused: the territory needs the full history. The shallow checkout above installs cland itself.

Then run setup in that same project folder:

```sh
cland setup
```

Setup readies the harnesses, their logins and folder trust, the accounts and your Favourite harness, then starts the hub and the Aide.

It checks these steps in order: the initialised project; installed Claude Code,
Codex and OpenCode; logins for harnesses used by roles; separate signed-in account
profiles; your Favourite harness; folder trust; the project hub; and `aide-1`.
Each report line starts with `ok` (already ready), `done` (changed and rechecked),
`skip`, `open` (needs action) or `fail`, with a fix when needed. Rerunning setup
reuses the running hub and Aide and asks only about unfinished choices. A declined
installer is remembered in `.cland/config.toml`; `--install <harness>` retries it.

The official user-level installer and the harness's login run in your terminal
after you agree. Setup writes your Favourite to `[aide.launch]` in
`.cland/roles.toml`. Outside the project, accepting the accounts question appends
names, harnesses and profile paths to `~/.config/cland/accounts.toml` (under
`XDG_CONFIG_HOME` when set); it copies no credentials. That question defaults to
No. Setup also trusts this project for every installed harness: Claude Code's
launch profile gets `projects["<root>"].hasTrustDialogAccepted = true` in
`.claude.json` (`~/.claude.json` by default, or inside `CLAUDE_CONFIG_DIR`), under
Claude Code's lock; Codex's short-lived app-server writes
`projects."<folder>".trust_level = "trusted"` to its profile's `config.toml`
(`~/.codex/config.toml` by default, or under `CODEX_HOME`). Selected role accounts
receive trust too. OpenCode has no folder trust gate.

| Flag | Effect |
| --- | --- |
| `--json` | Print one structured report; narration goes to stderr. Uses nonterminal policy. |
| `--yes` | Allow harmless setup writes; installers still require `--install`, and logins and a new Aide require a terminal. Does not accept machine-wide accounts. |
| `--install claude-code\|codex\|opencode` | Explicitly run that harness's installer, including after a decline. |
| `--harness claude-code\|codex\|opencode` | Choose the Favourite from installed harnesses. |
| `--no-accounts` | Skip the machine-wide accounts step. |
| `--no-aide` | Skip hub/Aide startup and workbench handover. |
| `--attach` | Attach the Aide in this terminal instead of opening the workbench. |

Without a terminal, setup asks nothing and reports unfinished steps with their
commands. It exits 1 while a step is open or failed, 0 when all applicable steps
are ready, and 130 on cancelled input. A running hub and Aide can be detected
without a terminal. Explicit flags can permit the actions described above.

Setup opens the workbench with `CLAND_OPEN_SESSION=aide-1`. Once the hub lists
that session, the workbench opens its terminal in the centre in Terminal mode,
once. `CLAND_OPEN_SESSION` can name another opening session; it is removed at
startup before any child inherits it. An unknown name waits quietly, and a
saved restart view takes precedence.

The Aide leads the Onboarding: who decides what, a first plan you can see, the crew and a Welcome note; on your ok, the Aide commits and pushes the results and starts the Coordinator, then offers the Tour.

To reopen the workbench later, run `cland` in your project folder.

Closing the workbench or leaving an attach can leave the Aide running. Stop it
with `x` on its row in the sessions panel or `cland session stop aide-1`. Then
`cland hub stop` stops the project hub. Both commands run from the project folder.

The cland hub: the per-project service sessions talk through, the spoke each session runs, and the `cland` CLI. Node 24, TypeScript run by type stripping (no build step), `node:sqlite`, `ws`, the MCP SDK.

Its core was extracted from an earlier hub (ADR 0003). What was kept, what was dropped and why, and the pointer to the survey behind it (issue #2) are in `docs/hub-extraction.md`.

## Web workspace

The sibling `web/` workspace builds the browser bundle with React 19 and Vite.
Keep development dependencies installed: the prepare hook needs Vite even for a
release checkout. Root `npm install` builds `web/dist` through `prepare`. Verification's `npm run check`
runs the shared strict typecheck, builds the bundle, then static/test lint, on local
and remote executors. Remote `verification.prepare` still handles dependencies
and Neovim; it is not the local bundle build hook. `web/dist` stays ignored.

`cland doctor` includes a **web bundle** row for this cland installation (independent
of the project being diagnosed). It compares `web/dist/build-stamp.json` with the
source filenames, content digest and latest modification time. Missing, invalid,
changed or newer inputs warn to run `npm run build` in the installation. A Vite
build, including watch rebuilds, writes a stamp only after checking local asset
references and unchanged inputs. See [web/README.md](../web/README.md) for tokens,
fonts and the development loop. E-412 serves this bundle; there is no dev bridge.

## Modules

| Path | What it is |
| --- | --- |
| `../shared/wire/` | Browser-safe client wire types, restated from the current hub: frames, workbench requests (including session and item requests), pushed events and their payloads. Every import and re-export, including type-only references, must stay inside this directory; no Node built-ins or ambient Node types. T0 enforces the boundary, `npm run typecheck` checks the leaf with DOM libraries and no ambient type packages, and `test/wire-conformance.ts` checks the restated shapes against their hub owners. This expand step keeps the hub's own types and current frames unchanged; future snapshot/delta types belong here. |
| `src/protocol.ts` | The versioned frames (protocol 2): `hello`, `welcome`, `error`, request `result`, `deliver` and the spoke's `ack` of it, the `role` frame (a role's clause); the keepalive interval and the frame size limit. The client hello (it carries the secret on the Unix socket), the client requests `hub.status`, `hub.stop`, `topic.*` (`topic.answer` among them), `inbox.*`, `role.*`, `hygiene.unmute`, `subscribe`, the pushed events `message`, `delivery`, `topic`, `ask`, `inbox`, `session.state`, `session.role`, `presence`, `session.process`, `session.usage`, `role.vacant`, `role.filled` and `task`, the typed `forbidden` result, the `inject` frame to an in-session bridge; session states and the process table's view. |
| `src/address.ts` | The address grammar: `@name`, `@all`, `@glob*`, `@role`. |
| `src/names.ts` | Session names, reserved names, the role names, generated `session-<n>` names. |
| `src/log.ts` | The JSON-lines log closure every hub event goes through. |
| `src/watch.ts` | A folder watch that falls back to polling every 500 ms where watching is refused (a macOS sandbox denies FSEvents): used for `.cland/tasks/`; roles refresh uses its own async timer. |
| `src/hub/topics.ts` | The topic model (spec 4.5): the status moves, the mentions of a human message, the "no coordinator" warning, the port to the tracker a binding goes through. |
| `src/hub/asks.ts` | Asks (spec 4.5, #33): the Coordinator's question with numbered options; the human's answer with `answer_to`; withdrawn by `resolve`, cancelled by a close. |
| `src/hub/visibility.ts` | The §3.5 placement table, project overrides and outgoing frame layer projection shared by all surfaces. |
| `src/hub/inbox.ts` | The inbox (spec 5, #33): asks/command approvals, pending plans, requests, messages, the "needs you" count, the `inbox` event; the idle threshold from `.cland/config.toml`. |
| `src/hub/store.ts` | The SQLite store (WAL): sessions, topics (status, binding, the human's read mark), messages (each in a topic), per-addressee deliveries (queued → delivered on the spoke's ack → injected on the adapter's confirmation, or dropped past the TTL), hygiene state, additive migrations guarded by `pragma table_info`. |
| `src/hub/hygiene.ts` | Size cap, rate limit per session, loop breaker per pair, keyed by the session id (a rename changes nothing) and written through to the store so a restart keeps a mute. Its constants are the defaults; `.cland/config.toml` `[hygiene]` overrides them at hub start (`src/init/config.ts`). |
| `src/hub/journal.ts` | The journal, `.cland/journal.jsonl`: a tap on the log closure that appends the domain events as JSON lines (opened for appending: a restart never truncates), `write` for a record of its own, and the reader behind `cland hub journal`. |
| `src/hub/agents-topic.ts` | The Agents record: maps the hub's lifecycle events (session start, stop, death; role assignment and revocation; claims and releases) to hub notices with a `kind`, posted through `HubCore.noticeInTopic`. |
| `src/hub/core.ts` | Presence, names keyed to session ids, same-session takeover, routing, store-and-forward with acks, the standing topics, the human's messages, each session's state (set only through the adapters), the events subscribed clients receive, each session's role (assignment, the clause's delivery, Coordinator exclusivity and vacancy). Transport-free. |
| `src/hub/dispatch.ts` | The frame dispatcher every transport shares: hello, spoke requests and acks, client requests (`hub.status`, `hub.stop`, `topic.*`, `subscribe`), the `task.*` requests from either, the `session.*` requests (`src/adapters/requests.ts`), refusals. A spoke's frames count only while its socket is open and still holds the session's name. Transport-agnostic: raw frames in, frames out through a peer. |
| `src/hub/merge.ts` | The task merge gate: hub verdict provenance, cached freshness, a queued squash merge and the item lifecycle; session-delayed worktree cleanup. |
| `src/hub/budget.ts` | The request path's guard (T-67): every frame's handling timed against the budget (`slow-request`), and a read a connection repeats too fast answered with its previous answer (`too-fast`). |
| `src/hub/server.ts` | The hub without listeners (`createHubBase`: core, dispatcher, prune) and the WebSocket edge (bearer secret check, frame size limit, keepalive sweep). `createHub` is both, with no human side at all. |
| `src/hub/socket.ts` | The Unix socket edge for the UI and the CLI: JSON lines, the secret carried in the hello. Bound under a private name and renamed into place; on close it removes the path only while the path is still the socket it bound. |
| `src/hub/lines.ts` | The JSON-lines framing both byte-stream edges share: complete lines split off first, each held to the frame limit on its own, then only the unfinished remainder. |
| `src/hub/stdio.ts` | The stdio edge for a UI that spawned the hub as its child (`cland hub serve --stdio`): JSON lines on stdin and stdout, no secret, the hub stops when stdin ends. |
| `src/hub/lock.ts` | The project's hub lock, `.cland/hub.lock`: created whole or not at all, holding the holder's pid and process start time; a stale one (pid gone, or reused by a process started at another time) is broken under a guard. |
| `src/hub/daemon.ts` | The hub serving one project in the background: the lock taken first, `.cland/` prepared, store on `hub.db`, spoke and Unix-socket edges bound, the independent web edge attempted, the adapters plugged in, `hub.json` written last; the launched sessions re-found once it is reachable. Shutdown runs backwards: edges closed, `hub.json` removed, the lock released last. For a stdio hub the listeners are optional (below). |
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
| `src/cli/role.ts` | `cland role set`, `clear`, `launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …] [--json]`, `list`. |
| `src/cli/inbox.ts` | `cland inbox`, `cland topic create`, `cland topic answer` (Topics, Asks and the inbox). |
| `src/cli/init.ts` | `cland init [dir]`, `cland init --undo [--force]`, `cland update [dir]`. |
| `src/territory.ts` | The territory's Git runner, shared lock, provisioning, undo and read-only health checks; the task branches' base and the task worktrees (made, listed, removed); the squash commit and guarded push; usable without a hub. |
| `src/hub/worktrees.ts` | Task worktrees in the hub (T-58): which items get one, made at a task's claim and by `session.launch` with an item (which then claims the item for the session), listed with their items and the sessions inside, pruned. |
| `src/cli/worktree.ts` | `cland worktree list`, `cland worktree prune [--yes]`. |
| `src/cli/setup.ts` | `cland setup [dir]`: root and terminal policy, text/JSON output; `src/setup/` holds the ordered runner, step modules and terminal child helper. |
| `src/cli/doctor.ts` | `cland doctor [dir]` (below). |
| `src/doctor/` | Its checks: `toolchain.ts` (the harnesses, `gh`, Neovim), `project.ts` (the hub, the config files, what `cland init` provisioned), `ranges.ts` (`TESTED_RANGES`, the harness versions each adapter was built against), `report.ts` (the verdicts, the text and the runner). |
| `src/init/provision.ts` | What `cland init` and `cland update` provision, step by step (below); `src/init/` holds one module per managed part: `config.ts` (`config.toml`, also read by the hub), `skills.ts`, `instructions.ts` (`AGENTS.md`, `CLAUDE.md`, `docs/agents/*`), `claude-settings.ts` (the hooks and background worktree policy), `files.ts` (write-only-when-changed and the report). |
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
| `src/spoke/hub-client.ts` | The spoke's connection: reconnects for ever with capped backoff, asks again for the name it was welcomed under, retries a requested name before taking a generated one, never stops for good (closed with 4002 by a hub older than T-51, it reconnects like after any close). Acks every delivery and hands each message id to the session once. Fails a request after its deadline, keepalives while connected and reconnects after two unanswered keepalives; before the welcome, tool requests wait for readiness up to 20 s, and a hub that does not answer hello within the separate welcome deadline is left and reconnected to. |
| `src/spoke/spoke.ts` | The stdio MCP server a harness spawns: tools `send` (into a topic, to the human or to sessions), `topic.create`, `resolve`, `ask`, `who`, `status`, `rename`, `history` (a session's traffic, or a topic's with `topic`; Agents accepts `item` and `session` filters), `session.launch`, `role.handover`, `role.state`, `artifact.create`, `artifact.promote` and the `task.*` tools (`src/spoke/task-tools.ts`); exits when the session's stdin closes. |
| `bin/cland-spoke.ts` | The spoke's entry point. |
| `bin/cland.ts` | The `cland` CLI: `open`, `init`, `update`, `setup`, `doctor`, `hub …`, `task …`, `session …`, `worktree …`, `hook …`, `--version`, `--help`. With no command it opens the workbench when stdin and stdout are a terminal, and prints the help otherwise. |
| `test/harness.ts` | Starts a real hub on an ephemeral port and spawns real spokes over MCP stdio; runs the `cland` CLI as its own process in a temporary project and speaks to that hub's Unix socket; puts a fake Claude Code first on a daemon's PATH. The tests touch nothing else. |
| `test/fakes/claude-code/` | The fake Claude Code the adapter is tested against (`claude`, a script; `fake-claude.ts`): `--bg` with the MCP config, the settings hooks and the plugin dir, the real spoke as its MCP server, the real cland mod against a small `$`, `agents --json`, `attach`, `stop`. Every CLI invocation records its time, arguments and effective config directory in `invocations.jsonl` (and the compatible `calls.jsonl`); sessions are partitioned by that directory and job records include only the names of inherited auth variables; a `logged-out` marker refuses `agents` and `--bg` with token expiry. Like the real one it also runs the project's `.claude/settings.json` hooks and reads `CLAUDE.md` with its `@` imports, else `AGENTS.md`; what a session loaded goes to `jobs/<id>.context.json`. |
| `test/fakes/codex/` | The fake Codex the adapter is tested against (`codex`, a script; `fake-codex.ts`): `app-server --listen unix://…` speaking Codex's JSON-RPC over a WebSocket on the socket, with the real spoke started from the `-c mcp_servers…` overrides; `resume --remote …`, which refuses any `-c`/`--profile`; `--version`. |

The hub also owns an independent **web edge**, an HTTP listener defaulting to `127.0.0.1`.
It serves the installed `web/dist` bundle. Its stable port is `webPort` in
`.cland/hub.json`; `port` remains the spokes' WebSocket port. With `[web] port = 0`
(the default, also when unset), the first start chooses a free port and keeps it
in the volatile, ignored `.cland/web-port` file across restarts. An explicit
`[web] port` (1–65535) overrides that file without replacing the kept automatic
port. A taken port never causes a move to another origin: the hub starts with
its spoke and Unix-socket edges, logs `web-unavailable` with the port and reason,
and reports `{ port, bind, available: false, reason }` as `hub.status.web`.
`cland hub status` shows the web URL or that reason in its hub block, before
`sessions: N` and the connected session rows; `cland doctor` warns. Free the port or
change the setting and restart the hub. A running edge reports
`hub.status.web = { port, bind, available: true }`; stdio-only hubs omit it.

For development, `[web] dist = "path/to/bundle"` serves another bundle; relative
paths resolve from the project root, absolute paths are accepted, and the empty
default uses the installed bundle. All `[web]` settings take effect on hub restart.
For example:

```toml
[web]
port = 54321
bind = "127.0.0.1"
origin = ""
dist = "web/dist"
```

`[web] bind` accepts an IPv4 or IPv6 address. A LAN address opens only the web
edge there; the spokes stay on `127.0.0.1`. Wildcards `0.0.0.0` and `::` expose
local interfaces, whose addresses join the Host allow-list at startup. Loopback
Hosts (`127.0.0.1`, `localhost`, `[::1]`) and the bound address require the exact
web port; foreign Hosts and duplicate Host headers are refused. `hub.status.web.bind`
reports the actual bound address; `hub.status.spokeBind` reports the spokes’
listener address from its server. On a wildcard bind, a normal link uses loopback;
on a concrete bind it uses that address.

`[web] origin = "https://phone.example"` names the human's HTTPS tunnel, with an
optional port and no path, credentials, query or fragment. Its Host joins the
allow-list, and that exact HTTPS Origin is required when upgrading with that Host.
The tunnel must preserve Host and Origin. The last hop may be plain HTTP: forwarded
headers (`Forwarded`, `X-Forwarded-*`) are never trusted. A cookie issued when
both Host and Origin match this configured origin carries `Secure`; other requests
do not gain `Secure` from a forwarded header. A top-level GET may omit Origin, in
which case this rule does not set Secure. The tunnel and its TLS are human-managed;
cland starts no tunnel service.

`cland web --qr` prints the one-time link and a Unicode half-block QR code with a
four-module quiet zone and explicit terminal colours. It never opens a browser;
`--no-open` may accompany it. The link uses `[web] origin` first, otherwise the
concrete LAN bind (for a wildcard, the first usable non-internal local address).
Selection skips loopback, unspecified/multicast and IPv6 link-local destinations
(`fe80::/10`): a link-local zone belongs to each device, so the hub’s scope id
cannot be put in a phone URL. With no usable LAN address, QR mode refuses with
the reason and suggests a tunnel or a LAN bind.
Loopback alone refuses with a reason: a phone cannot reach it. QR encoding uses
the vendored MIT-licensed Project Nayuki encoder, with no runtime package dependency.
The QR and printed URL contain the same five-minute single-use token: treat both
as sign-in credentials. `cland doctor` warns when a network bind has no tunnel:
plain HTTP carries the cookie in clear and gives phones no notifications or install.

The spokes' authentication and refusal of client hellos are unchanged.
Paths stay inside the bundle,
including symlinks; extensionless routes fall back to `index.html`. Missing
bundle/index responses name `npm run build --workspace web` (503, plain text).
Every ordinary HTTP response has CSP (including `frame-ancestors 'none'`),
`X-Content-Type-Options: nosniff` and `Referrer-Policy: no-referrer`.
Entry files, manifest, service worker and icons use `no-cache` and an ETag
(matching `If-None-Match` returns 304); existing `/assets/*` files use
`public, max-age=31536000, immutable`. SPA fallbacks keep `no-cache`.

`cland web` asks the running hub for a one-time sign-in link over its Unix
socket, prints `http://127.0.0.1:<webPort>/auth?token=…`, and opens it with
`open` on macOS or `xdg-open` on Linux. `cland web --no-open` only prints the
link; `cland web --help` describes the command. It does not start the hub.
This is a human-shell command: a session's shell is refused, including an
unknown session identity; do not unset its actor variables to bypass that check.

The client frame `{type: "web.link", id: "…", qr?: boolean}` returns a normal `result` with
`value: {url: "http://127.0.0.1:<port>/auth?token=…"}`. It requires the local Unix
socket and human authority, so isolated test clients can mint links without
opening a browser. `qr: true` selects the phone origin and refuses loopback alone. The token is 32 random bytes, encoded as 64 hex digits; the
hub retains only its SHA-256 digest and accepts it for five minutes, once.
`GET /auth?token=…` atomically spends it, sets a fresh browser session cookie,
and sends a 302 redirect to `/`. Unknown, expired and spent tokens return 401;
HEAD returns 405 without spending the link. Auth responses use `no-store` and
`Referrer-Policy: no-referrer`.

The cookie is `cland_<key>`, where `<key>` is the first 12 hex digits of SHA-256
of the project's canonical root, with `Path=/`, `HttpOnly`, `SameSite=Strict`
and `Max-Age=2592000` (30 days). Its value is a separate random credential,
stored only as a SHA-256 digest in `hub.db`'s `web_sessions` table, with a separate
public UUID, creation time and last-use time. Cookie names differ across projects
because cookies are not isolated by port. Restarting the hub clears unused links
but keeps browser sessions. A session expires exactly 30 days after creation;
using it never extends that lifetime. Last use records a successful `/ws` admission.
The additive table/index migration does not rewrite or backfill message history.

`cland web --sessions` prints `ID`, `CREATED`, `LAST USED` (UTC ISO timestamps)
and `SOCKETS` for each unexpired cookie session, including sessions with no open
sockets. `cland web --revoke <id>` deletes that session's admission and terminates
all its sockets, waiting for their server-side close events before returning.
The process log records `web-session-socket-closed` with the public session id
after each server socket closes and its conversation is cleaned up.
Other sessions stay connected; the deleted cookie is refused immediately and
after a restart. Unknown ids fail. These commands never open a browser or mint
a link; `--no-open`, `--sessions` and `--revoke` cannot be combined.

Like `web.link`, `{type: "web.sessions", id}` and
`{type: "web.revoke", id, session: "<uuid>"}` require the human's local Unix
socket (not browser, spoke or stdio). Their result values are
`{sessions: [{id, createdAt, lastUsedAt, sockets}]}` and `{revoked: "<uuid>"}`.
No cookie or digest is returned by listing. Session shells are refused.

Every `/ws` upgrade checks an allowed Host and its exact port, an Origin exactly
matching `http://<Host>` (or the configured HTTPS tunnel origin for its Host), and the project's unexpired cookie before accepting
any frames. Missing, foreign and `null` Origins are refused with 403; a missing
or invalid cookie gets 401. An authenticated socket accepts only a client hello
`{type: "hello", protocol: 2, client: "web"}` without a secret, welcomes it as
`human` regardless of the client label, and dispatches human requests such as
`hub.status`. A spoke hello is refused and its socket closed. Server pings keep
idle browser connections alive and reap a peer that misses a pong at the next
30-second sweep. The hub secret remains in local machine processes: it is never
sent in bundle files, auth responses or browser frames. The browser uses its
cookie for every socket; no bearer secret belongs in its JavaScript or storage.

The cookie carries the human's authority subject to the web policy in
`src/hub/web-authority.ts`. The table has an explicit row for every human
`ClientRequest`, `TaskRequest` and `SessionRequest`; typecheck's conformance test
fails if a frame is missing a row. Unknown or unclassified frames are refused
by default, including prototype names. The dispatcher checks this policy before
cached replies, actor resolution or any handler runs. Refusals are ordinary
`result` frames with `ok: false`, `code: "cli-neovim-only"` and an error naming
the CLI and Neovim.

In 0.2.0, these actions stay in the CLI and Neovim:

- `hub.stop`, `hub.reload`, `release`, `sync`, `push`, `publish`;
- `config.set`, `crew.set`, `executor.prepare`, `executor.reap`,
  `executor.retire-legacy`, `task.migrate`, `web.link`, `web.sessions`, `web.revoke`;
- `session.signal`, `worktree.prune`, `artifact.delete`, `suite.forced`,
  `task.import`, `demo.start`, `demo.exec`, `demo.stop`, `demo.status`;
- `artifact.create` carrying a `path`, including alongside `content`;
- every frame carrying an `as` field, including the initial hello, regardless
  of its value.

Every other classified human request continues through normal dispatch,
including `merge`, queued `suite.start`, `suite.slot`, `suite.cancel`,
`suite.classify`, `session.resume`, `session.bridge`, `executor.status`,
`artifact.promote` and `artifact.move`. Topic messages and inline artifacts are
recorded as the human's. Unix-socket clients retain their existing authority and
handler preconditions. There is no `hub.restart` protocol frame.

An authenticated web client mints an artifact bearer URL with
`artifact.url {artifact: "A-3"}`; the result is `{url}` on the same page origin,
for example `http://127.0.0.1:<webPort>/a/<random-capability>/index.html`.
This frame requires a cookie-authenticated web connection; Unix sockets, stdio
and agent sessions cannot mint it. Each mint creates an independent random
256-bit capability tied to that connection's cookie session and one artifact.
Every mint returns a new capability. Only its SHA-256 digest, session id and
artifact id are persisted in `hub.db`; the URL survives a hub restart. Capability
rows cascade away when their session is deleted or pruned. A URL stops working
immediately when its cookie session is revoked or reaches its fixed 30-day
expiry, including on an already-open minting connection.

`GET` and `HEAD /a/<capability>/<file>` require no cookie. A file artifact exposes
only its file name; a folder exposes its regular files, with the entry file in
the minted URL. Relative references such as `style.css` retain the capability
and resolve from the page's directory. Moved artifact ids resolve to their file
inside the owning folder, without granting the rest of that folder. Unknown,
deleted, expired or revoked capabilities return 404; dot segments, traversal,
backslashes and symlink escapes are refused. MIME types follow the extension
(with `application/octet-stream` for unknown extensions). Responses use
`Cache-Control: no-store`, `X-Content-Type-Options: nosniff`,
`Referrer-Policy: no-referrer` and `Content-Security-Policy: sandbox allow-scripts`.
HTML can run scripts and load its own relative assets in an opaque origin;
never combine `allow-scripts` with `allow-same-origin` on an artifact iframe.
The web edge resolves its trusted project prefix once, so symlinked project
ancestors (including macOS `/var` and `/tmp`) work. Artifact suffixes stay
lexical: file opens reject symlinks below that prefix. Linux walks directory
descriptors from the resolved prefix through `/proc/self/fd` (procfs is required),
while macOS uses `O_NOFOLLOW_ANY` on the resolved prefix plus lexical suffix,
without combining it with the incompatible `O_NOFOLLOW` flag. Artifact paths
outside the lexical project prefix retain full-path no-follow checks and are
never canonicalized.
A directory renamed after admission cannot redirect an opened Linux parent;
macOS checks the entire path during open. Other platforms refuse artifact reads.
Treat the whole URL as a bearer credential and avoid sharing or logging it.

The spoke finds its hub through `.cland/hub.json` (`CLAND_HUB_FILE` names it, else the nearest one walking up from its cwd), and reads it again before every reconnect, so it follows a restarted hub to its new port. `CLAND_HUB_URL` and `CLAND_HUB_SECRET` override discovery. `CLAND_SESSION_ID`, `CLAND_SESSION_NAME` and `CLAND_ROLE` are optional; on a project's hub `CLAND_ROLE` is only a request (see Roles). `CLAND_HUB_RECONNECT_MS`, `CLAND_HUB_KEEPALIVE_MS`, `CLAND_HUB_REQUEST_TIMEOUT_MS` and `CLAND_HUB_WELCOME_TIMEOUT_MS` set the timings, for tests. A session an adapter launched sets `CLAND_DELIVERY=adapter`: the spoke then only accepts deliveries and the adapter injects them. Otherwise the spoke delivers into the session as a Claude Code channel notification (a research preview, kept small and isolated in `spoke.ts`). `CLAND_TEST_TASK_WRITE_GATE`, read by `cland hub serve`, names a test-only directory: the next tracker temporary write consumes its `armed` file, writes `entered`, and waits until the test creates `release` before proceeding to rename. Tests arm it after fixture setup, then release it after the competing operation; nothing else sets it. Also for tests only: `CLAND_QUEUE_TTL_MS` shortens the queue TTL (how long a queued message and a remembered name last), and `CLAND_TEST_CRASH_AT=handover-committed` kills the hub right after a handover's transaction committed (`launch-reserved`: right after a launch reserved its role, before the spawn).

The spoke's `session.launch` tool takes `name` and optional `role`, `model`, `harness`, `effort` and `cwd`. `cwd` is an absolute path or a path relative to the project root; omitting it runs the session at the project root. For example, `session.launch {"name":"impl-45","role":"implementer","cwd":".cland/worktrees/T-45"}` launches the Implementer in that worktree. A missing, inaccessible or non-directory path is refused before launch with `{"ok":false,"code":"invalid-cwd","error":"…"}`. With `item` instead (`session.launch {"name":"impl-45","role":"implementer","item":"T-45"}`), the hub makes or reuses the item's task worktree first and starts the session there (Task branches and worktrees, below).

Optional `brief` gives the session its first task: literal text, or an artifact id `A-<n>` whose current file content is read at launch. For example, `session.launch {"name":"impl-45","role":"implementer","item":"T-45","brief":"Implement T-45 and report to the Coordinator."}` or `cland session launch impl-45 --role implementer --item T-45 --brief A-12`. A string consisting only of an artifact id names that artifact; an unknown or unreadable artifact, an empty brief, or text over the ordinary message size limit refuses the launch before a harness starts.

The first harness input includes the role clause followed by the brief on Claude Code, Codex and OpenCode, so the first turn can start work without another `send`. When `role` is omitted, the launch uses the role already assigned to the name, including its launch defaults and clause. The brief keeps its own message id, journal `send` record and delivery stage. It enters the durable queue before spawn, so a hub restart before the first hello preserves the first task. It belongs to that launch; a failed launch cancels its undelivered brief during cleanup. Claude Code and OpenCode receive the initial clause and brief as one delivery batch after the spoke's welcome; Codex carries both in its launch first turn, settling the queued brief as injected when the native input is accepted. With no brief, the existing launch behavior stays. Reconnect and hub restart deliver the role clause again, never a new brief; an unacknowledged initial delivery retains the ordinary queue's retry rules. A resumed or relaunched conversation does not carry the launch brief again.

A spoke discovering a project hub without `CLAND_SESSION_NAME`, an existing session-id role mapping or a hub launch credential stays disconnected. It serves its MCP tools with an error explaining how to bind the session and appends one `spoke-connection-skipped` record to the project's journal. `CLAND_ROLE` alone grants no connection. Named sessions with a human-assigned role and hub-launched sessions still connect; a nameless spoke of a mapped session still joins or recovers its identity, and an explicitly configured standalone hub retains generated names.

### Spoke readiness and deadlines

MCP initialization and tool listing do not wait for the hub. A tool called while its spoke is connecting waits for that connection's welcome up to `READINESS_TIMEOUT_MS` (20,000 ms), then sends its request. The wait applies on initial connection and reconnect. A timeout returns `{ok:false, error:"the hub did not become ready within 20 s (waiting for welcome)"}`. Expired calls are removed and never sent on a later welcome. A disconnect, refusal or stopped spoke fails waiting calls immediately; an already disconnected or refused spoke reports its outage immediately.

After the wait, the spoke re-reads the live connection and the identity and role accepted by its welcome. No identity or permission is captured before awaiting; the hub checks each request's permissions under that connection. Concurrent waiting calls share the welcome, with a separate deadline for each call.

`WELCOME_TIMEOUT_MS` is a separate 20,000 ms liveness bound measured from sending hello; `CLAND_HUB_WELCOME_TIMEOUT_MS` overrides it for tests. Previously, a silent hub that completed the WebSocket upgrade was cut off after 10 s; it now costs up to 20 s to detect that silence. The WebSocket handshake still has its 10 s deadline. Socket close fails waiting calls immediately and uses the existing reconnect path, including capped backoff and name retries. Ordinary reply deadlines remain `REQUEST_TIMEOUT_MS` (10,000 ms), overridden for tests by `CLAND_HUB_REQUEST_TIMEOUT_MS`; the reply clock starts only when the request is sent.

The readiness bound is below the harness tool-call deadlines: [Codex defaults to 60 s per tool](https://developers.openai.com/codex/config-reference/), and [OpenCode v2 defaults to 12 hours for execution](https://opencode.ai/v2/docs/mcp-servers). OpenCode's 30 s startup/catalog bounds apply to initialization and listing, which remain callable while the hub connects. The MCP SDK test client defaults to 60 s. cland's adapters leave these execution defaults in place. A normal tool can therefore spend at most 20 s waiting and 10 s awaiting a reply; `merge` and `session.launch` retain their existing separate 60 s reply bounds.

`artifact.create` has a separate 120 s reply budget because folder publication queues behind other creations and copies files serially. `artifact.list` keeps the ordinary 10 s budget. The creation budget starts when the spoke sends the request; readiness can add up to 20 s before that. The outer harness/MCP tool deadline still applies and can expire before this longer spoke deadline. To receive the full creation budget, the caller must allow more than 120 s for a ready spoke, or more than 140 s including readiness and transport overhead. This override does not raise the outer deadline or cancel hub copying. If either deadline expires, publication may still finish: inspect `artifact.list` in the destination topic before retrying, since a new create can publish a duplicate. Durable operation ids and idempotent retries are not provided by this budget override.

## Connection events filter

`subscribe` accepts `filter?: EventsFilter`, the same fields as `events.list`:

| Field | Meaning |
| --- | --- |
| `kinds?: EventKind[]` | Include these kinds: `session`, `task`, `topic`, `verdict`, `release`, `suite`, `usage`, `artifact`, `heartbeat`, `rule`. Missing or empty means all kinds. |
| `warnings?: boolean` | `true` includes only warning rows, including rows promoted to warnings by visibility rules. |
| `subject?: {kind, id}` | Match an `item`, `session`, `topic`, `artifact` or `rule`; item ids are canonicalised and include descendants. |
| `muted?: Array<{kind, id}>` | Exclude exact subjects. |

The fields combine. For example,
`{type: "subscribe", id: "warnings", filter: {warnings: true}}` installs the
connection's filter immediately and returns `{subscribed: true, events: EventsPage}`.
`events` is its filtered first page (`rows`, `before`, `more`). Buffer live rows
until the reply, then merge by row id and `replaces`, as with ordinary event pages.
Send another `subscribe` with a filter on the same connection to replace it and
receive a fresh first page; wait for that reply before changing it again.
`events.list` without an explicit filter inherits the connection filter, including
older pages. An explicit filter overrides that read only; `{}` reads all rows.
Snapshots prepared on the connection also use its current filter. The initial
hello snapshot precedes subscription setup; use the returned events page to
replace its events domain when installing a filter afterwards.

Only events-view rows are filtered: other model domains continue unchanged.
For numbered clients, an excluded event becomes `{type: "model.advance", epoch,
seq}` without a row. Apply its cursor without changing any domain, preserving
contiguous model sequence numbers. Same-connection `resume` filters replay too.
Filters end with the connection; after reconnect, install the filter with
`subscribe` before sending a `resume` request if filtered catch-up is needed.
A hello resume has no filter yet and replays every row.

`subscribe` without a filter resets to every row and keeps the existing
`{subscribed: true}` reply. Clients that never install a filter, including Neovim,
keep their existing pages and live rows.

## Negotiated connection snapshot

A human client can add `features: ["snapshot", "numbered-deltas", "slim-frames"]`
to its existing protocol-2 hello. Unknown feature names are ignored. The welcome
includes `features`, the accepted subset; `snapshot`, `numbered-deltas` and
`slim-frames` are supported independently.
A local hello without `features` keeps its existing welcome and receives no snapshot.
An empty list receives `features: []`. Spoke hellos are unchanged.

### Liveness, version skew and terminal reservations

The web edge sends a WebSocket ping every 30 seconds and terminates a socket
at the first sweep with 60 seconds of silence. Pongs and incoming bytes refresh
that deadline; an application frame still arriving is live traffic too.

Every web welcome includes the negotiated `features` list (empty without opt-in)
and `buildStamp`: the served bundle's source digest from `build-stamp.json`, or
`null` when that receipt is absent or invalid. The digest is read at each welcome,
so rebuilding the bundle needs no hub restart. Vite embeds the same digest in
the entry HTML's `cland-build-stamp` meta tag. A page with a different stamp
reloads once per target build per tab; the guard prevents repeated reloads if a
proxy keeps serving old HTML. With storage unavailable it keeps the page usable.
A protocol-refused web hello gets error code `version`, `action: "restart-hub"`
and an instruction to restart the hub. The page shows **Restart hub** and stops
retrying. The web edge cannot perform the restart itself.

The eight reservations for a later terminal are:

1. Text messages carry JSON. Binary messages are reserved for streams and are
   refused with close code **4003**, reason `binary frames reserved for streams`.
2. Streams stay outside the live model: no snapshot, journal or catch-up payload
   carries terminal bytes; no stream is admitted yet.
3. Sequence numbers count committed model deltas. Welcome, results, snapshots,
   pings and future stream frames do not consume them.
4. Each connection's model queue must have a resync boundary; the 4 MiB queue
   and resume ring are owned by the resume slice (T-986).
5. The present socket carries model/control traffic only. A terminal extension
   must preserve model priority or use a separate socket before admitting streams.
6. Upgrade routing admits only `/ws`, with a fresh Host, Origin and cookie check
   on every socket. One cookie can authenticate several sockets.
7. `FRAME_LIMITS_BYTES` separates JSON (**1,048,576 UTF-8 bytes**) from binary
   (**0 bytes admitted**). Oversize JSON closes with **1009** before parsing;
   even an empty binary message is refused. WebSocket control frames retain
   their RFC 6455 125-byte cap. Snapshot domains have their own smaller caps below.
8. Hello/welcome negotiate features. Every adapter must declare `terminal`,
   currently `"none"`, in its capability table, readable in `session.list.adapters`.

After the welcome, an accepted snapshot produces seven ordered frames:
`{type: "snapshot", epoch, seq, domain, value}`, then
`{type: "snapshot.end", epoch, seq}`. All eight share one core-lifetime UUID
epoch and the current model delta number. Composing another snapshot does not
advance that number. A client commits the replacement model only at the matching
end marker. With `numbered-deltas`, the live model stream begins immediately
after that marker; `subscribe` is idempotent. With `snapshot` alone the existing
subscription request still enables subsequent events. The [connection events filter](#connection-events-filter) can be replaced on the same connection. A `subscribe` received
during snapshot preparation takes effect after the snapshot transaction finishes.

| Domain | Value | Maximum UTF-8 JSON frame bytes |
| --- | --- | --- |
| `tracker` | `levels`, `ladder`, kind `prefixes` | 65,536 |
| `items` | `items`: explorer summaries, latest verdict of each kind and its original round | 1,048,576 |
| `sessions` | merged `rows`, compatibility `processes` and `presence`, `archived`, `roles`, `crew`, `coordinator`, `verification` queue | 1,048,576 |
| `topics` | `topics`: open/waiting plus closed topics updated within the last seven days (inclusive) | 1,048,576 |
| `inbox` | current inbox sections, including `needsYou` | 1,048,576 |
| `events` | first `events.list` page: `rows`, `before`, `more` | 1,048,576 |
| `accounts` | registry path/error and accounts with current limits | 262,144 |

`SNAPSHOT_LIMITS` in `hub/src/protocol.ts` owns the domain caps; byte counts include
the envelope. Suite history, covers and full item verdict histories stay out;
`task.view` retains verdict history. Accounts and the journal page are prepared
asynchronously before composition. Journal revisions detect writes during the
read and retry up to three times. All model gathering, frame-size validation and
snapshot writes then run synchronously in one loop turn, without an intervening
frame on that connection.

Overflow is checked for every domain before the first snapshot frame is sent.
The hub logs it and sends
`{type: "snapshot.refused", code: "frame-too-large", domain, bytes, limit}`.
Preparation errors or repeated journal changes instead send
`{type: "snapshot.refused", code: "unavailable", message}`. Both keep the
connection usable; the client falls back to individual reads. An accepted
feature in the welcome alone does not prove a completed snapshot.

### Numbered model deltas

Every committed model publication, including tracker `task` changes, passes
through the core's single emit point. A client accepting `numbered-deltas`
receives the usual event fields plus `{epoch, seq}`: the first delta after its
snapshot is `snapshot.seq + 1`, then each following delta increments by one.
All clients share the same sequence within that epoch. The epoch changes when
the core restarts. Request results, welcome, snapshot frames and keepalives do
not consume numbers; future binary streams stay outside the model sequence too.
Without `snapshot`, `numbered-deltas` starts at the current live stream.
A reconnecting client adds `resume: {epoch, seq}` to its hello, where `seq` is
its last **applied** model delta (or completed snapshot). This requires
`numbered-deltas`. The welcome still accepts `snapshot` and `numbered-deltas`.
A covered cursor in the current epoch suppresses the initial snapshot: the hub
replays exactly `seq + 1` through its current number in the negotiated full or
slim shape, then sends live deltas. The subscription is established before
catch-up writes; live changes are held until replay finishes.

The in-memory ring retains at most **15 minutes** of deltas and **4 MiB** of
UTF-8 JSON across its distinct full and slim representations. It records deltas
while no clients are connected too. The oldest entries are evicted at either
bound; a cursor immediately before the oldest retained number is still covered.
An empty interval at the current number is covered. A future number, an evicted
interval or a different epoch requires a fresh snapshot. A hub restart creates a
new epoch and an empty ring, so a resume across a restart takes a fresh snapshot.
Only model deltas enter the ring: results, welcome, snapshot, `resync`, keepalive
and future binary stream frames stay outside it.

An existing connection can send `{type: "resume", id, epoch, seq}` with the same
rules. It replaces that connection's model subscription, completes replay or the
fallback snapshot, then answers with a normal result containing `{replayed,
epoch, seq}`. Wait for the current snapshot/replay transaction before requesting
another resume. If catch-up is unavailable and `snapshot` was not negotiated,
the hub sends `{type: "resync", reason: "snapshot-required"}` and holds model
output; reconnect with both features to obtain a snapshot. Snapshot refusals
retain their documented fallback to individual reads.

A featured connection whose next model frame would take its unsent transport
queue past **4 MiB** gets `{type: "resync", reason: "queue-limit"}` instead.
The transport queue is also checked after writes to account for framing overhead.
That ends its model stream, leaving the socket and request/reply path open. It
emits only one resync until the client explicitly resumes. Model output remains
paused even after the queued bytes drain. After draining, the client sends
`resume` with its own last applied number, or reconnects with `hello.resume`.
It may receive catch-up or a fresh snapshot if retention no longer covers it.
Unsent bytes come from the WebSocket's `bufferedAmount` or the Unix/stdio
writable queue; snapshots and replay share the same model output limit.
Neovim's hello has no features and its existing frames are unchanged.

`inbox`, `presence` and `verification.queue` replace their whole domain.
`message`, `delivery` and `event` append (an event's `replaces` retains its existing
coalescing semantics). Item, topic, process, account and artifact rows update by
their stable identities. A `task` with `item: null` removes that item.
The verification queue is pushed when its holder, remote holders, waiters or
other queue facts change, never for elapsed run/wait time or a decreasing ETA.
`suite.queue` reads still return current timing.

With `slim-frames`, `task` carries the changed item and a `layers` map containing
only entries that changed since the preceding model state. Changes in the active
release can update other items' layers; a null layer removes a deleted entry.
A title-only edit normally has `layers: {}`. The all-items layer map remains on
legacy `task` frames. A pin or mute on a featured connection sends a `visibility`
frame with `rows`: affected topics, presence (`sessions`), processes, retained
thread messages and artifacts (including artifacts inheriting a topic choice).
Replace these rows by id,
including messages already loaded from older history pages; do not append them.
Affected history is selected through indexed keyset pages before attachment
resolution. Topic choices also follow artifact references across threads when a
file has moved into a folder in that topic. Message keys are deduplicated and
limited before their bodies are decoded. Each chunk carries at most 100 rows, targets 256 KiB and always stays
within the 1 MiB wire cap; a single oversized row refuses the request. The hub
yields between pages and flushes current projections before yielding, so a
concurrent choice cannot be followed by buffered rows with an older projection.
The request result follows the final chunk. Inbox replacement continues on its
ordinary coalesced publication. Legacy-only choices do not traverse history.
Unfeatured clients retain their bare `visibility` notification and existing
frame shapes. Each model frame is projected once and its JSON serialization is
shared by every receiving connection with the same negotiated feature set on
the Unix socket, stdio and both WebSocket edges.

`node hub/scripts/measure-snapshot.ts /path/to/project/.cland/tasks` copies the
tracker into a disposable root, seals HOME/XDG/Git and provider/account variables,
and reports bytes per domain plus five compose/framing samples. It never opens
the source tracker database or runs Git. Other domains use empty/default scratch
state and are labelled accordingly. Setup, copying and transport are excluded.

## Human last looks and read marks

The project currently has one human identity. Every authenticated browser cookie,
Unix UI and stdio UI reads and updates that human's marks; a cookie or connection
never gets its own copy. The `topics` snapshot includes `marks`:
`{ events: string | null, plans: Record<string, string>, imported: boolean }`.
`marks.get` returns `{ marks }` for clients using individual reads. `marks.set`
accepts an optional `events` ISO timestamp and/or `plans` mapping item IDs to plan
history receipt IDs, and returns the complete `{ marks }`. Both frames are
human-only, including on the web; there is no agent tool or CLI command for them.
A changed mark emits a `marks` replacement delta, with the usual model sequence
and replay guarantees, and a legacy push for Neovim. Marks persist in the hub's
SQLite store and survive reopening it.

An events timestamp only increases. Plan receipts are opaque IDs ordered by the
hub's plan history, including publications with identical timestamps; older
receipts cannot replace later ones. The map uses canonical `T-<number>` keys so
legacy and current item prefixes refer to the same plan. Normal writes reject
unknown receipts. Topics keep their existing `topic.read { topic, upTo? }` act:
`upTo` is a message ID (absent means the latest); `Topic.readSeq` exposes the
highest durable message number read. A later older read cannot decrease it.
The topic replacement and its authoritative unread count reach all clients.

Neovim first reads the shared marks, then imports legacy `events.last_look` and
`plan_seen` from `.cland/ui.json` with `marks.set { import: true, ... }`. The hub
merges forward and records `imported` in the same durable write. Only the first
import applies; retries and stale copies cannot overwrite current marks. An
import may preserve a receipt whose history has already been retained away,
without replacing a known newer receipt. After the acknowledgement Neovim
removes the legacy keys atomically, preserving filters, folds, current release,
other owners' preferences and existing pins/mutes. If the reply or local cleanup
is interrupted, the next start reads the durable receipt before retrying cleanup.

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
- Uncertain operational traffic does not reserve an idle session against new work. A received review or QA request keeps its pending verification reservation until a hold or verdict replaces it; both role routing and pool reuse respect that reservation, including across restart. Clearing it retries queued role requests immediately. An operational injection becoming uncertain also retries the queue, even if the session was already idle.
- Each delivery keeps the session id its addressee had when it was recorded (or when a role's queue was claimed), and an agent's message the session id it was sent from: a grant tied to a delivery (the mention rule) and a reply to a message follow the session, never a name another session may take later.
- A session no adapter launched (a spoke started by hand) has nobody to confirm a turn: its messages stay `delivered`.

## Topics

A topic is a thread in the human's chat with agents (spec 4.5, decision #7): an id, a title, a status, a `standing` flag, at most one bound item, creation and activity times. Every message belongs to one, and the `deliver` frame carries it as `"topic":{"id":…,"title":…,"item":…}` (`item` only when bound; the spoke shows them as `topic`, `topic_title` and `topic_item` on the channel event).

- **General** (`general`) and **Agents** (`agents`) are created at the project's first hub start and are standing: renaming, deleting or closing them is refused. The system creates no other topic.
- **Creation.** The human creates a topic from the UI (`topic.create`) or shell (`cland topic create <title> [--item T-n]`), an agent with that CLI command or the `topic.create` tool (the Coordinator any topic, an Implementer only one bound to its own item: the permission table below); a title is required (at most 200 characters). The id is `topic-<n>`. `item` binds the topic to a unit of work: the item must exist and be open, and has one topic at most, so a second `topic.create` for it is refused with the topic it has (`T-1 already has a topic: "…" (topic-1); one topic per unit of work: write there`). The binding is written into the item's file (`topic: topic-1`) through the tracker. A hub with no project has no tracker and refuses a binding; a blank `item` is refused, not taken as none. `task.link --topic` (the CLI's `cland task link`, the `task.link` tool) and `task.create` with a `topic` bind through the same rule: the topic must exist and not be standing, an item already bound elsewhere is refused (`T-1 already has a topic: …`), and so is a topic bound to another item (`topic-2 is already bound to T-1; one item per topic`); the item's file and the topic's `item` change together, and `--topic ""` (null) unbinds both. At start the hub reconciles the bindings with the tracker: a bound item closed while no hub ran (a hand edit, a pull) closes its topic and cancels its asks. A topic with no message yet is listed last (a task's topic appears with its first message).
- **Status** follows the direction of the messages (`src/hub/topics.ts`): a human message makes the topic `waiting for agent`; an agent's message to the human makes it `open` (a topic `waiting for human` stays so: an ask is answered by the human); a message from an agent the human's latest message addressed, to other sessions in the topic, answers that wait too (`open`); any message reopens a `closed` topic to the status its direction implies. `resolve` clears a wait back to `open` and withdraws the topic's open asks: the `resolve` tool (the Coordinator's, by the permission table) and the UI's `topic.resolve`; a closed topic has nothing to clear and is refused. The human closes a topic (`topic.close`), and closing its bound item (`task.close`, `task.edit --state closed`, a hand edit to `state: closed`) closes it; a message reopens the topic, never the item. An `ask` (#33) makes it `waiting for human`, and while any ask in it is open it stays so whatever else is written (below); closing cancels its open asks. Agents keeps `open`.
- **The warning.** While a message in a topic waits for a role nobody holds (a delivery queued under `@coordinator`), the topic carries `"warning":"no coordinator"` (`no reviewer`, … for another role). It clears when a session takes the role (its hello, or the human's `role.set`) and the queued delivery moves to it.
- **History pages.** Each `TopicMessage` carries `seq`, its durable number in the hub-wide monotonic message sequence, in history, live `message` events and `topic.send` results. Numbers are never reused after retention or topic deletion; gaps between a topic's numbers are normal. `topic.history {topic:"general", after:0, limit:200}` starts a forward traversal; use the last returned `seq` as the next `after`. To walk backwards, start with the latest page and pass its first `seq` as `before`. Numeric cursors are exclusive non-negative safe integers; supply only one of `before` and `after`. Every page is oldest first and contains at most 200 messages (default 50): `after` selects the earliest matching rows above the cursor, `before` the latest below it. Empty pages end the traversal; a message inserted between reads is available on a later forward page. Agents filters apply before the page limit. With neither cursor, the existing latest-message selection and ordering are unchanged. String `before` still accepts a message id in the same topic for the Neovim archive reader; an unknown id returns an empty page. `events.list` retains its independent cursor. This uses the existing `messages.seq` and `(topic, seq)` index: upgrading an already numbered store needs no new schema migration, backfill or whole-table rewrite.
- **Agents history filters** (T-56). `topic.history {topic:"agents", item:"T-12", session:"impl-12", limit:200}` searches the whole retained record before taking the latest matches (oldest first, at most 200). Either filter may be omitted; together they intersect. An item matches exact values in notice `detail` naming the item or its currently bound topic (claims, releases, worktrees, merges, agent-message references). A session matches the sender, resolved addressees, or session-bearing notice facts (`session`, `from`, `to`, `by`, `pair`), including arrays such as a mute's pair; harness, role and rule metadata do not name sessions. Message text is not searched; `T-1` does not match `T-12`. The spoke's `history {topic:"agents", item:"T-12", session:"impl-12"}` accepts the same filters (default 50 matches); other topics refuse these filters.
- **Unread.** The human's unread count per topic is the messages from others since the human last read it: the UI sends `topic.read` when the thread is in view, and a message the human writes reads what came before it. It never moves back. The watermark is a message's place in one monotonic sequence the store keeps (`counters.message_seq`, `messages.seq`), never a rowid: retention emptying the table does not make new messages read. The sequence starts above every stored seq and every watermark, so a file an older hub left (watermarks migrated from rowids, its messages pruned) hides no new message. Every `message` delta carries the authoritative `topic.unread` and `topic.lastMessageAt` alongside its topic reference, including human messages (which read the preceding messages). Replace these values rather than incrementing a local counter. `topic.read` publishes a `topic` delta with the new count and retained last message time; snapshots and `topic.list` provide the initial values. Agents have no unread concept.
- **The human** writes through the UI (`topic.send`), into any topic but Agents: Agents is read-only, a record of what agents send each other, and a `topic.send` there is refused unless it is a reply: with `replyTo` naming an agent's message in Agents, the reply is recorded there and addresses that message's sender, found by the session id it wrote from, so a sender renamed since is still reached (a hub notice has no sender to answer). The message addresses `to` when given, else its mentions: `@coordinator`, `@implementer`, `@reviewer`, `@qa` reach the role's live holders, `@<session-name>` that session (a session the hub knows); with no mention, the Coordinator. `@all` and globs stay text for the human; a mention that names no session and no role is reported as `unknown` and addresses nobody. Each address counts once, with or without its `@`. The addressed party answers with `send` and the topic's id, so the reply lands in the same topic. A party other than the Coordinator may answer the human there (no `to`) while the human's latest message in that topic was delivered to it, by its name or its role (see Permissions); elsewhere it writes to the Coordinator.
- **A role, for the human**, reaches its live holders only: a holder that went offline is not an addressee (it was replaced, or will take the role again on its hello). With no live holder the message is queued under the role, and the first session to take the role (its hello) gets it, also a session that was already addressed by name in the same message (one delivery, one ack). The stage stays `queued` until that session acks. One role may have several holders: all of them are reached. The sender is `human`, a reserved name.
- **A session** writes with `send`: `to` accepts `string | string[]`, such as `"coordinator"` or `["coordinator"]`; a string becomes a one-element array. Other shapes (including null and arrays with non-string entries) fail with `to must be a string or an array of strings` before permission routing. With no `to` or `to: []` the message is for the human, in the given topic or General; with `to` it goes to sessions and is recorded in the given topic or Agents. A role reaches its live holders, or, with none connected, the offline holders the hub remembers (queued for them); a role nobody ever held answers `empty`.

The process view (`session.list`, `hub.status.harnesses` and `session.process`) carries `holds`: the claim (`role: "item"`) first, followed by verifier holds (`role: "review"` or `"qa"`) newest first. Each verifier hold includes its durable ISO `heldAt` timestamp; claims have no hold timestamp. Connected presence carries the same work facts. The view can also carry `pending: { item, kind: "review" | "qa" }`, captured when the session accepts a message whose first line is `review request <id>` or `qa request <id>` (including epic stage requests). IDs resolve by number with any kind prefix. Unknown items are ignored. A newer request replaces pending work; a hold on that item, the session's verdict on it, or stop/death clears it. Pending work survives hub restart, is stored at delivery acceptance, and is never reconstructed by reading message history. Hold and pending changes publish a changed process view at most once per tick.

The sessions snapshot also supplies `rows`: one hub-merged `SessionRow` per process or connected unmanaged session. Each row has a stable `key` (session id, or `name:<name>` for an unknown identity), the process facts, current `presence` or null, hub-held role, `launched` and `live`, account and usage. `item` selects the first claim/hold, then an accepted pending request, then the launch item. `itemKind` is `item`, `review`, `qa` or null; `additionalHolds` is the +N count, and `itemRequested` distinguishes a request from held work. Verifier holds are newest first. `stateSince` is the ISO transition time for computing the state's age without timer-only deltas (null when unknown); `approvalCommand` carries the command it waits on and clears when the state changes.

Clients negotiating `snapshot`, `numbered-deltas` or `slim-frames` receive `session.row {key, row}` replacements after subscribing. A burst of presence/process/work changes publishes each changed complete row once; unchanged rows consume no additional delta. A null `row` removes that key when it leaves the projection. Snapshots and row deltas use the same composition. Existing `session.list`, `hub.status` and their process/presence events remain available; clients using merged rows ignore those compatibility events for their row model. Numbered row deltas participate in the normal epoch, sequence and resume ring.

A lead's `review request T-n` addressed to `reviewer`, or `qa request T-n` addressed to `qa`, in Agents or the item's topic resolves to one live verifier. The hub prefers the item's current holder or latest request/authenticated verdict writer, then a free live holder. Verdict affinity follows durable hub write order and identity, independent of copied or reordered item comments. Free holders have no item holds, pending delivery or pool handoff and are idle (or have no adapter state). A bare spoke has no adapter to confirm injection, so its accepted deliveries count as complete for staffing; managed sessions still wait for adapter confirmation. The outcome includes `resolvedTo` with the selected session name.

With no eligible verifier, the outcome is `queued`, its reason says it is waiting for the next free live verifier, and `resolvedTo` is absent. The request and its attachments stay in the topic's durable history, and its topic warns `waiting for free reviewer` or `waiting for free qa`. The hub retries in request order when holds release, delivery acceptance/injection completes, a session becomes idle or reconnects, and during queue maintenance. Selection retains the same affinity rules and reaches one session; a busy earlier request does not block unrelated eligible work. Selection and its sender notice commit together. The sender receives a `verifier-request` notice in the request topic naming the selected session. The queue and sender identity survive hub restarts and renames. Wait for the notice instead of resending; if no verifier is live, report the staffing blocker to the supervising lead so one can be launched.

Selection rechecks the sender's role, send permission and item ownership. A closed/removed item, closed topic, lost authority, hygiene refusal or expired queue (24 hours by default) drops the pending delivery and sends an explicit refusal notice with the reason and retry rule. Named recipients and ordinary role messages keep their usual addressing behavior.

`send` accepts `kind: "progress" | "report" | "question" | "decision" | "request"`; an omitted kind is `report`, and other values are refused. Reports, questions and decisions use the normal turn-starting delivery path. Progress notes stay `queued`, start no turn, and reach each recipient as one ordered digest with its next ordinary delivery. A reconnect's role clause leaves progress held. The digest carries each note's sender, message id, topic and attachments, followed by the triggering delivery, in one harness input on Claude Code, Codex and OpenCode. A message to the human is recorded immediately, whatever its kind.

A `request` is addressed only to the human: omit `to` or give `[]`, set `request` to `review`, `qa` or `handover`, and set `subject` to a known item (`T-n`), artifact (`A-n`) or session name. Any session, whatever its role and without a human mention, may send one. Other message kinds retain their permission rules. A request defaults to General or the named `topic`. Addressees, missing/unknown subjects, invalid request values, and `request`/`subject` on another kind are refused with the fix. Request first lines are never parsed; `review request T-n` addressed to a verifier retains the separate crew routing convention.

```json
{"kind":"request","request":"review","subject":"T-12","text":"Please review the build","topic":"topic-12"}
```

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

### Answered ask outcomes

An answered `AskCard` also carries `outcome`, both in the live `ask` event and on
later `topic.history` pages. Its shape is
`{status: "answered", text: "<full answer>", option?: n, by: "<answerer>", at: "<ISO time>"}`.
`option` is 1-based and absent for a free answer; `text` is the chosen option's
text or the trimmed free answer, including every line. `by` is `human`, the
self-declared stand-in name, or the answering agent's name; forwarded decisions
preserve a recorded stand-in. `at` is the answer time. The outcome is stored on
the ask, independently of the reply message, and survives hub restarts. Existing
`answer`, `option` and attribution fields stay available. Legacy rows without a
stored outcome omit it. The outcome union also reserves
`{status: "declined", reason: "<reason>", by, at}` for declining; this slice does
not add a decline action.

A human ask records its inbox wait atomically at creation, even before a client
or journal projection first reads the inbox. When an answered ask leaves the inbox, its `InboxDeparture` has
`reason: "answered"` and the same `outcome`. The next coalesced `inbox` event
includes `inbox.departures`, the rows settled since the preceding publication,
so clients can fold a row in place with its answer before archiving it. Explicit
`inbox.list` reads do not consume these pending departures. Subsequent events
omit `departures` unless more rows settle. Ordinary lists and initial snapshots
contain current rows; `inbox.list {archive: true}` retrieves the durable outcomes
in the seven-day archive, including after reconnect or restart. The client
chooses how long to retain a folded row. Departure outcomes also reach the
`inbox-departure` journal record and survive reply-message retention.

Answer origin is stored on the ask card and answer message as `answered_as: human` or `answered_as: stand-in` with `answered_by: <name>`. `cland topic answer <ask> 2 --as cland-impl` (or `--text "..." --as cland-impl`) declares a named stand-in; without `--as` the human shell records `human`. The trust model is self-declaration in the human's shell, which already has human authority: the label is not an authenticated hub session or a new role. Names use the session-name grammar. Every known hub session, Aides included, remains refused by `topic.answer`; a session's own shell identity takes precedence over `--as` and cannot be relabelled as human. The UI/frame equivalent supplies `as: {name: "cland-impl"}`. Supplied `answered_as` fields are not trusted.

`ask.answer` relays preserve the forwarded answer's `answered_as` and `answered_by`, with `relayed_by` naming the lead returning the decision. Agent decisions without a forwarded human answer have no human/stand-in attribution. The origin survives hub restarts, appears in `topic.history`, spoke/channel answer metadata and `ask-answered` journal entries. `task view` shows answer origins from the bound topic (`item.answers` in JSON, containing `ask`, `answer` and attribution); these are hub state, separate from item frontmatter. Legacy asks without recorded origin stay unattributed.


Sessions use `send` kind `request` with no `to`, a `request` of `review`, `qa` or `handover`, and a `subject` naming an item, artifact or session when they ask the human for that action. Any role may send a request; routine information uses `report`. These instructions live in the default role clauses and the project's `.cland/roles.toml`, which cland never rewrites. Running role sessions adopt changed clauses on their next launch; relaunch them after updating project clauses.

The **inbox** (v0.1.2 §3.7, `InboxNow.dc.html`) carries four now sections, newest first within each: asks and command approvals, plan approvals, requests, then messages. Every row has its waiting start (`since`, also `ts` on asks/messages/requests); the approval carries `command` when the harness reported one.

| Section | What feeds it |
| --- | --- |
| `asks` | The open asks: `{"id","topic":{"id","title","item"?},"question","options","free","from","label","ts"}`. |
| `approvals` | Launched sessions (the process table) in `waiting for approval`, plus a connected session reporting it: `{"session","label","harness","since","attach"}`; one row per session id (a launched session that renamed itself shows under its new name, with its launch's attach command). The hub does not answer them (spec 4.3): the attach command opens the harness's own prompt. |
| `plans` | Open epics with a valid plan whose approval is pending under `[plan] approval = "human"`: `{"id","subject","title","since","layer":"now"}`. No row under approval `none`. |
| `requests` | Unsettled explicit request messages: `{"id","from","fromRole"?,"request","subject","topic","text","ts","since","layer":"now"}`. |
| `messages` | One row per now message addressed to the human, excluding progress, hub events, asks and requests. A waiting topic without an open ask contributes its latest eligible message. Each row carries `id`, sender/role, subject, topic, text, `ts`, `since` and layer. |
| `waiting` | Topic metadata for older clients about topics waiting without an open ask; it no longer contributes to needsYou separately. |

`needsYou` is the sum of now asks, command approvals, pending plans, open requests and now messages. `inbox.list`, pushed `inbox` events and `hub.status` agree. The workbench chip uses this count; the workbench and CLI render the four sections. Informational notifications appear only in the events view and never count, even when a project override raises them to `now`. A not-clear verdict and a session death appear there as warnings (D17). See [visibility classification](../docs/visibility.md). Human pin/mute choices use `visibility.set` (`surface: topics|sessions|artifacts`, `target`, `mode: pin|mute`), persist under `visibility` in `.cland/ui.json`, and publish a `visibility` invalidation event. They apply in the shared classifier to history, snapshots, live frames and now counts; session callers cannot set them. Preference writes are async and serialized with resumed-request measurement. Hub and Neovim share a nonempty directory lock at `ui.json.lock`; recovery removes only the dead owner's unique file, so a replacement writer is preserved. Uncertain PID owners remain held. Retention never removes an open ask or its message, or a waiting inbox request/message, whatever its age; an answered, withdrawn or cancelled ask goes with its message. Deleting a topic (its asks go with it) and a prune both publish the inbox again. `hub.status` carries it as `needsYou`, so the top bar shows it without computing.

Rows leave by these rules:

- Ask: answered, withdrawn or cancelled (`answered`, `withdrawn`, `cancelled`).
- Command approval: the session stops waiting (`approved`).
- Plan: approval in the plan view or `task plan approve` (`approved`), epic closure (`closed`), or a plan that stops being valid (`invalidated`).
- Request: a human reply to it, any later human message in its topic, or a human review/QA verdict on its subject item (`replied`); `inbox.decline` settles it as `declined` and sends its author one hub notice naming the request. An agent verdict does not settle it; reading the topic does not settle it either.
- Message: `inbox.read` for that single id or `topic.read` past its id (`read`), or a later human message in the topic (`answered`).

Each departure passes through the existing log tap as `{"event":"inbox-departure","kind","id","subject","since","ts","reason","text"}`; `text` is its first line. `hub.db` stores departures, individual read marks and topic read watermarks, so restarts keep settled rows gone, waiting requests counted and offline decline notices queued. Even a request answered before the first coalesced tick receives one `replied` departure. `inbox.list` always includes `archiveToday` (rows left since local midnight); with `archive: true` it also includes `archive`, departures in the last seven days, newest first (insertion order breaks equal timestamps). The timestamp-indexed range query reads the stored departures rather than scanning the journal; saved first lines survive message retention. Earlier departures fall back to retained message text when available. `cland hub journal --json` also exposes the leave reasons. Full inbox recomputes stay coalesced; live events projection shares one snapshot per tick.

| Request | Result `value` |
| --- | --- |
| `{"type":"topic.answer","id":…,"ask":"<ask id>","option":2}` or `"text":"…"` | `{"message":TopicMessage,"outcomes":[…]}` |
| `{"type":"inbox.list","id":…}` | `Inbox`: `{"asks","approvals","plans","requests","messages","waiting","needsYou"}`. Response rows carry their classified layers before the hub compares inbox publications, so a pin/mute publishes new placement even when `needsYou` stays unchanged (T-235). |
| `{"type":"inbox.list","id":…, "archive":true}` | `Inbox` with `archive`: rows carry `kind`, `id`, `subject`, first-line `text`, wait start `since`, departure time `ts`, `reason`, and an answered ask’s `outcome`. |
| `{"type":"inbox.decline","id":…, "request":"<message id>"}` | `Inbox`; human-only. Declines one waiting request and queues a named hub notice to its sender, including an offline sender. An unknown or already-left id is refused by name. |
| `{"type":"inbox.read","id":…, "message":"<message id>"}` | `Inbox`; human-only. Marks only that waiting message read; other messages in its topic keep their rows and unread counts. An unknown or already-left id is refused by name. |

| Command | What it does |
| --- | --- |
| `cland inbox [--json]` | Four now-layer sections, in order: asks and approvals, plan approvals, requests to you, messages to you. Nonempty headers carry counts; rows are newest first, uncapped, with id, subject/topic, first line, sender and waiting age. Plans show their title and stage/lane/item counts. The final line is `needs you: <n>`. `--json` prints the unchanged hub frame. |
| `cland inbox --archive [--json]` | One line per departure in the last seven days: time, kind/id, subject, first line and reason, newest first. `--json` prints the full archive frame. |
| `cland topic create <title> [--item T-n] [--json] [--as <name>]` | Opens a topic through `topic.create`, optionally binding it to the item. Prints `created <topic id>: <title>`; `--json` prints `{topic: Topic}`. The shell retains its session identity and role permissions: an Implementer may open only its own item's topic. Refusals print `cland: <error>` with exit code 1. |
| `cland topic answer <ask id> <option number> [--as <name>]` | Answers an ask with its option n (1-based): prints `answered <ask id> in <topic title>: <the answer>`. |
| `cland topic answer <ask id> --text "<free answer>" [--as <name>]` | Answers an ask with a free answer (refused when the ask takes options only). The hub's refusals (an ask that is not open, an option out of range, a free answer to an options-only ask) print `cland: <error>` with exit code 1. |

Inbox asks include optional `fromRole`; command approvals include optional `role` and `command`. Pending plan rows include `title`, `stages` (number of stages), `lanes` (total lanes across stages), and `items` (total planned item entries). Requests and messages carry their sender's `fromRole` and `topic` reference (id, title and optional bound item), plus `since`, the persisted beginning of the wait. Clients use `since` for waiting ages and retain unknown metadata from older hubs as unknown. The Neovim client caps each section at five rows with an explicit fold; the CLI prints every row. `waiting` remains as topic metadata for older clients. Notifications are journal records in the [events view](#events-view), outside the inbox. Legacy `inbox.dismiss` and `inbox.dismiss_all` requests are refused with a pointer to `events.list`.

Subscribers get `{"type":"inbox","inbox":Inbox}` whenever a response section or archive count changes (an ask, a command approval, a pending plan, a request or a message), coalesced to one per turn of the event loop and only when it differs from the last one sent. Informational idle records go to the events view. The idle threshold is `[inbox] idle_minutes` in `.cland/config.toml` (default 30; `CLAND_IDLE_NOTIFY_MS` overrides it, for tests); the clock starts at each transition to `idle`.

## Roles

A session holds at most one role: Coordinator, Lead, Implementer, Reviewer, QA or Aide (spec 4.4, v0.1 §3.3). On a project's hub the role is the hub's state, not the session's (ADR 0001): the human assigns and revokes it, or a launch for the role grants it. A hub with no project (`createHub` in tests) takes a hello's role as declared and delivers no clause.

A Coordinator launches a Lead with `session.launch {"name":"lead-1","role":"lead","item":"T-12"}` (CLI: `cland session launch lead-1 --role lead --item T-12`). The node must be an open container named in `[tracker] levels` (epic or release by default; category and other additional root kinds are led by the Coordinator and cannot have Lead sessions). The hub runs the Lead at the project root, sets `process.item` to the node and takes its durable claim; no task branch or worktree is created. One Lead holds a node, and a Lead claims at most one node. Concurrent launches reserve the node before spawning, and a failed claim stops the new harness. An existing Lead claim must be released before replacement; stop alone retains the claim for resume. A Coordinator or human claim may yield to the launch. Human UI/CLI callers retain their unrestricted access; every agent caller must be the Coordinator, even when another role’s permission file grants `session.launch`, including a name already assigned the Lead role.

Lead scope is checked from the live container claim, stable session identity and current item ancestry on both spoke and CLI requests. Reparenting or releasing a claim changes admission immediately; launch, stop and merge recheck after asynchronous preparation and before mutation. A stopped session is managed according to every open claim or verifier hold it serves; when it has no holds, its launch item supplies the binding. Shared verifiers serving another subtree cannot be stopped by this Lead. Unbound launches/stops, other-node sessions and outside-subtree review/QA request lines are refused with the claimed level and node in the typed `forbidden` response and Agents notice. Releases, sync, push and unscheduled merges remain at the root; extra Lead grants cannot widen these boundaries. Use `item` on a verifier launch to bind its work; legacy Coordinator verifier launches with `cwd` still work. Existing projects apply the exact role-file edits in [T-178 handover](../docs/agents/T-178-handover.md); `cland update` preserves project roles.

`@lead T-12` addresses the nearest lead on that node’s chain (skipping the sender’s own claims), and bare `@lead` addresses the Lead role. The epic row and item fields show `lead-1 [Lead]`; the sessions panel shows its node. Leads are non-exclusive at the role level, so different nodes may have separate Leads. Existing role files inherit the new built-in role when `[lead]` is absent; `init` writes the stanza in new projects. Lead defaults match the Coordinator’s launch defaults. Leads may launch Implementers, Reviewers and QA with an explicit `item` in their live claimed subtree, stop sessions through their own CLI shell, request review/QA and merge scheduled descendant tasks through the ordinary verdict and criteria gate. Leads hand over their claimed node with `role.handover`; planning follows the epic plan.

Aides work for the human alone and may run concurrently. The default crew clauses state that an Aide speaks for the human, decisions included: its messages are the human's instructions within the recipient's role. Existing projects add that line to the Coordinator, Implementer, Reviewer and QA clauses in `.cland/roles.toml`; cland leaves that file alone. Address them by session name: role tags (including `@aide`), `all` and globs exclude both live and offline Aides. Agents notices and asks do not reach them. `@lead T-n` may select an Aide through its item claim or inherited subtree ownership; otherwise it selects the nearest claiming Implementer, container Lead or the Coordinator. Aides may write to the human in any topic, edit the tracker in full through the eight §3.3 tools, and create or promote artifacts. On the human's word they launch, stop and resume sessions of any role, the Coordinator first of all, through `session.launch` or `cland session launch | stop | resume` in their shell. The Aide says what it will launch before doing it; during a build the Coordinator keeps the crew's staffing, so the Aide launches only when the human asks. These shell calls carry and audit the Aide's own identity. They cannot ask, resolve, merge, hand over roles, release, sync or `cland push`. Refusals name the Aide rule in v0.1 §3.3, amended by v0.1.4 §3.5; extra permission grants cannot override that boundary.

Existing projects receive these session grants through the v0.1.4 one-time migration. A running Aide needs a hub restart and relaunch to refresh its launch-fixed role tools.

When the human tells an Aide to take a task, `task.claim` returns its branch and worktree and moves the status to `in progress`. The Aide works in that path; a claim does not change a running harness's cwd. It becomes the item's lead, so human `@lead T-n` mentions and verifier reports addressed to `lead T-n` reach it. Commit and push the task branch to the local territory (`origin`), then set status `review` and report to the Coordinator by session name. Independent review and any required QA pass through the same merge gate; the Aide claimant cannot supply its own verdict, even after changing roles. The supervising Lead, Coordinator or human merges through the gate. Launch with `--item` takes an Implementer’s item or a Lead’s open epic or release; Reviewer/QA launches bind to the item and its worktree without taking the Implementer claim.

When a session becomes an Aide, pending broadcasts and explicit subscription notices from its previous role are dropped, including digest members. Deliveries addressed by name (or its claimed-item lead, including default events) survive; named progress bound to a discarded broadcast waits for the next direct delivery. Addressing provenance is recorded per delivery. Rows written before that provenance existed cannot establish a direct address and are dropped on an Aide transition, apart from the role clause.

### Reloading project configuration

Commands editing human-owned config or settings preserve untouched bytes and
validate the whole candidate with the consumer's startup or launch parser before
one atomic write; refusal leaves the file unchanged. Bootstrap, migration,
doctor and launch share one exported source for defaults and writable keys.
Test missing, explicit-default and legacy values separately.

`cland hub reload` and SIGHUP validate `.cland/config.toml` and `.cland/roles.toml`
and publish one last-good pair. A parse, validation or restart-required error in
either file retains both old snapshots, journals `config-reload-failed` with the
file and error, and makes the CLI exit nonzero. Successful reloads name the applied
settings. `cland hub status` shows the loaded time and the last commit touching
config.toml (`config.loadedAt` and `config.sourceCommit` in JSON; null without Git
history). Uncommitted edits may be loaded; the source commit identifies the file's
Git history, not a claim that those edits were committed.

The following settings apply live: `verification.executor`, `budget` (still capped
at one local run), `remote_budget`, `local_fallback`, `load_gate_workers`, `shards`, `cache_max_age_minutes`, `lifetime`,
`run_timeout`, `daily_spend_usd`, the `verification.droplet` table, `keys.layouts`,
and role definitions. Work that has started keeps its snapshot; anything that starts after the reload
uses the reloaded config. A queued job has not started. The scheduler persists the
snapshot at admission, including lease lifetime, spend policy and run timeout, so
a restart mid-run retains it. Explicit executor choices remain explicit; queued
requests using the default executor take the reloaded default. Reloading
capacity changes future queue admission without ending active runs. Leases already
issued retain their deadline; existing launched harnesses retain their launch
parameters. New launches use the loaded role defaults. Droplet cap reads now use
the loaded snapshot too: a config-only edit takes effect after reload, including
in `cland executor status`.

The role file retains its 500 ms auto-refresh and refresh before launches. A role
edit validates and publishes the entire pair; config-only edits wait for an
explicit reload or SIGHUP. A failed pair stays in force until a corrected role
edit or explicit reload succeeds. Running role clauses are delivered on the next
assignment or reconnect as before.

Startup settings require a restart: `project.name`, `tracker.levels`,
`tracker.fatal_stall`, `inbox.idle_minutes`, `plan`, `sessions`, `artifacts`, `hygiene`, `visibility`, and
`verification.lock_path`, `workers`, `test_timeout`, `stall_timeout`,
`coverage_max_age`. Their owners establish storage, policies, timers, compatibility
locks or candidate-runner settings at startup. Changing any of these refuses the
whole pair with a restart-required error naming the field. Candidate worktrees
retain their own worker and test limits, captured at suite submission.

An absent config file at startup uses built-in defaults. If config.toml is deleted
while the hub runs, reload and role refresh keep the last loaded config and accept
valid role edits. They report `config.toml missing; keeping the last loaded config`
as a warning. Absence never silently resets a running hub to defaults. An invalid
existing file still rejects the whole pair.

The human may reload through the CLI. The Coordinator's CLI also needs the
`hub.reload` grant in `[coordinator.permissions] tools`; `cland init` includes it
for new projects. Existing projects with an explicit tools list must add it.

### `.cland/roles.toml`

One table per role: `clause` (multi-line text), `skills` (list), `exclusive` (the Coordinator), `[<role>.launch]` with `harness`, `model` and `effort` (`""` is the harness's default) and how the launched session may act (`approval`, `sandbox`, `writable_roots`, `network`: below), and `[<role>.permissions]` `tools`, the permission list the hub enforces (see Permissions below; a role table without `tools` gets the built-in list). A role the file leaves out takes its default; an unknown role or a wrong type makes the file unreadable. The shipped mapping (when all three harnesses are installed):

| Role | Launch defaults | Permission policy | Skills |
| --- | --- | --- | --- |
| Coordinator (exclusive) | claude-code, `claude-fable-5-1`, effort `max` | `permissions = "auto"` | wayfinder, to-spec, to-tickets, triage, grilling, code-review, handover |
| Lead (one per node) | claude-code, `claude-fable-5-1`, effort `max` | `permissions = "auto"` | handover, merge |
| Implementer | opencode, a free model the server lists (`""`; pin one, e.g. `opencode/big-pickle`) | harness settings | implement, tdd, diagnosing-bugs |
| Reviewer | codex, `gpt-6.1-sol`, effort `high` | `never`; `read-only` | code-review |
| QA | codex, `gpt-6-astra`, effort `high` | `never`; `danger-full-access` | diagnosing-bugs |
| Aide (non-exclusive) | claude-code, the human's configured model (no `model` key; set one to override), effort `max` | `permissions = "auto"` | none |

`cland init` and a hub starting without `roles.toml` build the same template from installed executables: PATH, `CLAND_CLAUDE_BIN` / `CLAND_CODEX_BIN` / `CLAND_OPENCODE_BIN`, then `~/.local/bin` and `~/.opencode/bin`. An explicit override is authoritative. A role keeps its shipped harness when installed; otherwise it takes the first installed in Claude Code, Codex, OpenCode order. With none found, the shipped mapping is written and init reports the absence. Discovery never runs a harness or reads login secrets.

A role that moves gets `model = ""` and effort `max` on Claude Code, `high` on Codex, or empty on OpenCode. A role that stays keeps its shipped model and effort. Every generated Claude Code launch has `permissions = "auto"`; `skip` requires the human's explicit choice. Every generated Codex launch has `approval = "never"` and its role's sandbox: Reviewer `read-only`, Implementer and Aide `workspace-write`, QA, Coordinator and Lead `danger-full-access`. Coordinator and Lead need full access for cland's git refs, territory, network, hub sockets and session/worktree launches; QA retains the T-65 full-access policy. OpenCode launch tables contain no permissions, approval or sandbox keys.

The header records the canonical installed harness set, without machine paths. `isRolesTemplate(text)` in `src/roles/template.ts` checks exact bytes against the recorded build; edits, unknown stamps and older template versions return false. This lets setup conservatively recognise an untouched template. The parser's built-in fallback for omitted roles or keys remains the shipped mapping on every machine. Init/update preserve existing `roles.toml` and `crew.toml` byte for byte; new crew policy permits Aide sub-agents.

How a launched session may act is read from `[<role>.launch]` at each launch, and again at a relaunch (`session.resume` with `relaunch`). Policy belongs to the role: Codex and Claude Code inherit it even when the role's default harness is OpenCode (model and effort apply only to the role's default harness). The Codex adapter applies it as a sandbox (The Codex adapter, below). A launch on OpenCode ignores approval, sandbox and permissions and keeps OpenCode's own configuration (The OpenCode adapter, below). Claude Code uses its own permission settings and the `permissions` launch key.

| Key | Values | Meaning |
| --- | --- | --- |
| `approval` | `never`, `on-request`, `untrusted`; `""`: the adapter's default, which is `never` too (as with no role) | Whether the session stops to ask the human before a command its sandbox refuses. With `never` nothing waits on the human: the command fails and the session goes on. |
| `sandbox` | `read-only`, `workspace-write`, `danger-full-access`; `""`: the harness's own | What the session's commands may write: nothing; the session's cwd and the temp dir; or anything (no sandbox). |
| `writable_roots` | a list of directories, relative to the project root; needs `workspace-write` | More writable directories. One that holds a `.git` directory is writable with it, and with the session's own git directory when that lies there (a worktree's `.git/worktrees/<name>`): this is what lets a session in a worktree commit. |
| `network` | `none`, `local`, `full`; needs a sandbox | `local`: Unix sockets under the project's `.cland/`, the session's cwd and the temp dir, and loopback, so `cland` reaches the hub and tests start their own hubs; every other host is refused. `full`: the whole network. |
| `permissions` | `skip`; `""`: the harness's own settings | Claude Code only: `skip` launches (and relaunches) the session with `--dangerously-skip-permissions`, so it never stops at a permission prompt or an auto-mode classifier. OpenCode maps `skip` to allow-all rules, subject to the item rule below; Codex ignores it. |

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
| `{"type":"role.handover","id":…,"to":…,"note":…,"then"?:"implementer"}` | `{"session":RoleHolder}` | spokes whose role grants `role.handover` (Coordinator or Lead) |
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
| `cland role launch <role> [--harness …] [--model …] [--effort …] [--account …] [--permissions …] [--json]` | Saves the role's launch settings in `.cland/roles.toml`, applying from its next launch. Requires at least one launch flag; `--model ""` and `--account ""` use the harness's default. `--json` prints the raw result. |
| `cland role list` | Each role with its launch defaults and holders, and the coordinator or `no coordinator`; `--json` for the raw value. |

### Handover

A role moves between sessions as hub state, never as a transcript (spec 4.4, ADR 0001, decision #10). The Coordinator hands its own role over with the spoke tool `role.handover {to, note, then?}` (Coordinator and Lead tables grant it); the human moves a role with `role.set` and a `note` or `move: true` (a plain `role.set` of a Coordinator someone holds is still refused).

- **A Lead hands over one node.** `role.handover {to, note, then?}` moves its live container claim with the original claim time. The receiver must be known and unclaimed, and cannot be the root Coordinator. Other Lead nodes, their notes and claims stay independent. Default subscriptions and `@lead T-n` routing follow the new claim immediately; explicit subscriptions remain with the sessions that created them. Pending question endpoints move with the role. Lead handover records belong to nodes and replay pending claim transfers on restart. Existing projects apply [T-180's exact role-file changes](../docs/agents/T-180-handover.md).
- **The human moves a Lead node** with `role.set` naming `role: "lead"`, `item: "T-n"` and a note or `move: true`; the CLI equivalent is `cland role set next lead --item T-n --note-file note.md` (or `--move`). Naming the node avoids choosing among unrelated Leads. A plain Lead role assignment does not take a node claim.

- **The note** has four sections, each non-empty: goals now, work in flight, open decisions, waiting on. It is an object `{"goals_now","work_in_flight","open_decisions","waiting_on"}` or Markdown with those four headings (any level, any case). It is mandatory for `role.handover` and optional for the human. A note that misses a section is refused, naming it: `{"ok":false,"error":"handover refused: the note has no \"waiting on\" section — …","code":"note-incomplete","missing":["waiting_on"]}`. The `handover` skill (`.agents/skills/handover`) drafts it.
- **The receiver** must be a session the hub knows for `role.handover`: live, or launched by the hub and running. It may hold another role (it is replaced: one role per session). The human may name any session, as with `role.set`. Coordinator exclusivity holds: a third session holding it refuses the move.
- **The move** is one store transaction: the previous holder loses the role (or becomes an Implementer with `then: "implementer"`), the receiver takes it, the role's record (the note, who moved it to whom, when, the chain of holders, and the tracker claims to move along) is written in `role_state` in `hub.db`, and both Agents notices are recorded; all of it lands or none does. The claims the previous holder held (by session id) live in the tracker's tables: right after the commit they are re-pointed to the receiver's session id from the record, which is then cleared; a hub that died in between does it at its next start (the move is idempotent). When the receiver is a name with no session yet (the human's `role.set --move` to it), the claims follow at that session's first hello. A transfer still pending when the role moves on again (that receiver never connected) is carried into the next move's record, so the first holder's claims follow the role to the end of the chain. `task view` shows the receiver. Everything runs in one synchronous step: no frame is read between the checks and the last event.
- **The receiver** gets its clause with the note in one `role` frame, `{"type":"role","role":"coordinator","clause":…,"skills":[…],"note":{…},"from":"coord","message":{…}}`; the message text is the clause, then `Handover note from coord:` and the note as Markdown. The note rides with every later clause delivery to that holder (its reconnects) until the role moves again. A spoke that delivers itself adds `handover_from` to the channel event's meta.
- **The previous holder** gets the revocation, `{"type":"role","role":null,"reason":"handover","to":"next",…}` (`cland hub: coord no longer holds the role Coordinator (handed over to next). Stop acting as Coordinator…`; meta `reason`, `handed_to`), and every later call is refused `forbidden` as a session with no role. It stays connected until its next reconnect, which is refused (no role), as for any revocation. With `then: "implementer"` it gets the Implementer clause instead, headed `you handed the role Coordinator over to next: stop acting as Coordinator.`
- **The Agents topic** gets two hub notices: `coord [Coordinator] handed the Coordinator role over to next, with a handover note:` and the note (`the human moved the Coordinator role from coord [Coordinator] to next, with no note.` when the human did), then `next [Coordinator] took over the Coordinator role from coord.`
- **Subscribers** get `session.role` for the previous holder and the receiver (`reason` `handover`), and `role.filled` for the new Coordinator; `hub.status.coordinator` names it. The audit log records the call (`args.to`, the note only as `noteChars`; the human's as `role.set`).

**The role's state** is pulled on demand: `role.state` (a spoke reads its own role's; the UI any role):

```json
{"role":"coordinator","label":"Coordinator","holders":[RoleHolder…],
 "note":{"sections":{…},"markdown":"## Goals now…","from":"coord","to":"next","at":"…"},
 "handover":{"from":"coord","to":"next","by":"coord","at":"…"},
 "waiting":[{"topic":{"id":"general","title":"General"},"status":"waiting for agent","reason":"status","pending":1,"last":"…"}],
 "asks":[],
 "claims":[{"item":"T-1","title":"…","session":"next","sessionId":"…","claimedAt":"…"}]}
```

For a Lead, `role.state` returns its own holder, node (`item`), note, waiting topics and claim. On the UI socket, add `session: "lead-2"` to `role.state` when multiple Leads exist. Reconnects and renames preserve the node's note; a handover on another node cannot replace it.

After the human hands a node to an offline successor, `session.launch` with that claimant's name, role and `item` adopts the existing claim and attaches its default subscriptions. The claim keeps its original time and handover note. A different name or role is refused, and a live session of that name must be stopped before launching it.

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
| Coordinator | `send`, `ask`, `ask.forward`, `ask.answer`, `resolve`, `topic.create`, `task.create`, `task.plan`, `task.edit` (assigning included), `task.close`, `task.claim`, `task.link`, `task.rank`, `task.criterion`, `task.comment`, `session.launch` (and `session.list`), `session.stop`, `session.resume`, `hub.stop` (the last three from its shell: The CLI in a session's shell), `role.handover`, `merge`, `release`, `sync` (release and sync from its shell only), `artifact.create`, `rename`, `who`, `history`, `status`, `task.view`, `task.list` |
| Implementer | `ask.forward`, `ask.answer`, `send:agents`, `topic.create:own`, `task.claim:own`, `task.comment:own`, `task.edit:review`, `task.criterion:done`, `task.plan:show`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| Aide | `task.criterion` (done and manage), `task.create`, `task.edit` (any status), `task.close`, `task.link`, `task.comment`, `task.claim`, `task.view`, `task.list`, `artifact.create`, `artifact.promote`, `send` (session names or topics), `topic.create`, `history`, `who`, `status`, `session.launch`, `session.stop`, `session.resume` (sessions of any role, only on the human's word; the Coordinator keeps staffing during a build), `task.import`, `push` (from its own shell) |
| Reviewer, QA | `send:agents`, `task.hold`, `task.comment:verdict`, `task.criterion:verify`, `task.plan:show`, `artifact.create`, `who`, `history`, `status`, `task.view`, `task.list` |
| no role | nothing (such a session is refused at hello; one whose role is revoked while connected is refused every call) |

`merge` uses the verdict gate below. `role.state` is no table tool: a spoke reads only its own role's state. `task.import` belongs to the human or an Aide (including from its shell). The keepalive (`ping`) and acks are not tool calls. A hub with no project (no `roles.toml`) checks nothing. The UI and the CLI act as the human, whom the table does not restrict, with two limits. A client's hello comes over the Unix socket or stdio only: on a project's hub, one over the spokes' WebSocket is refused (`unauthorized`), so the bearer secret a spoke holds makes no human. A CLI `task.*` call acting as a session the hub knows (`as` carries its `sessionId`, which decides before any name: `cland task` in a launched session's shell always sends `$CLAND_SESSION_ID`, whatever `--as` says; or the human's `--as` names a session that holds or held that name) is that session's call: checked against the role the hub holds for it (never the frame's `role`), audited as it (`client: "cli"`), and its claims held by its session id.

A refused call is answered with a typed result, which the spoke hands the model as the tool's result (`isError`), and the hub posts a notice into the Agents topic, which the UI shows there:

```json
{"type":"result","id":"…","ok":false,"error":"forbidden: task.comment (Reviewer may only comment verdicts)","code":"forbidden","permission":"task.comment","role":"reviewer","reason":"Reviewer may only comment verdicts"}
```

`rev-1 [Reviewer] tried task.close T-12: forbidden (Reviewer may not use task.close)` (a hub message in `agents`, `from: "hub"`, addressed to nobody). `permission` names what was missing: `send:human`, `task.comment:verdict`, or the tool itself.

### Asks up the lead chain (T-179)

An item question uses `send` with `kind: "question"`, `topic` naming the item's topic and `to: ["lead T-n"]`. A question delivered to the next lead becomes a durable ask card with `to` naming that agent. It waits for that agent, appears in topic history, and stays outside the human inbox and its `needsYou` count. Ordinary reports and questions to other peers keep their existing send behavior. Without an item, send a question to `coordinator` in General. Agents is a traffic record and does not host ask cards.

The receiving lead calls `ask.answer` with `{ask: "<delivered msg_id>", text: "<answer>"}`, or `ask.forward` with `{ask: "<delivered msg_id>"}`. Forwarding copies the exact question into the same topic, links the new ask through `replyTo` and the original card's `forwarded`, and routes above the receiving lead's claimed ancestor. Each call advances one level, including an epic Lead followed by a release Lead. The Coordinator's forward creates a human ask; only that root role may use `ask`, even with custom permission grants. Repeated forwards and actions by another session identity are refused. The recipient identity survives reconnects.

A forwarded question remains open until the upper answer arrives and the receiving lead returns the decision with `ask.answer`. For example: Implementer → epic Lead → Coordinator → human; human answer → Coordinator; Coordinator answers the incoming forwarded question → epic Lead; epic Lead answers the original → Implementer. Each answer carries `answerTo`/`answer_to`. A lead cannot answer a forwarded question while its upper ask is open. The topic's `waitingFor` lists the party currently awaited, and its status stays `waiting for agent` until a human ask opens, then returns to the next agent when the human answers. Closing the topic/item cancels every open link; resolving withdraws them.

The default Coordinator, Lead and Implementer permission lists include `ask.forward` and `ask.answer`. Projects with explicit `[<role>.permissions] tools` lists must add both grants for those roles. The tools also enforce the incoming recipient by stable session identity. Role handover moves the actionable ends of open agent asks with the role, durably in the same transaction; the original messages keep their historical sender and addressees. An unseen successor's provisional endpoints adopt its real session identity when it binds, including retained aliases, before rename or another handover. Renames refresh the waiting party and card. If reparenting takes a receiving lead outside the item's ancestry, its forward is refused and leaves the ask open. Named questions to Aides remain ordinary sends, since Aides do not answer or forward ask cards. Neovim shows agent cards as waiting on the named lead, preserves them when reconciling the human inbox, and offers human answer keys only on human asks.

### The CLI in a session's shell

The adapters put `$CLAND_SESSION_ID` and `$CLAND_SESSION_NAME` in a launched session's shell (Claude Code and Codex; `$CLAND_ROLE` too where there is a role). With either set, every frame the CLI sends carries the session as `as`, the hub takes the call as that session's (by the id first; an id or a name the hub does not know is a roleless session, refused everything that needs a role, never the human), and the audit records the session with `client: "cli"`. What the call may do:

| Command | In a session's shell |
| --- | --- |
| `cland task …` | The session's, checked against its role as its own `task.*` tools are (The tracker, below). |
| `cland session launch`, `list`, `stop`, `resume` (with `--relaunch` or `--fresh` too), `cland hub stop` | Decided by the permission table: `session.launch` (which covers `list`), `session.stop`, `session.resume`, `hub.stop`. The Coordinator has all four by default: it launches the sessions, manages them from its shell and restarts the hub after a merge. A Lead may launch and stop within its live claimed subtree; the other roles are refused. From a session's shell `cland hub stop` signals the hub's process only after the hub accepted the request: refused, or unanswered, it exits 1 and signals nothing (the human's fallback to the signal stays). |
| `cland inbox`, `cland role list`, `cland hub status`, `cland worktree list` | Allowed: reading the hub's state. |
| `cland topic answer`, `cland role set`, `cland role clear`, `cland session attach` and `retry`, `cland hub unmute`, `cland worktree prune`, and any other frame (the UI's `topic.send`, `inbox.read`, …) | The human's alone: refused. |

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

## Rulebook

The project's rules live in the committed `.cland/RULES.md`. `cland init` creates
an empty file with the one-line header `# Project rules` and a high-water comment,
and preserves an existing rulebook. Each entry has this shape:

```markdown
## 3 One suite at a time
Scope: all
Date: 2026-10-14
Status: active
Origin: shell
Reason: concurrent suites contend for shared resources.

Run at most one full suite at a time; targeted single-file runs are free.
```

A rule is addressed as `rule 3`, never `R-3` (which names a release). Numbers
increase in file order and retired rules stay in the file, so their numbers are
never reused. A `<!-- cland: rule high-water 3 -->` comment after the header
records the highest number ever allocated. Adds use one more than the greater of
this mark and the highest number present, then update the mark. Keep this comment
when hand-removing an entry; resolve a merge conflict to the higher mark. A missing
mark falls back to the highest entry number; a mark below an entry's number logs a
`rules-counter-behind` warning on load. `Scope` is `all` or comma-separated role names from `roles.toml`.
`Date` is the date added or last edited; `Status` is `active` or
`retired YYYY-MM-DD`. `Reason` explains the rule; the paragraph after the fields
is its text. Origins identify where it came from: `message:<topic>/<msg_id>`,
`session:<aide-name>`, `shell`, `workbench`, or `memory:<path>` for migrated rules.

```sh
cland rule add "Run one full suite at a time." --scope all --reason "Avoid contention" --title "One suite"
cland rule add "Use the recorded brief." --scope implementer,reviewer --reason "Keep scope clear" --origin memory:/path/to/briefs.md
cland rule edit 1 --scope implementer --text "Check the verify queue before running a suite."
cland rule retire 1 --reason "Superseded by the scheduler"
cland rule list
cland rule list --all --role implementer --json
cland rule show 1
```

Every command accepts `--json`. Listing returns active rules by default;
`--all` includes retired entries. `--role` includes `all` and rules naming that
role. A shell edit preserves the number and origin and updates `Date`; session
tools and workbench edits keep their existing origin-update behaviour. Retirement
keeps `Origin`, records its date and appends its reason to `Reason`. Its own origin
is stored separately as an optional `Retired-origin:` line after `Reason` (the
`retired_origin` field in JSON). Show and list display both origins. Older retired
entries without this field remain readable.

The CLI acts as the calling shell's session, using the hub's held role rather
than a claimed role in its environment. The human's shell writes `Origin: shell`;
an Aide writes `Origin: session:<name>`. Either may explicitly supply
`--origin memory:<path>` for the seed. Other session shells are refused with
`forbidden`: Coordinators record rules through the rule tool from a human
message, and other roles propose rules to the Coordinator. Shell callers cannot
supply message, workbench or another session's origins.

The hub owns writes, serializes them, and replaces the file atomically. An edit
rewrites only its rule and the high-water mark, preserving every other entry byte
for byte. Before replacement it re-reads the source; if a hand edit or merge arrived
during the temporary write, the write refuses with a retry message and leaves that
edit intact. The hub
refreshes the file every 500 ms, like `roles.toml`, so hand edits and merges are
read without a restart. A parse failure is logged as `rules-unreadable` with its
line and reason; reads keep the last good rulebook, and writes refuse to overwrite
the malformed file until it is repaired. The protocol frames are `rule.add`,
`rule.edit`, `rule.retire`, `rule.list` and `rule.show`; writes return `{ rule }`
and listing returns `{ rules }` with every field.

Every role clause ends with **Project rules for your role**: active rules in scope,
in number order, as `rule <n>: <text> (reason: <reason>)`, or
`No project rules apply to your role.` The launch brief ends with the same list.
Retired rules are omitted. A reconnect rebuilds the clause from the current rulebook. The Coordinator and Aide keep their cache guidance at the start of the rules section in `roles.toml`; the hub places that section after staffing, skills and handover notes. The T1 guard in `hub/test/roles-clauses.test.ts` checks both shipped sources. A rendered base reply (with default staffing and the `pong: ` prefix) must keep 15% growth headroom below the 7680-byte reserve: at most 6528 bytes. The reserve remains 512 bytes below the 8192-byte send cap. Move procedures behind triggered skill/doc pointers while retaining rules and permissions inline. The fixed clause-headroom check covers only the base instructions: project rules can grow, and role-event delivery carries the complete section even beyond the send tool's 8192-byte cap.

The spoke exposes `rule.add`, `rule.edit`, `rule.retire` and `rule.list`.
Write arguments match the CLI (`number` for edit/retire), plus `origin`.
A Coordinator must supply `{ topic, msg_id }` naming the existing human message
that stated the change; missing, agent-written or wrong-topic origins return
`forbidden` with a reason. The stored origin is `message:<topic>/<msg_id>`.
An Aide's tool writes always record `session:<name>`. Other roles are refused
and propose rules to the Coordinator in their item topic. Every role can call
`rule.list` with optional `all` and `role`. Each tool edit or retirement records
its own authorized origin; ordinary shell edits preserve the existing origin.
A Coordinator or Aide records a stated rule with `rule.add`, never only in harness
memory; a memory repeating the rule names its number.

Each added, edited or retired rule (including a valid hand edit or merge) produces
one `rule` event row and a direct delivery to each running session in scope,
including Aides. No subscription is needed. The full rule text, scope and reason,
or retirement and reason, wait with `digest: turn` until the next turn; they never
steer a running turn or add a needs-you. Removing a role from the scope sends that
role the retirement form. Numeric event filters remain `1`–`9`; all ten kinds,
including `rule`, have palette filters.

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

**The journal** (spec 4.2, decision #13) is `.cland/journal.jsonl`: one JSON object per line, `{"ts":"<ISO>","event":"<event>",…}`, the hub log's own shape. It is a filter over the log closure every part of the hub logs through, so an event is journalled by being logged. It holds the domain events: `hub-started` and `hub-stopped` (written by the daemon at each start and clean stop), `config-loaded`; messages as metadata (`send`, `send-refused`, `human-send`: id, topic, sender, addressees, `bytes`, `replyTo`, outcomes; never the text); deliveries (`acked`, `injected`, `dropped`, `role-queue-claimed`); sessions (`hello`, `bye`, `rename`, `replaced`, `kick`, `refused-role`, `session-launched`, `session-model`, `subagent-launched`, `session-stopped`, `session-resumed`, `harness-exited`, `session-state`); roles (`role-assigned`, `role-cleared`, `role-clause`, `role-revoked`, `role-handover`, `coordinator-vacant`, `coordinator-filled`); topics (`topic-created`, `topic-status`); asks and the inbox (`ask`, `ask-answered`, `ask-withdrawn`, `ask-cancelled`, `notification`, #33); the tracker (`task-written`, `task-claimed`, `task-released`, `task-conflict`, `task-removed`); hygiene (`loop-breaker`, `unmuted`, `rate-limited`); and the audit records (`audit`, #30). The file is opened for appending: a restart adds a `hub-started` line after the last one and never truncates. A last line cut off mid-write (a crash) is ended with a newline before anything else is written, so it stays one unreadable line and every later record parses; a short write is continued until the whole record is out. `Journal.write(record)` enqueues a record that is not a log line. The process log, everything the hub says, stays in `.cland/log/hub.log`, through a separate ordered async append queue. The CLI and every transport use this same sink for ordinary events once serving. Startup, listener and orphan-sweep diagnostics and fatal logging errors retain stderr: a stdio parent can see why listeners failed to bind. Node writes file-backed stdio synchronously, so request-time audit and refusal events never use that sink.

**Session usage.** Each changed `session.usage` publication writes a `session-usage`
line with `session`, `sessionId`, the current store `role`, the session's launch
`item` (null without one), `harness`, `model`, `total` (`UsageCounts`, including
USD `cost` when reported), optional `rateLimits` (Codex's reported account share),
and `final: false`. Changing a claim or verifier hold does not change its charge
item. Claude Code's mod turn completions, Codex's token and rate-limit updates,
and OpenCode's steps use the same path. Publications remain coalesced to at most
one per second per session; equal totals and rate limits write nothing, even if
the latest turn or raw token report differs. Comparison keeps one snapshot per
session in memory and reads neither tracker items nor journal history. The first
publication after a hub restart writes again.

A successful stop, harness exit or relaunch's stop writes one `final: true` line
with the latest reported usage, including an update still waiting for publication.
A session that reported no totals or rate limits writes no final line. Repeating
stop on an already stopped session writes no second final line. Tokens or cost
absent from a report are unknown, rather than zero. Read the records and sum the
latest final totals for each cland session per role and launch item:

```sh
cland hub journal --kind session-usage --json | jq -s '
  map(select(.final)) | group_by(.sessionId) | map(last)
  | group_by([.role, .item])
  | map({role: .[0].role, item: .[0].item,
      totalTokens: ([.[].total.totalTokens] | if any(. == null) then null else add end),
      cost: ([.[].total.cost] | if any(. == null) then null else add end)})'
```

Taking the latest final per session avoids counting retained conversation totals
twice after a relaunch. Sessions still running have no final record yet. The cost
sum stays null if any contributing session did not report cost; Codex's rate-limit
shares remain on the records and are not summed as monetary costs.

Launch models are recorded without reading the tracker:

- `session-launched` names the launch's `session`, `sessionId`, `harness`, `role`, launch `item` when present, and `model` (null when not yet reported). Codex's `thread/start` response and OpenCode's selected model populate the record even without an explicit model. Every successful resume or relaunch writes its own launch record with the reported model.
- `session-model` carries `session`, `sessionId`, `harness`, `role`, `item` (null without a launch item), `model` and `source: "harness"`. When Claude Code's `SessionStart` hook or the mod's turn completion first reports a model absent at launch, one line records it. Every later changed model writes another line; equal reports write nothing. The process row retains the latest reported model across restarts. A fresh resume uses the model retained on its new launch; a model learned afterwards follows the same rule.
- `subagent-launched` carries the parent `session`, `sessionId`, `harness`, `role` and launch `item` (nullable), optional `agentId` and `agentType`, and `model`, or `"unreported"` when the start reports none. Claude Code reports `SubagentStart` (`agent_id`, `agent_type`, optional `model`); both start and stop hooks are installed asynchronously, and stop does not create a launch record. [Claude's hook reference](https://code.claude.com/docs/en/hooks#subagentstart) documents the start's identity fields; the reported `model` takes precedence, with a fallback to `tool_input.model` only when that same payload supplies it. Requested-model discovery across records is not performed. Codex app-server's `subAgentActivity` item with `kind: "started"` reports `agentThreadId` and the resolved `model`; start/completion notifications of that same activity create one record. Older servers report a completed `collabAgentToolCall` with `tool: "spawnAgent"` and `receiverThreadIds`; at turn end, that signal records its reported model (unreported if absent) only for children with no resolved-model activity. OpenCode v2 reports child `session.created` events with `parentID`, `sessionID`, optional `agent` and `model`; only children of the watched parent qualify. OpenCode's `session.step.started` also reports parent model changes. These are native signals, with no model inferred from a parent or configuration and no record when the harness sends no start signal.

`cland task view T-n` lists that item's recorded sub-agent models under usage; `--json` exposes them as `item.usage.subagents`, with parent session, launch identity, harness, timestamp and optional child id/type. The list is projected from the journal, including earlier hub lifetimes, and excludes other items.

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
event_limit_max = 120             # hub event deliveries one recipient may receive within the window, separate from messages (see Events below)
event_limit_window_minutes = 10
```

A refusal is typed, `{"code":"hygiene","rule":"size"|"rate"|"loop","until"?:"<ISO>"}`: the size cap and the rate limit refuse the `send` itself (the result's `error` and `refusal`; the spoke's tool answer carries both), the loop breaker refuses the outcome for the muted addressee (`outcome` `refused`, `reason`, `refusal` with `until`). When the breaker trips, both sessions get the `mute` notice (its `detail` is the refusal and the `pair`; a spoke shows `kind` and `detail` in the channel event's meta) and Agents shows it. Rate windows, pair counts and mutes persist in the `hygiene` table of `hub.db`, keyed by session id: a restart keeps a mute running. `cland hub unmute <a> <b>`, or the UI's `hygiene.unmute`, lifts a mute early and clears the pair's count.

## Per-user state

These files belong to the user and are shared by every project hub on the host,
including scratch QA and Implementer hubs. They stay outside the project's
committed `.cland/` state.

| File | Owner and contents |
| --- | --- |
| `~/.config/cland/accounts.toml` | The human maintains the harness account names, harnesses and directories or database paths; no secrets. An absolute `XDG_CONFIG_HOME` changes the base directory. `cland init` creates no registry. See [Accounts and limits](#accounts-and-limits). |
| `~/.local/state/cland/spend.json` | The hub maintains the primary executor spend ledger across projects: project, lease, run, size, cost reservations, settled cost and times; no token. `$XDG_STATE_HOME` changes the state base; `$CLAND_EXECUTOR_STATE` overrides the ledger directory for tests and disables legacy migration and write-through. See [leases, cleanup and spend](#leases-cleanup-and-spend). |
| `~/.cland/executor/spend.json` | Until explicit retirement, the hub reconciles this legacy ledger with the primary ledger and writes mutations through to it first so older project hubs still respect the shared cap. Retirement leaves these bytes in place and records a snapshot beside the new ledger; see [retiring legacy spend write-through](#retiring-legacy-spend-write-through). |
| `~/.local/state/cland-nvim/` | The workbench Neovim's own state, including `nvim.log` and restart snapshots. `$XDG_STATE_HOME` changes the state base. T-830 sets `NVIM_APPNAME=cland-nvim` to keep this separate from the hub's `cland/` state and clears an inherited `NVIM_LOG_FILE`. See [the Neovim launcher](../nvim/README.md). |

## Accounts and limits

### Registry and naming an account

The user-level registry is `$XDG_CONFIG_HOME/cland/accounts.toml` when
`XDG_CONFIG_HOME` is absolute, otherwise `~/.config/cland/accounts.toml`.
It holds account names, harnesses and paths only. Sign in once with each
harness's own command; cland never reads the files in an account directory.

```toml
[accounts.codex-b]
harness = "codex"
home = "~/.codex-b"                # CODEX_HOME

[accounts.oc-b]
harness = "opencode"
data_home = "~/.local/share/oc-b"   # XDG_DATA_HOME
# Or use db = "/absolute/path/opencode.db" for OPENCODE_DB, never both.

[accounts.claude-b]
harness = "claude-code"
config_dir = "~/.claude-b"         # CLAUDE_CONFIG_DIR
```

Names contain lowercase letters, digits and hyphens and begin with a letter
or digit. Each entry has `harness` and at most one path key belonging to it.
`~` expands to the user's home; every path must then be absolute. An entry
without a path names the harness default selected by the hub's environment;
at most one such entry per harness is allowed. Unknown keys, including
`token` and `api_key`, are refused. A missing registry means no accounts.

Pin a role in `.cland/roles.toml`:

```toml
[reviewer.launch]
harness = "codex"
account = "codex-b"
```

`account` is one registry name, never a list. `account = ""` or an absent key
uses the harness default. The role's account applies only to its configured
harness. `cland session launch rev-x --role reviewer --account codex-b`
overrides the role's account and chooses the account's harness unless
`--harness` was given. An explicit conflicting harness is refused.
With no effective account, Claude Code and Codex use the hub's existing environment; OpenCode uses cland's separate per-user database (below).
Both registry and role edits apply to the next launch without a restart.

### Processes and the saved environment

Every process an adapter starts or queries for a session, its attach command
and its idle limit polls use the selected account's environment.

The shared executor credential deny-list applies after account overlays to child
environments and before saved account entries become attach shell command text.
`DIGITALOCEAN_TOKEN` is excluded from both; account path selection and quoting
remain intact. The [scoped argv audit](../docs/executor-argv-audit.md) records the
fake-token reproduction and current-source checks. It does not identify the
historical npm process that exposed the credential.

| Harness | Registry path and process environment |
| --- | --- |
| Claude Code | `config_dir` → `CLAUDE_CONFIG_DIR`, for launch, relaunch (`--bg --resume`), `stop`, `agents --json` and named-account attach. Each directory owns its background supervisor, login, project trust and MCP state. |
| Codex | `home` → `CODEX_HOME`, for the app-server, version probe and attach. |
| OpenCode | `data_home` → `XDG_DATA_HOME`, or `db` → `OPENCODE_DB`, for the server and attach. The server drops inherited `OPENCODE_DB` and `XDG_DATA_HOME` before applying the saved selection. With no account, `OPENCODE_DB` points to cland's separate per-user database (below). |

Named Claude accounts remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and
`CLAUDE_CODE_OAUTH_TOKEN`; default sessions retain the hub's environment.
A default Claude launch also saves its effective directory (the hub's
`CLAUDE_CONFIG_DIR`, else `~/.claude`); default attach remains `claude attach <id>`.
The process table saves the account name and resolved environment. Relaunches,
hub-restart resumes and pool handoffs keep it even after registry or role edits;
a pool member on a different account is not reused. A running session stays
on its account. `cland session list --json` shows `account` (null when unpinned),
and the expanded session row places a named account after the model, for example
`Codex · gpt-6.1-sol · codex-b`. `session-launched` and `session-usage` journal
records include the account.

An unknown name refuses the launch and lists known names. A malformed registry
refuses named launches; unpinned launches still work. A missing directory refuses
with its path and sign-in command (`CODEX_HOME=<dir> codex login`,
`OPENCODE_DB=<dir>/opencode/opencode.db opencode auth login --standalone`, or `CLAUDE_CONFIG_DIR=<dir> claude auth login`).
For `db`, its parent directory must exist. Trust a new Claude directory once by
running `CLAUDE_CONFIG_DIR=<dir> claude` in the project. Failed launches name the
account, directory and remedy and are never retried automatically.

### Listing models

`cland models claude-code|codex|opencode [--account <name>] [--refresh] [--json]`
is open to every role's shell. The hub probes with the launch account environment,
using cland's own OpenCode database for an unpinned account. OpenCode uses the
server catalog, retrying its initially empty list for up to 10 seconds; Codex
uses a short-lived app-server's `model/list`. Claude Code returns the static
aliases `default`, `sonnet`, `opus` and `haiku`, labelled as static.

Text prints one id per line, marks the default, and names the source and age.
JSON returns `{harness, account, models: [{id, default}], source, probedAt}`
(`account` is null without a selection). The durable hub cache lasts 24 hours
per harness and account; `--refresh` probes again. A failed probe preserves the
cached list and its original age, or fails with the probe error when no cache
exists. An unavailable executable uses doctor's not-installed diagnosis.
In the launcher, C-n/C-p on the model field cycles the same hub catalog for the
selected harness and its role's account; an empty model keeps the launch default.

### Listing accounts and reading limits

`cland account list [--json]` reads the registry through the hub and is open
to every role's shell. JSON returns `{registry, error?, accounts}`; each
account has `name`, `harness`, `path` (null for a harness default), `variable`,
`windows`, `at` (the ISO reading time, or null), and `source` (null without a
reading). Text shows the windows, reset times, age and source session, for
example `codex-b  codex  /home/user/.codex-b  wk 19% ↻Sun, 04:03 · 2m ago (session rev-x)`.
A registered account with no reading shows `no reading yet`; OpenCode shows
`no limit data`, with `windows: []`, `at: null` and `source: null` in JSON.
Account listing is a CLI/frame operation, not a spoke tool.

Limits come from running sessions at no extra cost: Codex's
`account/rateLimits/read` and sparse `account/rateLimits/updated` notifications
(including `rateLimitsByLimitId` buckets), and Claude Code's `session.measure`
forwarded by the cland mod as `mod-measure` only when `rateLimits` changed.
The mod forwards `{at, rateLimits: [{kind, percentUsed, resetsAt}]}`, never
context or cost. Claude's status line has no per-model weekly window.
OpenCode supplies no limits; cland never reads tokens or calls usage endpoints.

Each window is `{id, label, usedPercent, resetsAt, windowMins?, severity?, scope?}`.
Resets are ISO times (Codex's epoch seconds are converted); optional duration,
severity and per-model scope are retained when supplied. Missing windows are
absent, never invented as 0%. Codex labels 300-minute windows `5h`, 10080-minute
windows `wk`, and other durations in hours or days; other Codex buckets use
their limit name. Claude labels `five_hour` as `5h`, `seven_day` as `wk`, and
retains other kinds. The hub assigns no severity or colours.

The hub stores `{account, harness, windows, at, source}` readings in `hub.db`
meta under `account-limits`. Keys are account names, or `default:<harness>`
for unpinned sessions; default entries with readings also appear in the list.
The newest reading by `at` wins across sessions, and restart retains its
original timestamp. `source` is `{kind: "session", session}` for these readings;
`{kind: "poll"}` identifies an idle harness poll. Updates share the existing
one-second usage coalescer, with no extra timer. Reading updates send UI subscribers
`{type: "account", account: <the list view>}` at most once a second per account;
limited marks and their lifts publish immediately.
Equal windows and source refresh age silently. A changed reading also writes
one `account-limits` journal record with `account`, `harness`, `windows`, `at`
and `source`, so the build's weekly spend can be read from the journal.

### Limited marks and launch refusals

A hard limit hit marks the account `limited: {since, reason, session, resetsAt}`
in account views and `account` events. Classification uses machine-readable
fields only: Claude Code's `StopFailure.error == "rate_limit"`, Codex's
`error.codexErrorInfo == "usageLimitExceeded"` on `error` or a failed
`turn/completed`, and OpenCode's `session.execution.failed.error.type ==
"provider.quota"`. Claude `overloaded` and `server_error`, Codex
`rateLimitExceeded`, and OpenCode `provider.rate-limit` make no mark.
Reaching 100% in a reading alone makes no mark.

Marks persist in `hub.db` meta under `account-limited`. Claude and Codex use
the latest full window's future reset; expired cached windows leave a new
hit held `until cleared` while the after-hit poll learns its reset; when several windows are full, the latest
reset keeps the account blocked until all have reset. An after-hit poll can
supply or confirm it. OpenCode has no reset: its mark says `until cleared`.
The hub journals `account-limited` and posts one warn notice in Agents, the
inbox and to the Coordinator, then calls `poll(account)` once under the
polling floor below. A repeated hit while the mark holds adds neither a
notice nor a poll. With a running Codex session the poll uses its live
app-server's `account/rateLimits/read`, without starting another process.

New launches, explicit relaunches and retained pool handoffs on that account
are refused before process creation, whether the account was explicit or
pinned to the role. The typed result has `code: "account-limited"`, `account`
and `resetsAt` (ISO or null), with text naming the account and local and ISO
reset time, or `until cleared`, and suggesting `--account`. The hub never
fails over, rotates accounts, picks another account or moves or stops running
sessions. Re-finding a live session after a hub restart remains allowed.
Only the Coordinator turns a refusal into an `ask` for the human, after reading
`cland account list`. It names the limited account and reset (or `until cleared`)
and lists the harness's other accounts with each window's current used share
and reset; unavailable data stays `no reading yet` or `no limit data`. The choices
are this launch on account X (`--account X`), the role pinned to X (edit
`[<role>.launch] account` in `.cland/roles.toml`, commit on `dev`, then `cland push`),
or waiting for the reset. Under D24 the stand-in answers this ask. A Lead reports
the account and reset to `lead T-<n>` in the item topic; it climbs to the Coordinator.
The Lead neither asks the human nor names a replacement account. The hub asks
nothing itself, and no session is instructed to switch accounts.

A timer lifts a mark at its reset, also checked at every launch. The human or
Coordinator may run `cland account clear <name>` to lift it immediately.
The Coordinator clears an OpenCode account after the human says its limit has
passed, or clears when the human asks.
Other roles receive an inline `forbidden` refusal for `account.clear`.
Clearing is a CLI/frame operation, not an MCP tool. A lift journals
`account-limit-lifted` with `by: "reset"` or `by: "hand"` and sends an account
event to remove the workbench's red limited line.

### Polling rules

Claude's session-state fallback runs `claude agents --json` at most once per
30 seconds per effective config directory, with one call in flight and one
schedule shared by watch, launch discovery and startup resume. Only directories
with watched live sessions are queried; idle directories are never queried.
The last attempt and snapshot persist across restarts. A logged-out directory
latches once, with one event and one human notice naming the sign-in command;
no polling or retry storm runs while latched. `claude auth status` and
`claude doctor` never run on a timer. See the [Claude Code adapter](#the-claude-code-adapter)
for the latch's recovery conditions.

Idle accounts (no running session by registry name or `default:<harness>`) are
polled at hub start and on a timer, at most once every 15 minutes. Last attempt,
completion time and failure backoff persist in `hub.db` meta under
`account-polls`, so frequent restarts cannot increase the polling rate.
Opening the sessions panel sends `account.poll` once per opening;
`cland account list --refresh` sends the same frame. These explicit refreshes
and the `poll(account)` limit-hit entry point use a five-minute minimum and
return the cached reading when it is younger. An after-hit read waits for
that minimum or failure backoff to expire; its pending request survives a
hub restart, and duplicate hits share the one read. Limit-hit polling may
read a running account; other triggers skip it. OpenCode is never polled.

The hub runs `claude -p "/usage" --output-format stream-json --verbose` with
`CLAUDE_CONFIG_DIR`, or a short-lived `codex app-server` with `CODEX_HOME` over
stdio. The Codex client sends `initialize`, then `account/rateLimits/read`
with `excludeResetCreditDetails: true`, and ends the process. Claude's
`usage_report.rate_limits.limits` supplies `session` (`5h`), `weekly_all`
(`wk`) and `weekly_scoped` (`wk <group>`, with scope and severity retained).
A newer session push wins over a delayed poll, including equal timestamps.
Polls run in disposable scratch directories under `.cland/run/accounts/`,
with no `CLAND_*` variables or inherited Claude auth variables. They never
run `agents --json`, `auth status` or `doctor` to read idle limits, never read
credential stores, and never call a provider endpoint from cland.

Each account has at most one poll in flight, with at most two across the hub.
A process has a 30-second bound; timeout and shutdown kill its process group.
Non-zero exits, a 429 or rate-limited answer, timeouts and unparsable readings
double the normal floor to 30, then 60 minutes (capped). Explicit refreshes
also respect this backoff. Success restores 15 minutes. Floors are measured
from completion, with the attempt saved before launch for crash recovery.
A signed-out answer sets `signedOut: true` on the account view, shows
`signed out` in the CLI and follows the same backoff; a successful reading
clears it. `account-polled` journals `{account, harness, ms, ok}` and
`account-poll-failed` journals `{account, reason}` with a fixed one-line reason,
never the harness's output. Tests may shorten timings with
`CLAND_TEST_ACCOUNT_POLL_FLOOR_MS`, `CLAND_TEST_ACCOUNT_POLL_MINIMUM_MS` and
`CLAND_TEST_ACCOUNT_POLL_BOUND_MS`; these never reach the harness process.

### Terms and account choice

The providers' terms prohibit rotating accounts or using multiple accounts to
get past limits; Anthropic's also prohibit third parties holding Claude.ai tokens.
The project's [accounts policy (§3.13)](../docs/spec/v0.1.2.md#313-accounts-and-limits)
sets this boundary. cland reads no token or
credential store, calls no provider usage endpoint itself, and reads limits
through the harness. It never rotates, fails over or chooses another account:
the human makes and authorizes any account choice.

## Not here yet

- **The rest of the human side.** Verdict event announcements come from hub-written verdicts; hand edits to an item's file do not announce them.
- **Roles, the rest.** The Coordinator's role requests come later. A handover's `waiting` reads the topics `waiting for agent` (#32), and `asks` the open asks its holders put (#33). The UI shows the role with the name and the "no coordinator" warning with the workbench shell (#25), from the frames and events below.
- **Claims.** A claim stays until released, forced or the item is closed; nothing yet releases it when its session ends.

## The cland CLI

Subcommands load lazily: `bin/cland.ts` imports only the command it dispatches.
Shared help text lives in `src/cli/usage.ts`, so help, version and noninteractive
no-command invocations load just that module and `version.ts`. Command modules
re-export their usage constants for existing callers. `test/cli-imports.test.ts`
uses a real-process resolve hook to guard the source-module counts (help and
version at most 10; task list and hub status within their measured budgets).
The guard is in the machine shard and also checks command import failures keep
their existing error lines and exit codes.

The root `package.json` owns cland's version. `src/version.ts` reads it for
`cland --version`, the spoke's MCP server info, hub discovery and every managed
mark. `hub/package.json` has no version. `CLAND_VERSION_OVERRIDE` is for tests
that simulate an update. A release bump is an ordinary commit merged before
the release's dry run; `cland release` does not write the version.

## cland setup

Run `cland setup [dir]` after `cland init`. It uses the current directory or the
explicit directory, refuses a discovered parent and HOME, and stops with
"run cland init first" when `.cland/` is absent.

When setup hands over to the workbench, it sets `CLAND_OPEN_SESSION=aide-1`
so the Aide's terminal opens in the centre once the hub lists it. `--attach`
attaches in the current terminal instead; `--no-aide` skips the handover.

Setup currently detects the project, then Claude Code, Codex and OpenCode, then
the installed harnesses' logins, then records the favourite harness and grants
project trust for every installed harness, in that order. Each line has `ok`,
`done`, `skip`,
`open` or `fail`, a detail and any fix. With no harness installed, all three
installers are `open`; with one installed, missing alternatives are `skip` with
an installer hint. A binary found only in an installer's folder explains that a
new shell is needed for PATH. A missing Claude Code or Codex login is `open`;
OpenCode's login is optional because its free model needs none.

For a missing harness in a terminal, setup shows its official user-level installer
before asking `Install <Harness> now? [y/N]`. A yes runs it in the same terminal,
then detects the harness again: found is `done`, still missing is `fail` with the
exit code and command to run by hand. A no is saved in `[setup] declined_installs`
in `.cland/config.toml`; later runs skip it with a `cland setup --install <harness>`
hint. `cland update` preserves this list and `cland config set setup.declined_installs`
accepts a list of harness ids (`claude-code`, `codex`, `opencode`).
`--install <harness>` clears its decline and runs the missing harness's installer
without asking, including without a terminal. A successful install rebuilds an
exact, unedited roles template for the installed set; edited files and a marked
favourite are preserved. Installer folders supplement setup's own PATH for later steps.

Without both stdin and stdout attached to a terminal, setup asks and launches
nothing. Installers and their associated writes need an explicit `--install`;
trust writes need `--yes`, and the favourite choice needs `--yes` or `--harness`.
`--json` disables questions and prints one object
with `root`, `version`, `interactive`, `steps`, `summary` and `next` on stdout;
narration and any explicitly requested installer's output go to stderr. It can
still install with `--install`, choose a favourite with `--harness` or `--yes`,
or write trust with `--yes`. `steps` uses doctor's `name`,
`verdict`, `detail` and optional `fix` fields. `next` is `cland setup` while work
is open or failed, otherwise `cland`. Exit codes are 0 when no step is open or
failed, 1 otherwise, and 130 for input cancellation at a question.

The favourite step offers installed harnesses in Claude Code, Codex, OpenCode
order, labels signed-out ones and asks no question when only one is installed.
`--harness <h>` selects an installed harness without a question; `--yes` takes
the first installed default. The choice marks `[aide.launch]` in `roles.toml`;
changing harness also clears its model and resets effort for that harness.
An already-marked installed favourite reports `ok` without a question unless
`--harness` selects another. Invalid roles are left untouched with repair guidance.

Trust asks no question in a terminal. It writes the real harness configuration
for this project's path: Claude Code's profile `.claude.json` under its lock,
and Codex's `config.toml` through a short-lived app-server whose process group
is ended afterwards. The launch profile and each account named by a role are
included. OpenCode has no trust gate. One `trust` line names the actual config
paths, says `done` after a write or `ok` when already trusted, and gives the
harness's own trust dialog as the manual fix after a failure. Without a terminal
and without `--yes`, missing trust stays `open` and no config is written.

`--yes` accepts defaults only for questions marked harmless and permits the
trust writes above, including with `--json`. It never authorizes installing
or signing in. Later steps will add login actions, accounts, hub and Aide.
They join the single ordered list in `src/setup/runner.ts` through `SetupOptions`.
Action steps must detect again after acting and let that detection decide their
result. `src/setup/terminal.ts` runs a child with inherited terminal I/O (stdout
redirects to stderr for JSON reports), ignores
SIGINT and SIGQUIT in the parent while the child runs, restores its handlers,
and returns the child's exit code or 128 plus its signal number.

## cland init and cland update

Successful `cland init` reports end with `next: cland setup`, including when every managed part is already current. Its `--json` object includes `"next": "cland setup"` beside `root`, `version` and `changes`. `cland update`, `cland init --undo` and refused init attempts omit the next step.

`cland init` seeds the open root categories Bugs, Tech debt, Follow-ups and Ideas through the tracker, using its shared numbering (C-1 through C-4 in a new project). An existing open root category with the same title is preserved. The report names each created category, or reports `unchanged` with "the four categories are present". When init makes the first commit, it includes the four item files. `cland update` does not seed categories. Init and `cland task migrate` share the same category titles.

If the project's `[tracker] levels` has no root `category` kind, including `levels = []`, init preserves that ladder, seeds nothing and reports "categories skipped: the ladder has no root category".

`cland init [dir]` prepares a project (`dir`, else the project around the current directory); `cland update [dir]` rewrites what cland manages there to the running version and refuses a folder without `.cland/`. Both need no hub, are idempotent and print one line per path they touched (`--json`: `{root, version, changes: [{path, action, note?}]}`, actions `created`, `updated`, `unchanged`, `kept`, `removed`). A file is written only when its bytes change, so a second `cland init` changes nothing, mtimes included.

Before writing anything, `cland init` refuses a shallow clone: `cland init: the territory needs the full history: run git fetch --unshallow, then cland init again`. Fetch the full history in that clone, then retry. `cland update` also refuses a shallow project that has a territory, with the same recovery command; projects without a territory can still be updated.

Managed files and blocks carry `managed by cland <version>`. A file or hook without that mark is the project's own and is reported as `kept`, except that the project's `.claude/settings.json` receives the cland hooks and managed `worktree.bgIsolation` key below. The curated skill set is the exception: cland's own skills and the upstream ones it keeps record their origins and cland's changes in their headers, while the manifest's mark and per-file SHA-256 hashes record each installed skill. Update decides on the whole skill: an untouched copy is refreshed, and a skill edited in the project is kept whole with its install hashes.

Nothing is written or removed through a symbolic link: every destination and each folder above it inside the project is `lstat`ed first, and a link among them leaves the path alone, reported as `kept` with a note starting `symlink:` (a managed skill file or folder, `AGENTS.md`, `docs/agents`, `.claude`, …). A write goes to a fresh temporary file renamed over the destination, so it never follows a link planted after the check at the file itself. The folders above it are pinned too: each one's device and inode is noted before the temporary file is created and compared again just before the rename, so a folder swapped for a link (or another folder) in between refuses the write (`kept`, `symlink:`) and the temporary file is removed. What remains, as Node has no `openat`/`renameat`: a swap in the instant between that second check and the rename, and a temporary file left in a folder moved away after it was created. `CLAND_TEST_INIT_WRITE_PAUSE_MS` with `CLAND_TEST_INIT_WRITE_PAUSE_PATH` (tests only) holds the write of that path still after its checks. The managed set:

| Path | Committed | How it is managed |
| --- | --- | --- |
| `.cland/.gitignore` | yes | The hub's own rule: rewritten while its first line carries the mark. |
| `.cland/config.toml` | yes | Written with the defaults; `update` rewrites it to the current template and keeps the values it finds. |
| `.cland/crew.toml` | yes | Staffing policy, written once with defaults; reloaded on change, keeping the last good version. |
| `.cland/roles.toml` | yes | Written with the defaults when missing, then the human's: never rewritten (`roles.toml` above). |
| `.cland/tasks/.gitkeep` | yes | A mark line. |
| `.cland/tasks/C-*.md` | yes | Init creates missing open root categories Bugs, Tech debt, Follow-ups and Ideas through the tracker before its first commit. Existing categories keep their bytes; update does not seed them. |
| `.cland/hub.db` | no | The General and Agents topics, created through the store as the hub would at its first start. |
| `.agents/skills/<name>/` | yes | The curated skill set: every skill of cland's own `.agents/skills/` (`skills/README.md`), read relative to the cland package. `.agents/skills/.cland-manifest.json` records each installed file's SHA-256. When all listed files still match and no file was added, `update` refreshes the entire skill, removes obsolete files and records the current hashes (`updated`, or `unchanged` if already current). A changed, deleted or added file keeps the whole skill: `kept`, note "edited in the project", plus "cland ships a newer version" only if cland's current copy differs from the install hashes. Kept entries retain those hashes across runs; undoing an edit makes a skill eligible for refresh again. A project copy equal to cland's current copy is `unchanged` and adopts its hashes. To take cland's version of an edited skill, remove the folder, then run `cland update`. A new skill is `created` unless a folder of that name already belongs to the project: that folder is `kept` and stays out of the manifest. Each kept skill has its own line and note in text and `--json`. Legacy manifests listing paths without hashes retain their earlier update behavior. The manifest is validated before anything is touched: the mark in `managed`, names `[a-z0-9-]+`, relative paths with no `.`, `..` or empty segment inside `.agents/skills/<name>/`, and hashes of 64 lowercase hex characters; an invalid one is `kept` and no skill is installed, updated or removed. |
| `.claude/skills` | yes | A relative symlink to `../.agents/skills`. When the project already has a `.claude/skills/` folder it is kept, and gets one symlink per cland skill (`../../.agents/skills/<name>`) beside the project's own. |
| `docs/agents/issue-tracker.md`, `domain.md`, `triage-labels.md` | yes | `skills/templates/docs/agents/*` with a first line `<!-- managed by cland <version>: … -->`. An existing file without it is kept and reported. |
| `AGENTS.md` | yes | A block between `<!-- cland:begin managed by cland <version> … -->` and `<!-- cland:end -->` (`skills/templates/AGENTS.block.md`): obey hub events, tasks through `cland task`, artifacts through the hub, sub-agents never use the hub. With a territory: `cland release` publishes versions; `cland publish` is the only out-of-release GitHub push, after a human approval ask; without one: pushes to GitHub only on the Coordinator's decision. Rewritten in place; appended to a file without it; the whole file when there is none. Text outside the block is never touched. |
| `CLAUDE.md` | yes | Never created (its presence stops Claude Code from reading `AGENTS.md`). An existing one gets `@AGENTS.md` under a mark comment, unless it imports `AGENTS.md` already. |
| `.claude/settings.json` | yes | The cland hooks merged in: one entry per event of the Claude Code adapter (`SessionStart`, `UserPromptSubmit`, `Stop`, `StopFailure`, `PermissionRequest`, `PostToolUse`, `Notification`, `Elicitation`, `SessionEnd`), `async`, after the project's own. Their command is `[ -n "$CLAND_SESSION_NAME" ] \|\| ! command -v cland >/dev/null 2>&1 \|\| cland hook <event> # managed by cland <version>`: `cland` from the PATH, no machine path, the mark as a shell comment by which `update` finds and replaces them. `worktree.bgIsolation = "none"` is also managed: Claude Code 2.1.143+ background sessions can edit the working copy without EnterWorktree, with reach controlled by cland's hub and roles. `update` restores `"none"`; a human can restore isolation in `.claude/settings.local.json`, which takes precedence and which `init` and `update` never read or write. Every other hook and setting, including `worktree.baseRef`, is kept, in its order; a file whose content does not change keeps its formatting byte for byte. A file that is not valid JSON is kept and reported. |

The project hooks are for a Claude Code session started by hand, and do nothing where `cland` is not on the PATH. A session the hub launches already gets the same hooks, naming its session and hub file, through `--settings`, plus the cland mod (`--plugin-dir`) and the spoke (`--mcp-config`); there `CLAND_SESSION_NAME` is set and the project hooks stand aside. The mod is therefore not provisioned into the project: it needs the session's identity, which only a launch has, and its path would be a machine path. Committed files never hold a machine path or the secret.

### Local git territory

In an empty folder or a folder with the project's own files outside any repository, `cland init` runs `git init -b main`. In a repository without commits, it keeps the unborn branch name (including `master`). Both receive `Initial commit: cland init`, with the managed paths listed in the commit body. A repository with history keeps its commits and index.

The first commit includes only files created by this run under `AGENTS.md`, `.cland/`, `.agents/`, `.claude/` and `docs/agents/`. Pre-existing files stay outside it, including an `AGENTS.md` or `.claude/settings.json` that init merges into, and pre-existing managed files it refreshes. Whether a future init should adopt previously managed files remains an open question. Human files keep their bytes and mtimes except for the documented managed merges. Human staged entries stay staged with their original blobs; Git's `commit --only` commits cland's paths and leaves them in the real index. Ignored paths are reported as `not committed: ignored by Git` and never forced in. `.cland/.gitignore` excludes volatile state.

When Git has no explicit `user.name`/`user.email`, `author.name`/`author.email` or `committer.name`/`committer.email` configuration and no author, committer or `EMAIL` identity environment variables, this commit uses command-local `cland <cland@local>` and the report says `as cland <cland@local>: no Git identity is set`. Git configuration files are never changed for this fallback; an explicit identity, including a partial one, is left for Git to validate. Commit hooks and signing are disabled for that command. Init seeds the territory's `dev` and default branch from the first commit and switches the root to `dev`, preserving untracked and staged human files because the source and destination commits are identical. The report names `.git` when created and the branch holding the first commit. Running init again makes no commit; `cland update` never creates a repository or a commit.

In a Git project, `cland init` creates the local bare repository `.cland/territory.git`, renames an existing `origin` to `github` (including branch upstreams), and makes the territory `origin`. Without an existing origin, it adds only the territory, including in a folder where init has just created the Git repository. If both `origin` and `github` already exist, it refuses before changing either: rename the existing `github` first. An unrelated repository already at the territory path is also refused.

All effective origin fetch and push destinations must point to the territory. Re-running init repairs extra URLs or push overrides on an existing territory origin; doctor reports them as failures. Git URL rewrite rules that still redirect the repaired URLs outside the territory are refused and must be fixed in Git config.

Init chooses the repository’s default branch before renaming `origin`: the target of `refs/remotes/origin/HEAD`, then local `main`, then `master`, then the sole local branch. An ambiguous repository is refused before writes, naming the branches and how to choose with `git symbolic-ref refs/remotes/origin/HEAD refs/remotes/origin/<branch>` or a branch named `main`. An unborn repository uses the branch of its first commit. The territory records this once as `cland.defaultBranch`; an older territory without the setting reads `main`. It creates `dev` from that default when absent and seeds the default and `dev` with a push to the local bare path, never to GitHub. Existing territory refs are preserved. The territory's `HEAD` points to `dev`, and so does the root's `origin/HEAD` (`dev` fetched from the bare path, then `git remote set-head origin dev`), so tools that branch from origin's default branch start from `dev`. One such tool is Claude Code's sub-agent worktrees under `worktree.baseRef: fresh` (decision D8). For a repository with history, a clean root on the default branch switches to `dev` before any managed files are generated; a dirty root, another branch or detached HEAD stays in place, with a reason in the report. For an unborn repository, init makes the first commit on its existing branch, then seeds `dev` from that commit and switches the root to `dev` while preserving human files and staged entries. All Git steps appear in text and `--json`, including `unchanged` on a second run. Report paths under `territory.git` include named operations (`remotes/origin`, `local-dev`, `root-branch`) as well as real files.

The root lives on `dev`: the Coordinator commits tracker and docs work there directly; task work reaches `dev` through `cland merge`; the default branch (`main` unless the territory records another) moves through `cland release` and `cland sync`. The territory's executable `update` hook reads `cland.defaultBranch` at run time (falling back to `main`) and refuses updates and deletions of that branch and `dev` without cland's marker, naming the protected branch and required commands. Task branches remain free, force pushes included. This is a workflow guard on a local repository, not a security boundary against its owner.

`cland init --undo [--force]` undoes only the territory step; managed skills, configuration and docs remain. It removes the territory origin and renames `github` back to `origin` only if init performed that rename, carrying upstreams back. If init switched the root to `dev`, undo restores the recorded original default branch when the root is still on `dev` and has no tracked changes; other or dirty branches stay put with a note. Git refuses any checkout that would overwrite an untracked file. The local `dev` branch is kept. Before any mutation, undo reads every destination in `remote.origin.fetch`, including custom wildcard and exact mappings, to identify the root tracking refs that remote removal will drop. It checks both those root refs (even without a territory copy) and every territory ref against objects reachable from surviving root refs: branches, tags, other remotes and HEAD. Symbolic aliases do not count as independent copies. If work would become unreachable, undo refuses and names the refs; preserve the work under a surviving ref or use `--force` to discard it. A dropped ref whose tip survives in another ref's history needs no force. Undo state is kept in the bare repository's `cland.*` config. Both undo and update rewrite the instruction block for the resulting presence or absence of a territory; update refreshes an existing territory but does not create one in an opted-out Git project.

The D15 migration interim ended when the repository moved its root checkout and task base onto `dev` after T-59. Task work now reaches `dev` through `cland merge`; only `cland release` pushes the default branch and a release tag to `github`. `cland sync` imports collaborators' work.

The module interface for later hub commands is small: `territoryPath(root)` gives the absolute bare path; `withTerritoryLock(root, () => ...)` holds synchronous or asynchronous operations exclusively across processes. A synchronous callback returns its value directly; a Promise callback keeps the lock until fulfillment or rejection and returns a Promise with the same outcome. Do not nest locks. `territoryGit(cwd, args, marked = false, input?)` runs Git without a shell, with a 30-second deadline, and returns trimmed stdout or throws; optional `input` supplies stdin (used for reachability traversal without a command-line size limit). Pass `true` only for a guarded cland operation's push to protected refs; it sets `CLAND_TERRITORY_WRITE=1` for the child. The marker is an accident guard: the local owner can set it manually or change/bypass the hook. The lock `.cland/territory.lock` uses the hub lock implementation (exclusive creation, stale-process recovery); an overlapping caller is refused with the live holder's pid and may try again after that operation settles. `provisionTerritory(report, root)` and `undoTerritory(root, force)` acquire it themselves; `territoryProblems(root)` is read-only. `defaultBranch(root)` reads the recorded default with a `main` fallback; async hub callers may pass their already-read, lowercased Git configuration map as its second argument to avoid synchronous Git. The task worktrees add `taskBase(root)`, `ensureTaskWorktree(root, {id, slug, branch})`, `listTaskWorktrees(root)`, `commitsAhead(root, branch, base)` and `removeTaskWorktree(root, item)`. They return Promises and run Git through `territoryGitAsync` (`execFile`, awaited), so the hub's event loop never waits on Git. The two that write take the lock themselves, through `withTerritoryLockAsync`: the same lock file, taken with `acquireLockAsync` (`src/hub/lock.ts`), which awaits its `ps` probes and asks the process's own start time once. The hub queues these operations one at a time (`src/hub/worktrees.ts`), because the lock refuses a second holder instead of waiting for it. Init runs these without a hub; worktree, merge, release and sync commands call this module from the hub under the same lock (T-20 decision D2).

Merge admission and batch preparation refuse a project root whose Git repository is
bare with `merge-bare: core.bare=true in project root <path>`. This is distinct
from the intentionally bare territory. Inspect the root's shared Git config and,
if it was accidentally changed, restore it with `git -C '<root>' config --local
core.bare false` before retrying. The hub never repairs it automatically. Linked
task worktrees share this config, so Git experiments must use disposable clones,
a scratch HOME/XDG/config and the sealed fixture environment after overlays.

### Task branches and worktrees

In a project with a territory, a task's branch and worktree come from cland, never from the harness (T-58; T-20 decisions D3, D7, D8):

- **A claim.** The first claim of an open item of kind `task` (`cland task claim T-12`, the `task.claim` tool, anyone's) creates the branch `t/T-12-<slug>` at the base branch's tip, the slug being the item file's (`T-12-fix-the-parser.md` → `t/T-12-fix-the-parser`), and the linked worktree `.cland/worktrees/T-12/`. The worktree is linked to the project's own repository, so it shares the root's objects and refs, and the territory stays `origin`. The hub writes `branch:` into the item and records a `worktree` notice in Agents (`T-12: branch t/T-12-fix-the-parser from dev and worktree .cland/worktrees/T-12 created for impl-12`; journal `task-worktree`). An item that already names a branch keeps that branch. Every later claim, including one after a release, reuses the branch and the worktree, and a worktree folder deleted by hand is made again on the same branch. The claim's result carries `worktree: {item, branch, path, base, createdBranch, createdWorktree}`. When there is no worktree, it carries `worktree: null` and a `reason`, and the claim holds all the same. Releases, epics, specs, questions, maps, closed items and projects without a territory get none (`T-1 is an epic: only a task gets a branch and a worktree`, `T-5 is closed: no worktree`, `the project has no territory (cland init makes one): no branch or worktree`). A Git failure gets none either, with the reason prefixed `no worktree:`.
- **The base branch** is the territory's `cland.taskBase` when set, else `dev` when the project has it, else the recorded default branch (`main` when absent; `taskBase(root)` in `src/territory.ts`). The override must name an existing local branch; `cland doctor`'s `territory` check fails when it does not. On cland's own repository the root stays on `main` until T-59 (T-20's comment of 2026-10-09, the D15 deviation), so task branches start from `main` there: `git --git-dir .cland/territory.git config cland.taskBase main`, removed with `--unset` once `cland merge` lands.
- **A launch with an item.** `cland session launch impl-12 --role implementer --item T-12` (the spoke's `session.launch` with `item`, the launcher form's `item` line) makes or reuses the worktree, starts the session with its cwd there, and only then claims the item for the session, by its session id. A Coordinator's or the human's claim is taken over (Agents: `impl-12 [Implementer] claimed T-12 (taken over from coord)`). Any other session's claim refuses the launch before anything starts, as does a Git failure while making the worktree, so the worktree always exists before its session. If another session takes the claim while the harness is starting, it keeps it: the launch is refused, naming the holder, and the session just started is stopped. A second launch for an item whose launch is under way is refused. `item` is for an Implementer: another role, or `item` together with `cwd`, is refused. A Reviewer or QA session meant to stand in the worktree gets `cwd`. An item that gets no worktree launches at the project root, with the claim and the `reason`. The result is `{process, claim, worktree, reason?}`, and the process row records `item` (the sessions panel shows the item beside the session either way, through its claim).
- **The worktree-creation refusal (D8).** A Claude Code session launched with an item gets a `WorktreeCreate` hook (synchronous, not `async`): `cland hook worktree-create --session <name> --launch <id> --worktree <path>`. Claude Code runs it in place of its own `git worktree add`, for `--worktree` and for sub-agents with worktree isolation alike. It exits 2 with `cland: impl-12 works in its own task worktree <path>; another worktree is refused. Work there (cd <path>), on its branch.` on stderr, which the harness shows. It also tells the hub (journal `worktree-refused`, a `worktree` notice in Agents). Only sessions launched with an item get it: the Coordinator's sub-agents still make their own worktrees, and so does any session launched without an item. Codex and OpenCode make no worktrees of their own.
- **`cland worktree list [--json]`** shows each worktree under `.cland/worktrees/` with its item, branch, the item's title and state, the commits its branch has that the base lacks, and the sessions whose cwd is inside it (connected spokes and running launched harnesses). From a session's shell it is allowed: it only reads.
- **`cland worktree prune [--yes] [--json]`** is the human's (refused from a session's shell with `forbidden: worktree.prune (only the human may do this; …)`). It lists the worktrees of closed items with their unmerged commits (those not on the base branch). It removes each worktree and its branch only after a `y` on stdin (`--yes`: all of them), and keeps one in which a session still stands or a launch for its item is under way. The item's state and the sessions inside are checked again under the territory lock right before each removal, so an item reopened, or a session that entered, while prune read Git keeps its worktree. Git's `worktree remove` refuses a worktree with uncommitted or untracked changes, and the failure is shown. Its first job on cland's own repository is the merged worktrees of T-48 and T-49.

The frames: `worktree.list` → `{worktrees: [{item, path, branch, title, kind, state, sessions, base, ahead}]}`, and `worktree.prune` → `{candidates}` with `dryRun` or no `items`, `{removed, failed}` with `items`.

### The merge gate

`cland merge T-12 [--json]` and the Coordinator spoke's `merge {item: "T-12"}` share one frame, `{"type":"merge","id":…, "item":"T-12"}`. The human may run it from their own shell. Implementer, Reviewer and QA calls, including their shell's CLI calls, are refused by the permission table and recorded in Agents.

Every acceptance criterion must carry both a `done` mark and a `verified` mark. A failed criterion refuses too. `criteria-incomplete` lists each incomplete criterion by id and text and says which marks it lacks; it moves no refs. A checked box alone supplies neither mark. An item with no criteria passes this check. `ready` uses the same check: adding an unmarked criterion or failing one returns a ready task to `in progress`; completing and verifying every criterion permits ready once the required verdicts are clear and current. Verification can come from a clear verdict with `--verified` or a separate Reviewer/QA `task.criterion verify` operation.

The human's `--override "reason"` bypasses verdicts and criteria together only for tracker and documentation changes: `.cland/tasks/**`, `.cland/RULES.md`, `docs/**`, `GLOSSARY.md`, files named `README.md` in any directory, and `qa/briefs/**`. The immutable merge candidate is checked against its task base; deletions and both sides of renames count. Any other path refuses with `merge-override-scope`, naming every disallowed file, before refs or the checkout change. Configuration files and skill instructions require review even when they are Markdown. When incomplete criteria are skipped, each merge validation records a `merge-criteria-overridden` journal event with `id`, `override` and `criteria` (the skipped ids, text and missing marks). These audit events describe the bypass even if a later scope or Git check refuses the merge. Sessions cannot override; conflicts and dirty touched files still refuse.

Before requesting the final review, the claiming Implementer marks every criterion done. When only done marks keep the item from ready, the hub sends one notice to the claimant in its item topic, listing the missing criteria and their `cland task criterion T-n done C<n>` commands. For the same claimant the notice repeats only when the missing set changes; deduplication survives hub restart. A replacement claimant receives its own first notice.

In-flight legacy items use this gate as well. Their checkboxes read as unmarked criteria; the refusal names their text and the migration path. The claiming Implementer runs `cland task criterion T-12 done C1` (the first criterion operation assigns ids in list order), reads `cland task view T-12 --json` for the assigned ids, then marks the remaining criteria done. The Coordinator, human or Aide may also mark done. A Reviewer or QA records a clear verdict with `--verified all` or selected ids. An old clear verdict without verification does not complete this migration. Keep the existing item and branch; no bulk body rewrite is needed.

Merges run one at a time in the hub's territory queue (shared with task worktree operations), under the async territory lock. The gate checks an open task with a branch, the latest hub-written review verdict, and, when the resolved plan policy has a non-none scope and `when: per-item`, the latest hub-written QA verdict. `task.view` exposes `qaPolicy` and `qaCriteria`, plus `qaSatisfied` for tasks: whether the latest durable hub QA qualifies under the gate's provenance, writer independence and freshness rules, apart from review and criteria completion. Missing or altered durable verdict comments make it false; later file-only headers do not replace accepted hub evidence. `task.view.merged` is true only for a closed task with a durable landing receipt on dev, matching stage closure; manually assigned done status cannot establish it. A landed task's criteria compare verification to the task head recorded in its durable receipt, retaining completed fractions after branch cleanup and restart. Active or reopened tasks retain live branch freshness checks. Tasks outside a plan take `[plan] qa_default` (none/per-item by default). Each must be clear, current, written by a session holding the corresponding role at write time, and from a session that does not claim the item. File-only headers and Coordinator rescue-run verdicts do not satisfy it. Selection follows durable hub write order; if any recorded verdict comment is missing or altered in the item file, `verdict-missing` names its run and commit rather than reviving earlier clear evidence. The role the writer holds now does not change its provenance. The gate refreshes branch tips and the configured task base asynchronously before reading the freshness cache; an unknown patch comparison refuses with `review-pending` or `qa-pending` until the background answer settles. No check command runs in the gate (D16). The retired `qa-required` label has no gate effect; `cland task plan migrate` converts labelled tasks under existing plans to per-item overrides and reports out-of-plan fallback ids. See [QA policy and migration](../docs/review-and-qa.md#qa-policy-from-the-plan).

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

### Root dev push

`cland push [--json]` fast-forwards the local territory’s `dev` to the root’s committed `dev`, under the shared territory queue and lock. The Coordinator commits tracker and docs changes on the root’s `dev`, then runs this command from its own shell; the human may also run it. During onboarding, the Aide commits the onboarding's work on root `dev` and publishes it with `cland push` from its own shell. Both roles need the `push` grant; existing projects with explicit `[coordinator.permissions] tools` or `[aide.permissions] tools` add `"push"` to the corresponding list. Implementer, Reviewer, QA and Lead shells are refused, even if their environment claims Coordinator. It has no spoke tool. Identity comes from the shell’s session id: sub-agents inheriting a Coordinator or Aide shell inherit its authority, so the responsible role performs this command itself.

Push uses the on-disk territory path and a pinned commit, ignoring configurable push URLs. It fetches objects without writing tracking refs or `FETCH_HEAD`, verifies a fast-forward, and never forces. A behind or divergent root refuses with the territory commits’ hashes and subjects. The root must be on `dev`; pending merge checkout/item completion, release or sync recovery must finish first. Dirty root work is preserved. Repeating a successful push is harmless.

Before publication, authorization, lock, inspection and fast-forward failures leave local and territory refs and the checkout unchanged. A rejected Git push also leaves them unchanged; repair its reported obstruction and retry. If Git loses the reply after acceptance, cland checks the pinned territory commit. If both the push reply and its confirmation fail, `push-outcome-unknown` exits 2, records a distinct outcome event, and names the pinned commit: publication may have occurred. Verify territory `dev` and retry `cland push`; this outcome makes no unchanged-refs claim. Verified refusal exits 1. Success returns `{dev, previous}`; record or lock-release failure after publication returns success with `followUp: {step, error}` saying `pushed; follow-up failed`. In that case dev has landed: repair the named obstruction (a retained lock may need removal once its owner has stopped) and retry to confirm publication without another commit.

`cland merge` refuses unpublished root `dev` before preparing a landing, with `merge-unpublished`, listing those commits and saying `run cland push`. It leaves the checkout, integration refs, item and claim unchanged. Publish explicitly, then retry merge; tracker commits are never silently included in a task landing. A configured task base other than `dev` retains its existing merge behavior.

### Release and sync

Only `cland release` pushes to `github`. Task branches and integration work stay on the local territory. These commands use the hub's queued territory operations, the async Git runner, and the territory lock; no synchronous subprocess runs on a request path.

Worktree operations target a single-user local project and refuse detected path or inode changes, with Git-only rollback of escaped creations; they are not atomic against another local process rearranging directories concurrently.
Escaped worktrees with dirty work or detached HEADs are kept for manual recovery; a branch that moves during rollback keeps or regains its worktree.

`cland release --item T-n [vX.Y.Z] [--dry-run] [--json]` sends a `release` frame with `item`, an optional `version`, and `dryRun`. It reads the release item's version (including SemVer prerelease/build suffixes), refuses a non-release item, a missing version, an explicit version mismatch or any open descendant, and previews the item's Notes, each direct epic's title and first Goal sentence, then the commit notes below. After successful publication and local/territory follow-up, the hub comments the tag and full commit on the release item and closes it; the next open release becomes current. Dry-run keeps the item unchanged.

`cland release vX.Y.Z [--dry-run] [--json]` keeps the version-based flow, with no tracker closure or item Notes. Both forms belong to the human or the Coordinator from its own shell with the `release` grant. Implementer, Reviewer and QA shells are refused even if their environment claims another role. There is no release spoke tool. The shipped `release` skill commits the tracker, previews from the release item, then shows the notes and version in an approval `ask` before publishing. The version comes from the human; an Aide or the human's named stand-in may relay a recorded version decision, never invent one. The Coordinator never delegates a release. New projects include the skill and grant in the Coordinator defaults; existing projects with explicit role lists add them to their own `.cland/roles.toml`.

Release and sync use the default branch (`main` unless the territory records another in `cland.defaultBranch`). Release pins GitHub's single configured push destination (multiple push URLs refuse) and fetches its default-branch objects without changing local tracking refs or tags. It refuses a missing/malformed version (the accepted form is `vX.Y.Z` with three nonnegative integers and no leading zeroes), an existing local or GitHub tag, no commits between the default branch and `dev`, no `github` remote, an in-progress Git operation, or the default branch checked out in any worktree. Keep the root on dev. If GitHub's default branch has commits dev lacks, the error lists their short hashes and subjects and says `run cland sync`. The local default branch must be an ancestor of dev. Refusals and dry-run move no refs. Dry-run prints the release notes and the GitHub refspecs for the default branch and tag and never publishes.

Both release forms, including dry-run, read the root `package.json` at the selected `dev` commit. When it declares a `version`, a mismatch with the release's version refuses with `release-version`, naming both versions. Commit the bump through an ordinary reviewed item and merge it onto `dev` before previewing; an uncommitted bump does not pass, and release never writes it. A project without `package.json` or its `version` key releases as before. Whether other project version files should be checked remains open. Recovery of an already published receipt finishes its pinned build even if later `dev` work has another version.

The notes list one `T-12 <tracker title>` line per `Item:` trailer in the range from the default branch to `dev`, in commit order, followed by non-item commit subjects. If an item was removed, its commit subject supplies the title. Git creates an annotated tag object at the pinned dev commit, then one atomic push sends that commit as GitHub's default branch and the tag object as `refs/tags/<version>`. No GitHub API is called and no project version file is changed. Only after that push succeeds does cland advance the local default branch, install the local tag and publish that branch and tag to the territory. A GitHub hook rejection reports Git's message and leaves all local and remote refs unchanged.

The result is `{version, commit, notes, refs, dryRun}`. A failure after GitHub accepts the push returns `followUp: {step, error}` saying `released; follow-up failed`. Preserve `.cland/release.tmp`, repair the named obstruction and retry the same version and, for an item release, the same item. The receipt, written before pushing, pins the annotated tag object, dev commit, notes and optional item id. A retry with a different item or a version-only command cannot consume an item release receipt. A retry checks that exact tag on GitHub and finishes the local refs and territory even after a hub restart or a lost push reply, without publishing later dev work. The receipt is removed after the item closure and other follow-up complete; retrying an already written closure adds no duplicate release comment.

`cland sync [--json]` sends a `sync` frame. The human or the Coordinator's shell with the `sync` grant may call it; it has no spoke tool. It refuses while a merge still needs checkout, item, claim or topic completion, preserving that landing's recovery identity. From a clean root on dev it fetches GitHub, requires GitHub's default branch to fast-forward the local default branch, and prepares a replay of the range from the default branch to `dev` on the fetched commit in an isolated checkout. Replay retains merge structure. A dirty root refuses; a conflict aborts preparation, names the files in the error and `files` result field, and leaves every integration ref and the root tree untouched. On success it installs the replay in the root, atomically updates the local default branch and dev, and publishes those refs only to the territory. It never pushes to GitHub.

Sync returns `{main, dev}`; the compatibility field `main` holds the default branch tip. Release and sync recovery receipts keep their existing field names, so receipts from before recorded defaults still resume. A territory failure after the local refs move returns `followUp` saying `synced locally; follow-up failed`. Preserve `.cland/sync.tmp`, repair the obstruction and retry sync to publish the same replay. A changed root or ref during recovery is refused for manual reconciliation. Finish pending sync before merge or release, and finish a GitHub-accepted release before sync. Previews, releases, syncs and their refusals are recorded in the hub log and journal.

## cland doctor

Doctor requires only the harnesses used by `.cland/roles.toml`: each role's launch harness (omitted roles or harness keys take the built-in defaults), plus every named account's harness. Other missing or signed-out harnesses have informational `ok` rows; a signed-out row still names its login command. Without a project or `roles.toml`, no particular harness is required, but a machine with none installed gets one failure, `cland needs at least one harness`, with installers. `gh` and its login are checked only when the root has a remote named `github`; otherwise a single `ok` row says `not needed: no github remote`. The exported `harnessesInUse` in `src/roles/harnesses.ts` supplies the same requirements to setup's installer and login steps.

`cland doctor [dir]` checks the machine and the project (`dir`, else the one around the current directory) and prints one line per check: `ok`, `warn` or `fail`, what it found, and for a `warn` or `fail` the fix after `— fix:`. The text is plain, to paste into an item comment; the verdict is coloured only on a terminal (never with `NO_COLOR`). `--json` prints `{root, version, checks: [{name, verdict, detail, fix?}], summary: {ok, warn, fail}}`. The exit code is 1 when any check fails, else 0: a warning never fails it. It starts nothing and changes nothing; the hub is only asked `hub.status`. Every probe runs with a deadline (20 s for a tool, 3 s for the `ps` that tells whether the hub lock's holder is still the process that took it; `CLAND_DOCTOR_PROBE_TIMEOUT_MS` overrides both, for tests) in its own process group: past the deadline the whole group is killed and its pipes closed. The probe waits for the child and native handles to close before returning. If the child still has not closed one second after SIGKILL (also applied on a spawn error), the report returns an explicit `cleanup incomplete` failure rather than waiting indefinitely; termination is unconfirmed in that case. A `ps` that does not answer in time counts as "cannot tell", and the live lock holder is kept.

| Check | `ok` when | Otherwise |
| --- | --- | --- |
| `claude-code`, `codex`, `opencode` | The executable (the adapter's `CLAND_CLAUDE_BIN`, `CLAND_CODEX_BIN`, `CLAND_OPENCODE_BIN`, else `claude`, `codex`, `opencode` on the PATH or in installer folders) answers `--version`, or no role uses it. Each installed row shows `<version> at <bin>` and an informational `tested with` note from `src/doctor/ranges.ts`. | Required but missing, failed or unreadable version: `fail`. Versions have no range verdict or upgrade fix; OpenCode's row notes that cland speaks its v2 API, for every major. |
| `claude-code auth` | `claude auth status --json` says `"loggedIn": true`. | `fail`, `claude auth login`. |
| `codex auth` | `codex login status` exits 0 (`Logged in using …`). | `fail`, `codex login`. |
| `opencode auth` | `opencode auth list --standalone --format json` lists a provider with a `type: "credential"` connection; `env` connections do not count (`--standalone`: a private server for the call, the background service is not started). | None: `warn` (the free default needs no login), a database-specific `opencode auth login --standalone`; the command failing: `warn: cannot check`. |
| `gh`, `gh auth` | No `github` remote (one informational row), or `gh --version` and `gh auth status` exit 0. | `fail`: install gh, `gh auth login`. |
| `neovim` | `CLAND_NVIM`, else the pinned build in the launcher's cache (`nvim/bin/nvim-path.ts`), prints `NVIM <nvim/NVIM_VERSION>`. | Not downloaded: `fail`, run `cland open` (its launcher downloads and verifies it). `CLAND_NVIM` at another version: `warn`. |
| `project` | Only when `.cland/` is missing: then the project checks below are this one `fail`, `cland init`. | |
| `territory` | `origin` is the local bare territory, it holds `main` and `dev`, `HEAD` is on `dev`, and the protection hook is current and executable; a non-Git folder needs none. | `fail` names missing or damaged state; run `cland init` (restore a changed `origin` to `.cland/territory.git` first). |
| `hub` | `hub.json` names a live pid that holds `.cland/hub.lock` and answers `hub.status` on the socket, at this cland's version. | No hub (no file, a stale file): `warn`, `cland hub start`. A lock holder without `hub.json`, an invalid file, a hub that does not answer: `fail`. A stale file (its pid gone, or not the lock's holder) while a live process holds the lock: `fail` naming the holder, `kill <holder>`, then `rm .cland/hub.json` and `cland hub start` (`cland hub start` alone would refuse). Another version: `warn`, restart it. |
| `web network` | A loopback bind or HTTPS tunnel is configured. | `warn` for a network bind without `[web] origin`: cookie in clear, no phone notifications/install; configure the tunnel or return to loopback. |
| `web edge` | The independent browser listener is available. | `warn` with its port and bind failure reason; free the port or change `[web] port`, then restart. Spoke/Unix-socket service continues. |
| `hub.json` | Valid (socket, port, secret, pid, version; optional webPort), or absent while no hub runs. | Missing while a hub holds the lock, or invalid: `fail`. Stale: `warn`. |
| `secret` | `.cland/secret` is 64 hex digits, mode 0600, the one `hub.json` carries. | Absent before the first start: `warn`; loose mode: `fail`, `chmod 600 .cland/secret`. |
| `roles.toml`, `config.toml` | Parse (`roles.toml` as the hub reads it, `config.toml` as `cland update` does). | `fail` with smol-toml's error and its line and column. Absent: `warn`. |
| `skills manifest` | `.agents/skills/.cland-manifest.json` is valid (validated as `cland update` does: the mark, the names, the paths) and each skill it lists is a folder holding its `SKILL.md` (cland's own repository, the skills' source, needs none). | `fail`, `cland update`. |
| `skills` | `.claude/skills` is a symlink resolving to `.agents/skills`, or the project's own folder whose entry per cland skill is a folder, or a link to one, holding `SKILL.md` (a regular file, or a link to a folder without it, fails). | Missing or broken: `fail`, `cland update` (a link pointing elsewhere: `rm .claude/skills` first). A link of the project's own elsewhere: `warn`. |
| `claude hooks` | `.claude/settings.json` holds the managed hook (`cland hook <event> # managed by cland <version>`) for every adapter event, at this version. | Missing: `fail`; another version: `warn`; both `cland update`. |
| `cland mod` | `hub/mod/cland/hooks/hooks.json` ships with this cland. | `fail`, reinstall cland. |
| `docs/agents`, `AGENTS.md` | The three files exist (a file without the mark is the project's own and fine); `AGENTS.md` has the managed block, at this version. | `fail` (another version: `warn`), `cland update`. |

`probeHarness` in `src/doctor/toolchain.ts` exports the binary, parsed version and login checks for both doctor and setup, with injectable executable lookup and command replies. T1 coverage is in `test/doctor-harness-probe.test.ts`. The fakes answer the same surfaces in the CLI tests (`test/doctor-cli.test.ts`): `claude --version` and `auth status` (`FAKE_CLAUDE_VERSION`, `FAKE_CLAUDE_LOGGED_OUT`), `codex login status` (`FAKE_CODEX_LOGGED_OUT`), `opencode auth list` (`FAKE_OPENCODE_NO_AUTH`), and the fake `gh`'s `--version` and `auth status` (`FAKE_GH_LOGGED_OUT`).

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

The Neovim workbench places its four panels with `:Cland panel items|inbox|sessions|topics left|right` or the palette's **<Panel> on the left/right** actions. Each panel has a home side, with one visible panel per side; moving a panel closes its old side. Buffer keys and hub events follow the panel. `gm` inside any of the four panels moves it to the other side; the action registry exposes **Move <kind> to the other side** in the palette and Keys. Panel toggles, top-bar chips, `gp` and scoped palette actions use its home side; centre `C-h`/`C-l` focus the panels currently on the left/right. Neovim's `CTRL-W H/L/r/x` remain native and are not panel placement controls. Optional `panel_homes` and `panels.left_kind` in version-2 `.cland/ui.json` save homes and occupants, including Items on the right; the restart snapshot carries them too. Older files keep default sides; invalid assignments fall back with one amber notice while retaining other preferences. Presets retain homes. Manual widths are per side (`sizes.left`/`sizes.right`) and follow the side through panel moves, view/preset changes and restarts. The Topics dock (`␣T`) stacks above whichever panel is on the right, appears only once and keeps `sizes.dock`; the explorer card can temporarily replace any right occupant without changing its home or visibility preference. `:Cland panel reset` and **Reset panel layout** restore default homes and side widths and save immediately, keeping the dock height and open panels. Panels move to default sides when possible; if both target the same side, both stay in place and subsequent toggles follow default homes. The default layout and wire frames are unchanged. See [Panels](../nvim/README.md#the-shell) for the client commands.

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
| `{"type":"topic.history","id":…,"topic":"general","limit":50,"after":0}` | `{"topic":Topic,"messages":[TopicMessage…],"more"?:true,"before"?:messageId,"after"?:seq}`, oldest first, at most 200 and byte-capped (see Startup replies) |
| `{"type":"topic.send","id":…,"topic":"general","text":"…","to":["…"],"replyTo":"<message id>"}` | `{"message":TopicMessage,"outcomes":[…]}`; `to` is optional (the mentions in the text, else the Coordinator); in Agents only a reply is accepted, and it addresses the sender of `replyTo` |
| `{"type":"topic.create","id":…,"title":"…","item":"T-12"}` | `{"topic":Topic}`; `item` is optional; refused without a title, or for an item that has a topic |
| `{"type":"topic.close","id":…,"topic":…}` | `{"topic":Topic}`, `closed`; refused for General and Agents |
| `{"type":"topic.resolve","id":…,"topic":…}` | `{"topic":Topic}`, `open`; refused for a closed topic and for Agents |
| `{"type":"topic.read","id":…,"topic":…,"upTo":"<message id>"}` | `{"topic":Topic}` with its `unread`; without `upTo`, up to the latest message |
| `{"type":"topic.rename","id":…,"topic":…,"title":…}` | `{"topic":Topic}`; refused for General and Agents |
| `{"type":"topic.delete","id":…,"topic":…}` | `{"deleted":id}`; refused for General and Agents |
| `{"type":"topic.answer","id":…,"ask":…,"option"?:n,"text"?:…}`, `inbox.list`, `inbox.decline`, `inbox.read` | Under Asks and the inbox above |
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

`filter` accepts `kinds` (any of the ten kinds), `warnings: true`, `subject: {kind, id}` and `muted: [{kind, id}]`. A subject is an item (with descendants), session, topic, artifact or rule; navigation references also match subject filters. The cap applies to matching, coalesced rows. These mutes affect only the response; they do not write the hub's visibility preferences. The workbench owns `events.filter`, `events.muted` and `events.last_look` in `.cland/ui.json` under the existing shared lock. The inbox events line uses an unfiltered newest-page count, independently of needsYou and the selected filter.

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

A `message` event comes for every message recorded in a topic, the human's own included, before the `topic.send` result. A `topic` event comes when a topic is created or its status, warning, binding or title changes, and after a `topic.read` (its unread count); a new message alone moves the count without one (the UI counts `message` events). A `delivery` event comes whenever a message's stage changes after the send: an ack, an injection, a delivery dropped past the TTL when its session comes back, or a role's queue merged into a session that already had the message. A `session.state` event comes when a session's state changes (below). `presence` replaces the connected-session list on a hello, the last spoke leaving, a rename, a status or role change. `session.process` replaces a process-table row on launch, resume, exit, stop, rename, model, role or pid changes; it has exactly the view `session.list` returns, including a null attach command after exit. Replace a row by its stable `sessionId` or its name, so a rename removes the old name and a relaunch replaces the old launch. `session.usage` carries the latest adapter totals for one launch: reports within each 1 s window are coalesced into one trailing snapshot, independently per session. Match its `sessionId`, never just the reused name. A pending usage update is cancelled at hub shutdown. `session.cleanup` identifies a failed launch by `sessionId` and reports `pending stop` or `settled`; clients remove only that identity from their accepted-process view, including during snapshot replay. The workbench reads `session.list` and `hub.status` on connect and after its own launch or stop; these events keep it current between reads, without a timer. A `task` event comes on every change to the tracker's index: a hub write, a hand edit the watcher read, a claim taken or released, and a removed file (`item` null); `item` is the item as `task.list` shows it, including its resolved `rank`. A successful rank move emits one additional `task` event for the moved item with `siblings`, all ids under the affected parent in rank-then-id order. Other events have no sibling list; clients compare rank, then numeric id. `hub/test/fixtures/rank-order.json` is the shared hub/client ordering example.

## Adapters and sessions

An adapter launches one kind of harness, tells the hub what each session is doing, and hands it messages (spec 4.3). Claude Code, OpenCode and Codex have one.

A turn that fails is reported separately from the session's idle state. OpenCode's `session.execution.failed`, Codex's `turn/completed` with an error (or failed status), and Claude Code's `StopFailure` make a journalled `turn-failed` notice in Agents and a record in the events view: `<name> [Role]: its turn failed: <first line of the error>`. Sessions whose hub messages fed the turn (including steers) receive a hub note too; human messages are covered by Agents and the events view. The harness stays running and the failed turn is not automatically replayed. Failures the adapter misses while its event stream is disconnected cannot be reported. OpenCode drops uncertain sender attribution on stream loss and tracks new deliveries after reconnect. Codex associates only accepted admissions, including ones acknowledged after completion. Claude Code uses the hooks' `prompt_id` to reconcile a failure that arrives before its start hook, keeping at most 64 recent prompt records; missing or evicted identities still produce the public notice, without guessing a sender.

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

A failed launch that returned a process keeps its identity in durable pending-stop ownership, watches it until verified exit, and retries its ownership-verified stop on restart. The recovery receipt and quarantine of any accepted row commit in one process-table transaction; Before calling stop, the receipt durably records stop intent with the original pid and start identity. If the completion write fails, recovery inspects that identity: gone or reused means settle without signalling the replacement; a matching live original takes the ownership-verified stop path; unreadable identity remains pending. Recovery starts a new adapter watch only after verifying the original identity alive; gone or reused identities dispose supervision by session id through `adapter.unwatch`, without signals. Row removal and its checkpoint share one process-table transaction. Guarded role rollback and its checkpoint share one Store transaction, so a later human assignment cannot be undone by receipt replay. The receipt persists completion of verified stop, row removal and guarded role rollback separately. Recovery resumes the first unfinished stage and never signals a process after stop was verified, even if its pid has since been reused; cleanup clears the receipt only after all stages finish. `session.list.pendingStops` shows this recovery separately from accepted process rows; it never reports the failed launch running or replaces another name owner. Codex and OpenCode failures before returning a process hand pending file rollback to the same durable receipt. It records each child as pid plus start identity and each file undo as removal, truncation, content/mode restoration or removal of an owned empty directory. Startup re-verifies those children through the shared termination helper before touching their files, checkpoints each completed undo, and keeps launches and resumes of that session fenced until all cleanup settles. An unknown start identity remains pending while the child lives. A failed relaunch retains its prior conversation row and role for another explicit resume after cleanup.

A failed launch whose row was published still has a terminal transition: verified cleanup commits the final `session.state` fact and closes exact and subscriber-owned subscriptions through the shared terminal path before removing the row. Publication ownership is kept in the recovery receipt, so an interrupted terminal write retries after restart; a launch that never published a row cannot close a conflicting name owner's subscriptions. Verified cleanup still ends subscriptions owned by its proven early identities. Authoritative identity publication follows the row commit, including a commit whose observer throws; an unpublished row failure preserves the prior claimant identity and lead routing.

An unfinalized launch identity is fenced against rename and role changes (assignment, clearing and either side of a handover), from its early hello until successful acceptance or completed failed-launch settlement. A refusal names the pending launch. The hub gives each launch a distinct credential, passed to the spoke as `CLAND_LAUNCH_TOKEN` and carried in its hello. The credential is a bearer secret, held only by the spawned process and its own spoke, never logged or passed in command arguments. The hub trusts each adapter to report the identity of its own spawned process. Within that trust model, an identity presenting the valid token belongs to the launch; sharing a token with another session or an adapter reporting another process is outside the model. The identity checks below are defence in depth. Only a matching credential proves an early hello belongs to that launch; a foreign owner reconnecting under the launch's name keeps its own role and mutation rights, including an uncredentialed `UNKNOWN_SESSION`. Launch provenance and first-role grants are keyed by credential; the fence accepts only stable ids. A credentialed anonymous hello receives a unique internal stable id before its role is granted. The returned adapter identity adds to the proven identities rather than replacing an early one, and publication records that identity in the authoritative session store. The recovery receipt retains all proven ids and the anonymous binding; cleanup immediately freezes reconnects to those committed identities, and each rollback has its own atomic checkpoint. Acceptance retires the first-role grant; a later hello uses the current human assignment, including a change or clear made while spawn awaited. An unconsumed first-hello credential retains only the published stable id until a successful hello or terminal transition consumes it, outside the pending fence. Core validates a new hello, including its launch name and authoritative identity binding, before registering ownership proof; an existing spoke join adds no proof and consumes no grant. At launch admission the hub snapshots its existing stable identities, including durable aliases and process rows. Neither a credentialed hello nor an adapter return can prove one of those identities, whatever name it holds later. Proof also checks the current identities: an unrelated identity first recorded during spawn cannot become a rollback target. A rejected foreign adapter identity receives a separate cleanup identity, preserving the foreign process row, terminal facts and verifier holds. Every resolved proof candidate must also be a stable id, including the candidate chosen for an anonymous hello during the PID probe. A credential cannot make an existing foreign live or offline identity a rollback target. Refused anonymous hellos leave no anonymous binding in the proof set or cleanup receipt. Foreign hellos cannot consume the launch's first-role grant or become rollback targets. Quarantined rows do not publish ordinary process changes; their final fact waits for verified exit. Cleanup and rollback resolve ownership by the proven stable session id, including recovery of a previously renamed identity. A later human grant is allowed after settlement and survives recovery retries.

### Session state

`idle`, `busy`, `waiting for human`, `waiting for approval`, `unknown` (spec 4.2). Only adapters set it; the model's `status` tool sets the status line and never the state. Presence (`who`, `hub.status`) carries it, and subscribed clients get `session.state`. A session no adapter launched is `unknown`, and so is a launched one whose process died or was stopped.

- A push signal (a hook, the mod) carries the time it happened; one older than the last push applied is dropped, so out-of-order hooks never move a session back. For a hook that time is when its `cland hook` process started (the harness fires the event by starting it; the process may take hundreds of milliseconds more to run), for the mod the event's own time. The hub's receipt order is not used: two hook processes started in one order often arrive in the other.
- A signal or a bridge names its launch (`--launch`, the cland session id the launch gave the hooks and the mod). One from an earlier launch under the same name is ignored (`signal-other-launch` in the log) or refused: it never changes the row of the process that replaced it. A signal never revives a row that is not `running`; only resume does.
- A retry asked for while an inject of the same message is still waiting for its confirmation (an `idle`, a bridge that connected) is made when that inject gives up, if the message still waits. A rename takes the session's `delivered` messages along, so their retry and confirmation find them. At a launch, the bridges that connected early are registered before the early signals are replayed.
- A polled signal counts only while no push came for `CLAND_PUSH_TRUST_MS` (15 s), or while nothing is known yet.

### The process table

`harness_processes` in `hub.db`: name, harness, role, model, cwd, pid, the harness's handle (Claude Code's background id, Codex's app-server socket), cland's session id (the spoke's `CLAND_SESSION_ID`), the harness's own conversation id where it chose one (Codex: the thread id), start time, the pid's process start time (`ps -o lstart=`, as the hub lock keeps it), `running` | `exited` | `stopped`, and the Lead’s node or item whose task worktree the session was launched in (`item`, else null). No adapter signals a pid before checking that start time (`system-processes.ts` `endProcess`): a pid reused by an unrelated process after a crash or a restart is never signalled (`signal-refused` in the log), and is not taken for the session when resuming. At its start the hub resumes every `running` row. A process found alive under its ids is watched again. Otherwise the row turns `exited`, the state `unknown`, and the log gets `harness-exited`. The watch also catches a process that dies while the hub runs.

### The Claude Code adapter

See [Accounts and limits](#accounts-and-limits) for the registry, process environment, polling and launch refusals.

On every launch and relaunch, the adapter reads `.claude/settings.json` and `.claude/settings.local.json` in the session's working directory (the project root or the item's task worktree). Only when neither file sets `worktree.bgIsolation` does `--settings` supply `{"worktree":{"bgIsolation":"none"}}`. Unreadable or malformed files count as not setting the key. Inline settings outrank every settings file, so passing this fallback unconditionally would defeat a human's local override. Neither file is written.

| | Surface (Claude Code 2.1.294) |
| --- | --- |
| spawn | Uses the saved account’s `CLAUDE_CONFIG_DIR`; named accounts remove `ANTHROPIC_API_KEY`, `ANTHROPIC_AUTH_TOKEN` and `CLAUDE_CODE_OAUTH_TOKEN`. `claude --bg --session-id <uuid> --name <name> [--model m] [--effort e] --mcp-config <json> --settings <json> --plugin-dir hub/mod/cland`, in the session's cwd. The MCP config starts `bin/cland-spoke.ts` with `CLAND_HUB_FILE`, `CLAND_SESSION_ID`, `CLAND_SESSION_NAME`, `CLAND_ROLE`, `CLAND_DELIVERY=adapter`. The settings add the hooks below (all `async`; with a task worktree also the synchronous `WorktreeCreate` refusal, Task branches and worktrees) and an `env` the mod reads (`CLAND_SESSION_NAME`, `CLAND_HUB_FILE`, `CLAND_NODE`, `CLAND_CLI`). No secret goes on a command line: everything finds the hub through `hub.json`. `--bg` takes `--session-id` but picks its own id (its prefix is the background id); the hub records it as `harnessSessionId`. The workspace must be trusted once (`claude` in it, accept the prompt), or `--bg` refuses. |
| attach | `CLAUDE_CONFIG_DIR=<saved dir> claude attach <background id>` for a named account, `claude attach <background id>` for a default session; several clients can attach at once. |
| inject | The cland mod keeps `cland hook bridge` running, which receives `inject` frames for its session. It submits each one with `$.prompt.submit`, framed as the plugin's (a turn of its own once the session is idle), and confirms it with `cland hook injected`. A turn whose prompt carries a message's envelope confirms it too. The message reads as `<channel source="cland" from=… msg_id=… topic=…>text</channel>` plus one line naming the `send` tool as the way back. The session's inbox socket is not used, because its message format is undocumented. |
| state | Hooks, run as `cland hook <event> --session <name> --launch <cland session id> --hub-file <path>`: SessionStart → `idle` (and the model), UserPromptSubmit → `busy`, Stop and StopFailure → `idle`, PermissionRequest → `waiting for approval` (`waiting for human` for AskUserQuestion), PostToolUse → `busy`, Elicitation → `waiting for human`, Notification `idle_prompt` → `idle`. The mod adds `turn.start` → `busy` and `turn.complete` → `idle`, which also fires on an interrupt where Stop does not, with the turn's usage. The fallback is `claude agents --json`, at most once per 30 seconds per effective config directory, with one call in flight and one schedule shared by watch, launch discovery and startup resume. Each directory runs only while at least one of its sessions is watched; a registered idle directory is never queried. `CLAND_ADAPTER_POLL_MS` (5 s) controls the separate pid liveness tick, which runs no CLI. A launch returns with an unknown pid when the shared snapshot does not yet list it; the next scheduled poll records the pid. The last call time and snapshot live in hub.db meta, so a restart keeps the floor. `CLAND_CLAUDE_AGENTS_MS` shortens the interval for fake-harness tests. |
| signed out | `StopFailure.error == authentication_failed`, or an explicit `--bg` failure naming token expiry, latches the effective directory. One `claude-signed-out` journal record and one Agents notice name the account (when named), directory and `CLAUDE_CONFIG_DIR=<dir> claude auth login`. This replaces the generic human turn-failed notice for authentication failures; agent senders still receive `signed out: <directory>; see the Agents notice`, once per directory and sender while latched. Other turn failures keep their ordinary notices. The latch survives restart in hub.db meta. No polling, retry, `auth status` or `doctor` probes run while latched. Only a pushed successful SessionStart/Stop (never StopFailure) or a successful explicit launch lifts it; an explicit launch is allowed as a recovery attempt, with a warning in its result. A latched resume makes no CLI call: a dead recorded pid exits, a live or unknown pid remains watched, with `state: unknown` and `stateReason: signed-out` in `session.list`. |
| stop, resume | Every command uses the row’s saved account environment and `CLAUDE_CONFIG_DIR`. `claude stop <id>`, then SIGTERM (only to the pid the table recorded, its start time checked) when the pid outlives it by `CLAND_STOP_GRACE_MS` (5 s); the process stays watched until its pid is gone, and a stop that cannot see it go fails with the row still `running`. Until a late pid arrives, stop uses the background id. Resume shares the scheduled `claude agents --json` snapshot and matches the session id or the background id; an entry that only shares the pid is another session, so the row turns `exited`. A relaunch is `claude --bg --resume <its session id>` with the same flags (the harness does not restore them). |

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

See [Accounts and limits](#accounts-and-limits) for the registry, process environment, polling and launch refusals.

`src/adapters/opencode.ts`, with `opencode/client.ts` (the HTTP API and the event stream), `opencode/state.ts` (events to states) and `opencode/server.ts` (the session's server and its files). Launched with `"harness": "opencode"`.

Without an account, each server uses `OPENCODE_DB=$XDG_DATA_HOME/cland/opencode/opencode.db`, or `~/.local/share/cland/opencode/opencode.db` when no absolute `XDG_DATA_HOME` is set. This database is shared by the user's cland projects and separate from OpenCode's background service: the service's boot sweep cannot resume a cland session. A registry account keeps its `data_home` (`<data_home>/opencode/opencode.db`) or explicit `db`. An account pointing at the user's default database shares the sweep hazard; `cland doctor` warns about it.

The process table saves the selected database environment, and each OpenCode `session-launched` journal record names its `database`. Resume, relaunch and pool handoff retain that selection after environment or registry changes. The server removes inherited `OPENCODE_DB` and `XDG_DATA_HOME` before applying it.

No login is needed for the free default `opencode/big-pickle` (confirmed on 2.0.24 with a fresh database and no credentials). Paid providers need credentials in cland's database. `cland doctor` names the database and prints its exact `OPENCODE_DB=… opencode auth login --standalone` line. Copy that line to apply the same absolute-XDG/HOME fallback as launch, including when `XDG_DATA_HOME` is relative.

For an account, set `OPENCODE_DB` to that account's database instead. `--standalone` keeps the login from starting OpenCode's background service. A login in the user's default OpenCode database is separate. Existing sessions launched on that default database stay there until relaunched fresh (`cland session resume <name> --fresh`); reattaching does not migrate them. Stop or fresh-launch those sessions before relying on the isolation from the background service.

The adapter speaks OpenCode's v2 API. Doctor reports every harness version for information only, including OpenCode 1.x and 3.x; behavioural API checks in the adapter report actual incompatibilities. A missing binary points to the [v2 installer](https://opencode.ai/v2/install). Before each cland release's dry run, `npm run check:opencode` compares the newest stable 2.x tag's ten wire operations and the adapter's event names with the tested tag, and prints the result for information. Differences exit 0 and belong in the release report; they do not stop a release. Only network or probe failures exit nonzero; record those failures in the report too. The check writes nothing to the repository. This opt-in network check is never part of `npm test`. The shipped release skill includes the preflight for cland's own releases.

Doctor reports warnings for each role configured on OpenCode: free model selection (including the default) may train on the code it sees, and OpenCode has no OS sandbox. Permission rules do not isolate host processes. These warnings never refuse a launch. The shipped role clauses keep a session in its item's worktree and forbid using `session_move` or `worktree_create` to leave it; request a handover from the item lead instead.

The adapter declares `launchPolicy: "rules, not a sandbox"`. OpenCode keeps its
own permission settings (v0.1.4 §3.5): cland ignores `approval`, `sandbox`,
`writable_roots`, `network` and `permissions`, whether inherited or explicitly
written in `roles.toml`. An explicit ignored choice produces one warning per role
in configuration validation and `cland role list`, which shows `guard: OpenCode's own`.
Claude Code and Codex retain their per-role inherited policy.

Only item worktree confinement (D8) contributes ordered `permissions` rules to
`POST /api/session`. Without an item, cland leaves session permissions unset.
V2 rules have `{action, resource, effect}` fields; the last matching rule wins.
The `edit` action covers edit, write and patch tools. These rules do not isolate
shell processes or provide network controls.

| Launch field | OpenCode behavior |
| --- | --- |
| item (D8) | Append external-directory denials outside the item's cwd, plus edit denials for canonical absolute paths and parent-relative paths outside it. These directory rules also restrict external reads. Internal relative paths retain native policy. |
| `effort` | Select the matching variant id from that model's `GET /api/model` entry. If absent or the catalog is unavailable, select no variant and warn in the launch record. |
| `provider/model#variant` | Send `{providerID: "provider", id: "model", variant: "variant"}`. An explicit variant wins over effort without a catalog lookup. |

Both the adapter's `harness-launched` log and the durable `session-launched`
journal record carry `policy.rules`, `policy.unsupported` (each field and reason)
and `policy.warnings`. Direct adapter requests record ignored policy fields as
unsupported. Code Mode's item-rule gap is recorded for item-bound sessions.
Retained native conversations keep their existing rules and model variant;
their launch record reads those rules back instead of claiming a new policy was applied.

`session.moved` is watched for item-bound sessions. A destination outside the
item's original cwd (including a sibling with the same prefix) produces a
warn-level lifecycle event for the supervising Lead, falling back to the
Coordinator, and a warning in the events view. Moves within the item and events
for other native sessions do not warn. Code Mode's `worktree_create` and
`session_move` request no permission, so the clause remains part of D8.

The cland MCP server keeps OpenCode's default CodeMode setting: the E-424 send experiment did not justify disabling it.

The experimental adapter option `roleInstructions` (or `CLAND_OPENCODE_ROLE_INSTRUCTIONS=1` on the hub) defaults to off. When enabled, a hub role clause goes into the durable `cland-role` instruction entry, replacing the previous assignment or revocation. A bundled launch brief still arrives as a prompt. If the instruction PUT fails, the adapter must confirm deletion of the `cland-role` entry before falling back to the ordinary message path and logging `opencode-instructions-fallback`. If deletion fails, delivery stays unconfirmed for retry; it never acknowledges fallback while an old role instruction may remain. Adoption awaits the human's decision after the E-424 forced-compaction experiment.

Without an explicit model, launch polls `GET /api/model` every 200 ms: a cold catalog can list another provider before OpenCode Zen arrives. An eligible model from the known-good list (`opencode/big-pickle`) ends the wait immediately. Otherwise, a nonempty catalog must stay unchanged for 1 s before the usual free-model preference applies. The catalog wait has a 10 s budget, including HTTP requests and polling sleeps; at that deadline it uses the latest successful catalog's free choice, or the server's default when none qualifies. Empty catalogs and failed requests are retried within that budget. An explicit model or a restored session skips this wait.

| | Surface (OpenCode 2.0.24) |
| --- | --- |
| spawn | A standalone `opencode serve --hostname 127.0.0.1 --port <chosen-port>` per session, detached, in the session's cwd; readiness comes from authenticated `GET /api/session/active`, with logs used only to explain failures. The spoke is a local MCP server of a generated config passed as `OPENCODE_CONFIG` (`mcp.servers.cland: {type: local, command, environment}` with the same `CLAND_*` variables as Claude Code's), and the server gets a password of its own as `OPENCODE_PASSWORD`. Both live in `.cland/opencode/<name>/` (`opencode.json`, `password` mode 600, `serve.log`), which a `.gitignore` of its own (`*`) keeps out of the repository. Then `POST /api/session {title, model, location, permissions}`. The model is `<provider>/<id>` (`opencode/big-pickle`); without one, a free model of `GET /api/model` (zero input/output price, tools supported, enabled and active). The known-good preference list is `opencode/big-pickle`; if it is not offered free, use the first free OpenCode Zen model, else the first free model from another provider. Selection is deterministic and makes no launch-time probe request; a listed model that later fails is reported as a failed turn. The row keeps the server's pid, its url as `harnessId` and the `ses_…` id as `harnessSessionId`. The server starts its MCP servers when the session is created, so the spoke connects right after the launch. |
| attach | `OPENCODE_PASSWORD="$(cat <password file>)" opencode --server <url> --session <ses_…> <cwd>`: the OpenCode TUI as one more client of the session's server, in the session's directory. The password never appears on a command line. The directory matters: the server keeps one instance per directory its clients work in, and each instance starts the configured MCP servers, so a TUI in another directory would start a second spoke under the session's id, which replaces the spoke the session's tool calls go through (found in the T-42 run). Closing the TUI (or Neovim) leaves the server and the session running. |
| inject | `POST /api/session/{id}/prompt {text, delivery}` with the envelope as text: `steer` while the session runs a turn (it joins the turn at the next step boundary), `queue` otherwise. The reply is the durably admitted inbox item (`msg_…`), which confirms `injected`. A failed or timed-out request leaves the message `delivered` for the retry at the next `idle`. |
| state | `GET /api/event` (SSE), one subscription per server, re-opened with backoff while the session is watched; each time it opens, a snapshot (`GET /api/session/active`, `GET /api/session/{id}/permission`, `GET /api/session/{id}/form`), since the stream is live-only. `session.execution.started` → `busy`; `.succeeded`, `.failed`, `.interrupted` → `idle`; `permission.asked` → `waiting for approval` until `permission.replied`, with `approvalCommand` read from the permission's source tool part (`GET /api/session/{id}/message/{messageID}`): the shell command for a finished `shell` tool input, the tool name otherwise, the permission's `action` when the source is missing or unreadable (no other tool input leaves the adapter); `form.created` → `waiting for human` until `form.replied` or `form.cancelled`. A pending approval outranks a pending form, which outranks a running turn. States reach the hub with source `sse`. A stream that ends with its server, or a pid gone at the `CLAND_ADAPTER_POLL_MS` check, is `unknown`. |
| usage | `session.step.ended` (one per assistant message): `{model, inputTokens, outputTokens, reasoningTokens, cacheReadTokens, cacheWriteTokens, cost}`, the model from `session.step.started`. |
| stop, resume | Stop is SIGTERM to the server (its start time checked first), which ends its MCP servers, the spoke among them. Resume finds the session when the pid is alive and the server answers `GET /api/session/{id}` with the recorded password; the state comes from the snapshot. A relaunch starts a new server on the same config and password, then reopens the same session (OpenCode keeps sessions in its own database) or offers a fresh launch when the recorded session no longer exists. |

| Capability | |
| --- | --- |
| history | none: the messages are readable (`GET /api/session/{id}/message`), but not read in v0 |
| usage | reliable: per message, from `session.step.ended`, summed into `usage.total`, with the step under `usage.last` |
| setModel | none: `POST /api/session/{id}/model` exists, but the contract has no setModel yet |
| approvalRelay | none: approvals stay in the OpenCode TUI (spec 4.3) |
| busy, idle | reliable: the server reports a turn's start and end |
| waiting for approval, waiting for human | heuristic: the server has no waiting status, so they are derived from a pending `permission.asked` or `form.created` |

`CLAND_OPENCODE_BIN` names the `opencode` executable. The server's environment drops `CLAND_*`, `OPENCODE_CONFIG`, `OPENCODE_CONFIG_CONTENT`, `OPENCODE_PASSWORD`, `OPENCODE_DB` and `XDG_DATA_HOME` from the hub's own. The user's global OpenCode config still applies, merged with the generated one.

### The Codex adapter

See [Accounts and limits](#accounts-and-limits) for the registry, process environment, polling and launch refusals.

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
| `{"type":"session.launch","id":…,"name":…,"role"?,"model"?,"harness"?,"effort"?,"cwd"?,"item"?,"brief"?}` | `{"process":HarnessProcess}`; a role's launch defaults fill the rest. `brief`: text or an artifact id, carried once after the clause in the first input. With `item`: `{"process","claim","worktree","reason"?}` (Task branches and worktrees) | UI, CLI, spokes whose role grants `session.launch` (Coordinator, Lead within its subtree, Aide on the human's word) |
| `{"type":"session.list","id":…, "archived"?:true}` | `{"archived":count,"processes":[HarnessProcess…],"adapters":{"claude-code":Capabilities,"opencode":Capabilities,"codex":Capabilities},"coordinator"}` | UI, CLI, spokes whose role grants `session.launch` |
| `{"type":"session.attach","id":…,"session":…}` | `{"command":"claude attach 1a2b3c4d"}` | UI, CLI |
| `{"type":"session.archive","id":…, "session":…}` | `{"process":…}`; stopped/exited only | UI, human CLI, Coordinator |
| `{"type":"session.prune","id":…, "olderThan":"7d","dryRun"?:true}` | `{"names":[…],"dryRun":boolean}` | UI, human CLI, Coordinator |
| `{"type":"session.stop","id":…,"session":…}` | `{"process":…}` | UI, CLI (Coordinator, Lead within its subtree, Aide on the human's word) |
| `{"type":"session.resume","id":…,"session":…,"relaunch"?:true,"fresh"?:true}` | `{"found","reason"?,"process","role","claim","notes", "fresh"?:{"brief"}}` | UI, CLI (Coordinator, Aide on the human's word) |
| `{"type":"session.retry","id":…,"session":…,"message":"<message id>"}` | `{"retried":true}`; refused unless that delivery is `uncertain` | UI, CLI |
| `{"type":"session.signal","id":…,"session":…,"launch"?:…,"event":…,"at":…,"payload":{…}}` | `{"applied","state"?}` | `cland hook` |
| `{"type":"session.bridge","id":…,"session":…,"launch"?:…}` | `{"bridged":true}`, then `{"type":"inject","session","message","text"}` frames | `cland hook bridge` |

`session.archive` archives a stopped or exited process row; a running row is refused with "stop it first". `cland session archive <name>` does the same from the human's shell. Only the human and Coordinator have permission; other roles are refused. The Coordinator's `session.archive` tool is fixed at launch, so relaunch an existing Coordinator after updating.

Default `session.list` and `cland session list --json` exclude archived rows and return `archived: <count>`. `session.list` with `archived: true`, or `cland session list --archived` (also with `--json`), returns only archived rows. Archived rows leave `hub.status.harnesses`, live groups, counts and the palette. Their `session.process` event carries `archived: true` and the archive layer, including when pinned. The process view carries nullable `stoppedAt`, `archivedAt` and `archivedBy` (`hand` or `rule`). Existing stopped rows gain nullable columns without journal backfill; later stops record their time. New launches under reused names replace these marks. The journal retains earlier launches and stops and appends `session-archived` with session, sessionId, by and actor. Successful native or fresh resume clears either kind of mark and journals `session-unarchived`; failed resume keeps the archive.

Stopped or exited crew sessions archive automatically. Implementers use their launch item or claim; Reviewers and QA use their latest held item, remembered on the process row even after holds release. A closed or merged item starts the one-hour window from its indexed close time or merge receipt. Reopening cancels that clock. Otherwise the row uses its stop time and the 24-hour window; Leads, Coordinators and sessions without a role always use this rule. Aides never archive automatically.

The windows are read at hub start from `.cland/config.toml`:

```toml
[sessions]
archive_after_item = "1h"
archive_after_stop = "24h"
```

Durations are positive integers with `s`, `m`, `h` or `d`. The hub sweeps once at startup, then sleeps until the earliest eligible row’s archive deadline; with no eligible rows it leaves no archive timer. Process lifecycle changes and changes to a stopped row’s associated item close time coalesce into one sweep on the next event-loop tick. Unrelated item updates do not trigger a scan. A due row archives on that next tick (plus normal event-loop/I/O scheduling); a pending lifecycle operation or failed-launch recovery defers it until that operation or recovery settles. Delays beyond Node’s maximum timeout (about 24.8 days) use a capped wake-up and re-evaluate the deadline, never a 1 ms overflow loop. Every due row commits in one process-table transaction; each publishes one changed `session.process` and journals `session-archived` with `by: "rule"` and `rule: "item" | "stop"`. Legacy undated terminal rows receive the first sweep's time; cleanup never backfills from the journal. The `session.process` envelope includes the authoritative `archived` count, so the panel can update its header without fetching archived rows.

`cland session prune --older-than 7d` deletes only archived rows whose **stop** is older than seven days, along with their remembered presence/role, adapter usage, claim/hold and pending bookkeeping. `--dry-run` lists the names without deleting; `--json` returns `{names, dryRun}`. Messages, topics, artifacts, tracker files and the journal remain. A real prune journals one `sessions-pruned` record listing the names and publishes `sessions.pruned` with their identities and the remaining archive count. The human's shell and Coordinator may prune; other roles are refused by the permission table. Relaunch an existing Coordinator after updating so its launch-fixed tool list includes `session.prune`.

`session.resume` returns `role` (the restored role or null), `claim` (the currently owned item id or null) and `notes[]` describing what did not return. An occupied exclusive role stays with its current holder; a closed or reassigned item stays unclaimed by the resumed session. Verifier holds are released at stop and never restored: the verifier must retake them. The role clause is delivered again on the resumed hello. A successful relaunch journals `session-resumed` with `relaunched: true`, the role, claim and notes.

Native resume requires a recorded harness conversation id and a successful adapter resume. When it cannot resume, the answer has `found: false`, `reason` and `fresh: {brief}`: the original brief text or artifact id, or null (`no brief recorded` on older rows). Only a new request with `fresh: true` starts an ordinary fresh launch. Both paths retain the cland identity, so a valid item claim stays owned without taking another session's claim. At launch the process table records the original brief (artifact ids stay ids), harness, model, effort, cwd and launch item; fresh launch uses those settings and resolves an artifact brief again. A running session must be stopped before launching it fresh. Cleanup still pending after an adapter failure is a frame error; a fresh launch waits for cleanup.

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
| `cland session list` / `attach <name>` / `stop <name>` / `retry <name> <message id>` | As the frames above. |
| `cland session resume <name> [--relaunch \| --fresh]` | Re-finds the process. `--relaunch` restarts a stopped/exited session on its harness conversation, preserving its name, role and valid item claim; a live process is stopped first. If the harness cannot resume, prints the reason and a `--fresh` hint, exits 1. `--fresh` launches a new harness conversation with its recorded brief and launch settings. |
| `cland hook <event> --session <name> [--launch <id>] --hub-file <path>` | Posts one signal, stamped with the process's start time (or the payload's `at`), with the harness's JSON payload from stdin. Only the fields the hub reads are kept, and a prompt is reduced to the message ids it carries. Always exits 0: a hook never fails the harness. |
| `cland hook worktree-create --session <name> --worktree <path> [--launch <id>] --hub-file <path>` | Claude Code's `WorktreeCreate` hook in a session launched with an item: names the session's own worktree on stderr, tells the hub, exits 2. The one hook that fails the harness. |
| `cland worktree list` / `prune [--yes]` | Task branches and worktrees, under Local git territory. |
| `cland hook bridge --session <name> --hub-file <path>` | The mod's connection to the hub. It prints each `inject` frame as a JSON line, reconnects through `hub.json` after a hub restart, and ends with its parent. |

`CLAND_CLAUDE_BIN` names the `claude` executable, `CLAND_INJECT_TIMEOUT_MS` (60 s) how long an inject waits for its confirmation.

## The tracker

`closed` is an optional ISO timestamp in item frontmatter and the index. Hub close, merge and an edit to closed/done write it; reopen clears it. A hand close without a time stays unresolved. List, view and `task` events expose the field, and session archival reads it before the older receipt/index fallbacks.

`task.list` and `task` event summaries carry `criteria: {total, done, verified, stale, failed}` from indexed marks, without reading an item file. Counts are exclusive: failed takes priority over current verified, stale, then done; a checkbox alone counts as open. Verification is current only at the exact branch tip (the receipt tip for a landed task, `dev` for a planning container). `task.view` retains the full `criteria` array and adds `criteriaCounts` with the same counts.

Tasks also carry `verify`, null until a matching verification exists: `{id, state, result, head, finished, artifact, cached?}`. The latest submitted job matching the item number or branch wins; results are `passed`, `failed`, `cancelled`, or null while queued/launching/running. `cached` holds the original run, head and candidate tree. Suites maintains these lookups across saves and reconstructs them on startup. Changes coalesce per task per tick and emit a silent `task` event; successful completion publishes one terminal card with its log artifact. A blocked report still publishes the terminal state. Subscribed sessions receive the usual suite report, with no additional delivery for this projection. The plain CLI view prints the closing time, counts and verification details.

### Migrating prefixes and categories

From the project root's human shell or the Coordinator's session, with the hub stopped, run `cland task migrate --dry-run` to inspect the plan, then `cland task migrate` to apply it. Add `--json` for the plan object; preview and apply share the planner and return the same format. It works directly on item files and `hub.db`, holding the hub startup lock until completion. A running hub refuses both commands; its `task.migrate` frame also refuses. No MCP migration tool is added.

The plan lists file renames preserving existing slugs, each item's kind prefix, rewritten `parent` and `blocked_by`, title changes and unresolved references left as written. It strips leading kind words such as `Epic:`, converts the open root Tech debt container to a category (or seeds it), seeds Bugs, Follow-ups and Ideas on the shared counter, retires every `tech-debt` label and moves unparented labelled items into Tech debt. Existing open root categories are reused by their cleaned titles.

The `closed` part backfills closed items missing their frontmatter time. Sources, in order: the landing receipt's `merged_at`, the latest journal `task-written` record with `op: close`, then the receipt commit's Git committer time. Preview names each source as `closed T-n: <ISO time> (receipt | journal | commit)`. Existing `closed` fields stay untouched; items without a valid source remain under `unresolved`, including on a nothing-to-do rerun. A closing-time-only apply changes only the `closed` frontmatter line, preserving the body, comments and other timestamps. The live backfill uses the same tag, database backup, preview/count check, idempotent rerun and old-id checks as the prefix migration, in the restart window that carries its merge.

Apply renames each file before atomically replacing its frontmatter, so interruption leaves one file per number. References-only changes are written in place. It rebuilds the affected index and records one `task-migrated` journal event with counts and caller through the log tap. Preview writes no item, index or journal record. A clean second run reports `nothing to do` and writes nothing; a partially migrated tree gets only its remaining changes. If the last file was published before an interrupted index write, apply repairs the derived index even with an empty file plan, leaving every item file unchanged. Preview never repairs the index. A pending temporary write or criterion capture must be recovered before retrying.

Both modes refuse a linked worktree or subdirectory, any caller other than the human or Coordinator, an on-disk territory/merge lock, tracker lock or temporary write, a pending criterion capture, an unfinished merge receipt, and pending `cland sync` or `cland release` recovery. A ladder without root `category` refuses with instructions to run `cland update` and restart the hub. These are on-disk checks, since the migration requires the serving hub to be stopped.

Bodies, comments, existing timestamps, journal history, artifacts, topic bindings, branches and worktrees keep their original bytes and ids. Task filenames keep `T-`. Every old `T-<n>` reference keeps resolving by number after restart, including CLI and MCP task operations, topic bindings, inbox and journal references and `gi` in a thread. Older task branches can still squash-merge; an edit to a renamed container follows Git rename detection or refuses with `merge-conflict`, rather than creating a second item file.

#### Live-tracker procedure and rollback

The Coordinator performs the live migration on `dev` after this slice merges, with a green integrated verification and an empty suite queue. Implementers use temporary projects and scratch copies only.

1. Run `cland update` to provision the root category ladder. Arrange the stand-in's maintenance window and stop the hub (`cland hub stop`).
2. On the root's clean `dev`, create `git tag pre-migration` and copy `.cland/hub.db` beside it as `.cland/hub.db.pre-migration`. Stop must have completed before the copy; keep the tag and database backup until acceptance.
3. Run `cland task migrate --dry-run --json` and keep its output as an artifact after restart. Inspect the plan, then run `cland task migrate --json` and compare it with the preview. Run once more to confirm `nothing to do`.
4. Restart the hub on the migrated tree (`cland hub start`) and relaunch every role session: their previously delivered clauses and briefs carry the old ids. Check old ids resolve and the category tree agrees with the plan.
5. Commit the renamed item files on `dev` and publish with `cland push`.

To roll back within minutes, stop the restarted hub and all role sessions. Preserve any later work first. Restore the pre-migration tracker tree with `git restore --source=pre-migration --staged --worktree -- .cland/tasks` (this also removes newly seeded tracked files; remove any still-untracked migration-created category files named by the kept plan). Restore `.cland/hub.db.pre-migration` over `.cland/hub.db` and remove obsolete `.cland/hub.db-wal` and `.cland/hub.db-shm` only while the hub is stopped. Keep the append-only journal. Commit the restored tracker if the migration was committed, restart the hub and relaunch roles. The tag restores the item files; the database copy restores hub state and its index together.

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

- **Task status (T-120).** Tasks carry explicit frontmatter `status`: `backlog` at creation, `planned`, `in progress`, `review`, `qa`, `ready` or `done`; containers, questions, specs and maps have none. The hub writes and indexes it on the tracker's single queue and carries it in view, list and the existing `task` event. An accepted epic plan sets the current stage's open backlog tasks to `planned` once per stage entry, including blocked tasks; pending approval moves nothing. New members of the current stage move once too, and the next stage advances after landing and any required after-stage QA. Hand statuses stay, including a reset to `backlog`; without a plan, `planned` stays a hand status. Closed epics report all plan stages closed without task writes; reopening restores their derived states. A new Implementer or Aide claim or a not-clear verdict sets `in progress`; a merge or close sets `done`; a reopen without an explicit status sets `backlog`. Done tasks are closed and all other statuses are open. Migration on index persists `done` for closed tasks and `in progress` for open claimed tasks, otherwise `backlog`. Hand edits are re-indexed, including close/reopen edits to state.
- **Manual status.** The Coordinator, the human and an Aide use `cland task edit T-n --status <status>` or MCP `task.edit`'s `status` to choose any status. `done` closes the task and releases the claim; choosing another status reopens it at that status. The Implementer hands over with `task.edit {id, status: "review"}` on its own live claimed item, with no other edits. The permission table checks this right again after file I/O; assignment alone is insufficient. Other sessions cannot set status, even under a whole-tool `task.edit` grant. An explicit state and status in the same edit must agree. Verifier holds and clear, current verdicts also move status as described below.
- **Release planning (T-118).** Kind `release` adds optional frontmatter `version`, semver without the `v` (for example `0.1.0`, including prerelease/build suffixes). Create it with `cland task create "v0.1" --kind release --version 0.1.0`; omit the version until planned and set it with `task edit --version` (`none` clears it). The first configured level owns version and Notes, even when renamed. Other kinds cannot carry a version; malformed versions are refused. Its body holds the goal and `## Notes`, which creation and kind conversion add if missing. The version is indexed, returned in view/list/events and preserved through writes and restarts. Release from the item with `cland release --item T-n` as described under Release and sync.
- **Parenting rule (T-118).** Container kinds are read at hub start from `[tracker] levels = [["release", "category"], "epic"]` in `.cland/config.toml`, ordered top-down. `cland init` writes them; `cland update` upgrades the old default `["release", "epic"]` and keeps and reports every custom ladder. A string names one kind at a level, while a nonempty list groups peer kinds. The first kind of the first level alone owns versions and current-release selection. Other root kinds have no version, status or rank, take the same children as releases and are led by the Coordinator. The defaults are `release / category` › `epic`: a release or category has no parent; an epic takes either root kind or none; a leaf (`task`, `question`, `spec`) takes any container or none. Categories close with no open children and need no planning-level QA verdict. `cland task create "Docs" --kind category` creates a category; `--parent C-n` files work there. Unscheduled means no parent, so category work is outside the release scope's unscheduled fold. Categories never cycle as release scopes; existing epic cycling remains. Maps stay outside the ladder: no parent, children of kind `question` or `task` only (the wayfinder task exception). Create and link share the hub's check; changing a kind through edit or import cannot leave children under a leaf; both share the child-parenting check, including closed children. A hand edit that changes a kind in conflict with its children remains authoritative and posts a notice naming the file. A refusal names the parenting rule. Legacy imported/hand-edited trees remain readable; unrelated edits do not rewrite them. A container takes any kind of the immediately preceding level or none; leaves take any configured container or none. For example `levels = ["release", "epic", "feature"]` accepts a feature under an epic and refuses it under a release. `levels = []` gives a flat tracker. Names must be unique lowercase kind names with distinct first-letter prefixes, and `task`, `question`, `spec`, `map` are reserved; an invalid ladder produces an Agents refusal notice and the defaults stay in force. Unknown item kinds are refused at index with a notice naming the file; valid items continue loading. Restart the hub after changing levels. Closing a configured container with open children is refused, naming each child; close or move them first. There is no force flag, and `task edit --state closed` applies the same guard. A container close or kind change scans the tasks directory once inside the tracker queue, after the final write await and immediately before rename. It reads every task file to discover children by their current disk parent, including hand reparents not yet indexed. Any unreadable task file blocks the operation and is named; child discovery never relies on watcher timing. A hand edit while the directory scan or rename is in flight remains outside the single-user, non-atomic threat model (T-61/T-78); the accepted disk-edit window covers the scan plus rename. A malformed child retains its last known index row and refuses close with its file named until repaired; only an unknown kind removes the index row.
- **Subtree and header (T-118).** `cland task list --under T-n` lists every descendant, excluding the named root, by effective rank then numeric id. It traverses closed ancestors and combines with all other list filters; an unknown root is refused. `task view` prints the root-to-item path in its first line (`T-1  v0.1 › T-2  Schema › T-4  Parser`). CLI JSON and MCP views return it as `item.ancestry`, an ordered array of `{id, kind, title}` including the item. `item.path` remains the file path. Missing/cyclic legacy parents cannot hang a read. MCP tools mirror CLI arguments: `task.create` takes `kind: release` and `version`, `task.edit` takes `version` (null clears), `task.list` takes `under`, and `task.view` returns ancestry.
- **Criterion writes (T-155).** MCP `task.criterion` takes `id`, `op` (`done`, `verify`, `fail`, `add`, `edit`, `remove`), and the stable `criterion` id (except add). `text` supplies add/edit text, `run` supplies the verifier run, and `note` supplies a failure's single-line reason. CLI: `cland task criterion T-n done C1`, `verify C1 --run rev-1`, `fail C1 --note "reason"`, `add "text"`, `edit C1 --text "text"`, `remove C1`. The live claimant Implementer, Coordinator, Aide or human may mark done; Reviewer and QA may verify/fail; Coordinator, Aide or human may add/edit/remove. These limits apply even to a role granted the whole tool. Default grants are Coordinator/Aide `task.criterion`, Implementer `task.criterion:done`, Reviewer/QA `task.criterion:verify` (verify and fail); `task.criterion:manage` is the add/edit/remove scope. An Aide needs no claim for done or management, and cannot verify/fail. First touch assigns legacy ids in order and persists `criterion_seq` in frontmatter so removed ids survive restart. Done writes a sub-item and checks the checkbox. Fail replaces current marks with its note, unchecks the checkbox and reopens in progress; done after a failure requires fresh verification. Edit preserves marks. Malformed sub-items and duplicate ids refuse writes; add also refuses an insertion point inside an unclosed Markdown code fence. An unknown human CLI --as name retains human done/manage rights; known session names retain their session permissions. Subscribers receive `task` events naming `criterion marked`, item, criterion and mark/operation. Criterion and automatic planned-status writes temporarily capture the source and publish without replacing a newer editor save; stale input is refused for retry. Only an observed concurrent save retains a `.conflict` source, named in the error for recovery. Successful writes remove their temporary source after the final original-handle check and leave no conflict capture. The guard covers publication through that check, rather than retaining old editor inodes indefinitely after completion. Recovery files are not indexed and their watcher notifications emit no task events; sources and capture-intent markers are ignored by Git in provisioned projects. Startup recovers a missing live item from an atomic capture-intent marker before indexing, supporting both temporary sources and older `.conflict` intents; existing live files win. Recovery and I/O-error cleanup delete only a source validated against its original hash; changed bytes become `.conflict`, and unreadable or unvalidated sources stay available for recovery. Finalized captures follow the retention policy below; other tracker operations keep their separate policies.

- **Verdict criteria (T-156).** CLI verdict comments accept `--verified C1,C3|all` on clear verdicts or repeated `--failed "C2=note"` on not-clear verdicts. MCP `task.comment` accepts `verified` (the ids string or `all`) and `failed` (`[{criterion, note}]`); socket frames carry them inside `verdict`. Only Reviewer/QA with the criterion verify grant can mark them. The verdict, legacy id assignment and all marks share one tracker write using the criterion hand-save protections. Unknown ids, malformed criteria or invalid notes refuse the whole verdict. Verification carries the verdict run; failure has the same effect as `task.criterion fail`. Successful marks emit criterion events, and the verdict report lists its marks and carries structured `Message.criteria` (message-frame section above).

- **Rank (T-122).** Tasks and configured containers below the root level may have an explicit safe integer `rank` in frontmatter. An absent rank resolves to the numeric id times ten; new items omit it and legacy files are not rewritten. Lists (CLI, MCP and subtree queries) use one shared comparator: effective rank ascending, then numeric id ascending. View, list and event rows always carry the resolved rank, including for unranked kinds. They also carry `rank_set: true` only when the file names an explicit rank, written by hand or by `task.rank`; otherwise the field is omitted. Lists and events derive the field from the existing index rank column, without a schema change or item-file reads for lists; views derive it with the rank from the same file read, even before watcher re-index. Plain `cland task view` labels the rank `(set)` or `(default)`. `cland task rank T-n --top`, `--before T-m` or `--after T-m` and MCP `task.rank` move among items with the same parent; another parent or a self-reference refuses. The default Coordinator takes the lowest-ranked unblocked planned task in the current release: the open configured top-level container with the lowest semver version. Ranking is granted to the Coordinator and the human by default.
- **Rank writes.** An item already in position is untouched. Otherwise the hub chooses a sparse integer between its neighbors (equal ranks are allowed when numeric ids retain order); a dense interval scans outward once on each side, picks the smaller feasible window and fills it evenly, retaining the moved rank when possible. The computation is linear. If no bounded gap exists, the whole rankable sibling list gets spacing ten; an unrankable fixed boundary refuses that fallback. Neighbors commit first, the moved item last, through the tracker queue. The response returns `item`, `changed` ids and ordered `siblings`. After the temporary-write awaits, the hub re-reads disk sibling ranks and parents before rename and refuses stale plans or revoked permissions. The directory scan plus rename remains the accepted hand-edit window. Each file commits atomically; a failed batch reports its committed prefix and can be retried, with no rollback of earlier files. The final event has `siblings`; per-file events expose each committed rank.
- **Retiring the priority label.** After merging T-122, restarting the hub and adding `task.rank` to this project's Coordinator permissions, run `node hub/bin/migrate-high-rank.ts` from the root. It lists items through the CLI and refuses before any writes when more than one item under a parent carries the label (open or closed), naming those items. Each singleton is ranked to the top unless already first, then its label is removed through the hub. Multiple-item support would need stable numeric id order: the original implicit ranks are id × 10 and migration never changes ids. Its JSON report names moved items, old/new ranks, parents and changed ids, plus retired ids. A successful rerun writes nothing; a failed label removal retries without moving the already-first item. The JSON report preserves the committed prefix even on failure. No item files are edited by the script.
- **Writes (T-77)** go through the hub and await an ordered read–change–write–rename–index cycle. One tracker-wide queue admits file mutations, import batches, watcher reads, serving-time rescans and views in call order. A view waits for earlier writes; hand renames, moved frontmatter ids and reindexing cannot put writes to the same file on different queues. Verdict Git resolution runs inside its admitted operation, so later tracker operations wait behind it. A task claim writes its status through the queue and publishes the claim after the file and index commit; it survives a racing comment. Fallback directory listings and stats are asynchronous and share the queue. Import batches reserve the queue before lookup and id allocation, so concurrent first imports cannot duplicate a GitHub reference. Nothing is committed to Git.
- **Storage stalls and shutdown (T-103, T-253).** Once an admitted tracker operation has run for 5000 ms, the hub logs and journals one `tracker-storage-stalled` event with `operation`, `item` (null for a tracker-wide operation), `startedAt` and `thresholdMs`. The threshold measures the whole admitted storage transaction, including native I/O and verdict Git waits. Waiting entries do not start their own timers. `hub status --json` exposes `tracker.storage` with `stalled`, the active operation and elapsed time, the queued count and abandoned operations.

  The 5000 ms threshold is a warning: the operation may complete and the hub keeps serving. A separate fatal deadline defaults to 60 seconds from admission, configurable in `.cland/config.toml` as `[tracker] fatal_stall = "60s"` (a positive integer duration in `s`, `m`, `h` or `d`, at most `2147483s` (about 24.8 days), read at hub startup). Both timers belong to the same operation and are cancelled when it completes or fails; a later operation gets its own deadlines. A slow operation that finishes before the fatal deadline only costs a warning, and its stalled health status clears.

  **Serving-time recovery: fail-fast.** During service, only an operation still outstanding at the fatal deadline immediately freezes tracker admission and all guarded native/index continuations. The hub rejects outstanding calls, including the held operation and its queued successors, with an error naming the stalled operation and item; it never acknowledges them as completed. It records `tracker-storage-abandoned` and `tracker-storage-fatal`, writes the fatal diagnostic to stderr, and tells sessions and the workbench through an Agents notice and a warning in Events. It closes the hub and exits with code 1, even if the held native operation returns during shutdown. Fatal cleanup has a 2000 ms bound; if another shutdown dependency stalls, the CLI reports incomplete cleanup on stderr and exits anyway. The queue is never released to continue serving.

  Writes completed or acknowledged before the stall survive the exit and restart. An unfinished temporary write stays unpublished, and temporary and criterion capture files remain available for startup recovery. An already-issued native rename/link has an uncertain outcome: an in-process fencing token cannot revoke an operation handed to the OS. The hub does not claim to cancel it. Restart rebuilds the index from the durable item files.

  **Restart path.** A supervisor may restart the failed process, or the human runs `cland hub start` in the project. Inspect the operation and item named in `.cland/log/hub.log` or `.cland/journal.jsonl`, read the affected item with `cland task view T-n`, and check the files before retrying any outstanding mutation: an uncertain native publication may already be present. Acknowledged writes need no retry.

  Ordinary hub stop freezes new admission and drains for at most 2000 ms. Freshness shutdown cancels its active native Git command, waits for child close (PID and pipes reaped), and prevents subsequent commands in a patch or epic-demo scan. If work remains, `tracker-storage-abandoned` records the active and queued operations (queued entries have null `startedAt`), rejects their callers and closes the index. Background maintenance can outlive the drain with no active or queued operations, so this event can contain `operations: []`. Shutdown decisions use the tracker's actual abandonment flag, independently of that diagnostic list. Guarded continuations cannot issue further storage calls or index changes. The daemon flushes its shutdown logs and exits with code 1 after abandonment so a pending native request cannot keep it alive. A completed drain leaves the flag false and exits normally. Startup storage work retains stall detection; automatic fail-fast applies once the hub is serving. Tests can independently shorten the warning with `CLAND_TEST_TRACKER_STALL_MS`, the fatal deadline with `CLAND_TEST_TRACKER_FATAL_MS`, and the shutdown drain with `CLAND_TEST_TRACKER_STOP_MS`; these overrides accept finite positive milliseconds; the fatal override also respects the platform timer maximum of 2147483647 ms, otherwise the configured/default deadline applies.

- **Atomicity and completion.** Item text is written to a temporary file in the same directory, then renamed over the item. A failed temporary write or rename rejects the call and cleans up its temporary file; the old item stays intact. A process crash before rename may leave a temporary file, which scans ignore. Results wait for rename, index/evidence updates and notifications; verdict evidence is available when the call returns. As before, there is no `fsync`: completion promises process-crash durability of the replacement, not a power-loss guarantee. Every mutation rechecks the caller's permission immediately before rename; a revoked call removes its temporary file and refuses. Comment writers also recheck their identity, preserving verdict provenance. Each synchronous continuation after Git or file I/O is measured as resumed request work; nested scopes of the same request count as one continuous stretch; disk waits are excluded. Shutdown drains admitted commits and watcher work before closing the index.

**Epic plans (T-183).** The second configured container level (`tracker.ladder[1]`,
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

`--file -` reads YAML from stdin. Split L tasks into 2–3 M tasks before planning; to keep one, repeat `--allow-large <id>=<reason>` for every L lane task. MCP set accepts `allow_large: { "T-n": "reason" }`. Non-empty reasons are recorded in plan history, including when the plan YAML is unchanged. MCP `task.plan` takes `{id, op: "set", yaml}` or
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

- **Synchronous read API.** Construction, the initial `start()` scan and its initial directory stamp run before serving and retain synchronous filesystem calls. `view()`, `mergeView()`, `files()`, `reserveId()` and `rescan()` remain synchronous for standalone/bootstrap use; `cland init` awaits tracker category writes during provisioning before the hub starts. The task CLI has no offline tracker writer: its mutations and reads all call the hub. Serving-time `task.view`, mutations, imports, topic creation and the shared item-launch path use asynchronous APIs. Merge/worktree/release/sync checks also use queued asynchronous views (T-78), including `mergeViewAsync()` for durable verdict evidence; native adapter spawn filesystem calls remain T-79.
- **Conflict capture retention (T-452).** Finalized `<item>.md.<uuid>.conflict` captures are retained for seven days since their latest modification, inode metadata change or creation (the latest of mtime, ctime and birthtime); exactly seven days is still retained. Using the latest timestamp protects a freshly captured or promoted editor source with an old item mtime. The hub schedules asynchronous pruning after tracker startup/recovery and once per hour after each pass, outside the task request queue. Only regular files with that exact capture shape are eligible; canonical `<item>.md` files, symlinks, directories, `.tmp` sources and capture-intent markers are never deleted by retention. Sources named by active capture intents are preserved; malformed/unreadable intents stop that pass conservatively, with failures logged and retried on the next hourly pass. `cland doctor` reports a `tracker conflicts` row with the number of live regular captures and the filenames whose bytes differ from their current item file (including a missing item). It warns when any differ, and never prunes, including with `--fix`. Recover differing bytes before they expire; copy any source needed for longer outside `.cland/tasks`.

- **Hand edits** are picked up by a watcher on the folder (debounced 100 ms) and re-indexed, about 120 ms after the write as the hub log's `task-reindexed` stamps it (the test asserts under a second on that stamp; a `cland task list` poll adds its own process start-up, seconds on a loaded machine); a hand-edited file is read leniently (a missing field takes its default). Last writer wins: a hand edit landing within 2 s of a hub write of the same item, or a hub write finding a hand edit the watcher has not reached yet (the hub's change is then applied on top of it), or a hand edit landing while the hub writes the item (between its read and its rename: the file is checked just before the rename and the replaced file just after; the hand edit is overwritten), is logged as `task-conflict` in the hub's log. A file that cannot be parsed is logged as `task-unreadable` and keeps its last indexed version.
- **Verdict commits and provenance.** `task.comment` accepts `verdict.commit` on the wire, `commit` on the spoke tool, or `--commit <sha>` on the CLI. An explicit SHA must resolve to a commit and is written in full; without it, the hub records the tip of the item's local `branch`, if it resolves. The result includes `commit: {sha, source: "explicit" | "branch" | "none", note}` and the plain CLI prints the note, including when no commit could be recorded. Text verdict headers accept `commit:` too.
- **Verdict findings (T-477).** CLI verdict comments accept repeated `--finding "high|medium|low:text[@file:line]"`; the terminal `@file:line` suffix is optional. MCP `task.comment` accepts `findings: [{severity, text, file?, line?}]` (inside `verdict` on the socket). Each entry needs a supported severity and nonempty text; an optional line is a positive integer with a file. Use `findings: []` for an explicitly empty review. The header stores single-line JSON `findings:` and derived `finding_counts:`. View, list and verdict journal records expose `findings` and `findingCounts: {high, medium, low}`; plain view prints the counts and every entry. Counts are recomputed from entries, never trusted from input. Legacy verdicts without findings retain unknown counts. Findings are part of the durable comment fingerprint, so editing them invalidates its evidence. Clear review verdicts with high or medium entries are refused with an error naming those findings and directing the caller to record `not clear`; low-only clear and omitted legacy findings remain accepted. QA result validation is unchanged. Reviewers record every finding, lows included. Relaunch Reviewer sessions after merge for the new MCP schema and clause.
- **Review scope (T-332).** Review verdicts require `verdict.scope` on the wire, `scope` on MCP `task.comment`, or `--scope full|delta|evidence` on the CLI: full for a first review or reworked design, delta after dev moved under a reviewed branch, evidence for suite evidence alone. QA, including stage QA, refuses scope. The verdict header writes `scope:` after `run:` and `commit:`; text headers carry it too. Additive `scope` columns in `tracker_verdicts` and `tracker_written_verdicts` preserve it through view, list, task events and restart. Older unscoped verdicts remain unknown; scope changes no merge-gate rule. The verdict-posted event names the scope. Relaunch Reviewer sessions after merge to load the MCP schema and clause.
- **Durable verdict evidence.** `tracker_written_verdicts` holds item, kind, result, run, commit, writer session id, role at write time and comment time, plus a fingerprint of the exact comment. This table is never rebuilt from item files. The separate file index gains `commit_sha` and `comment_key` with additive migrations. `task.view` and `task.list` give every verdict `source: "hub" | "file"`; a hub verdict also carries `writer: {sessionId, role}` from the stored evidence, never from `by:`. Each durable record matches at most one comment in write order; duplicate comments and out-of-order replays have file provenance, including when the original occurrence is removed. An unrelated hand edit preserves it; changing the verdict or its comment removes the match. Imported and hand-written verdicts have `file` provenance, even if their `by:` claims a Reviewer.
- **Freshness.** The latest verdict of each kind in file order carries `current: true | false` on view and list. It is current when its commit is the branch tip, or the whole diff from its own merge base has the same `git patch-id --stable` as the tip's diff from its own merge base. The base is the territory’s configured `cland.taskBase`, else `dev` when present, else the recorded default branch (`main` when absent); `verdictBase` says which was used (null if neither exists). Missing or unresolvable commits are stale, and so is a branch with no tip (once a tip read that started after the question finds none: until then it is unknown); unavailable Git facts never establish patch equivalence. Earlier verdicts omit `current`. The Neovim item view and plain CLI show the short commit, current/stale and from the hub/file; Neovim marks stale red. The merge gate selects the latest hub-written verdict, separately from file-only headers.
- **When freshness is computed** (T-67). Read requests (`task.list`, `task.view`) read only the cache; Git work for writes and merges is asynchronous. The hub keeps a cache of answers keyed by (verdict commit, branch tip, base, base tip) and reads every branch tip with one `git for-each-ref` every 2 seconds and about 50 ms after any tracker change; a verdict written through the hub records the tip it just resolved, so it is current at once. An answer the cache does not hold yet (a tip that moved, a verdict hand-edited in) is computed in the background, with separate task/stage and demo lanes, and `current` is absent until then: absent means unknown, not stale. When it arrives, the item is announced again as a `task` event, only if its freshness changed. So after a commit, a rebase or a branch rename, `view` and `list` can show the old answer for up to about 2 seconds, then no answer, then the new one. The background work never starts inside a read: a read that finds a new question only queues it. `verdictBase` comes from the same tip read (null until the first read). A verdict's commit (`--commit`, or the branch tip by default) is resolved with Git before the item is written, asynchronously, so a verdict write blocks no event-loop work; later queued tracker operations wait for it. When Git does not answer at all (it timed out or could not start), the write is refused with code `git-unavailable` and a message naming the commit or branch it could not resolve; nothing is written.
- **Ready and pending freshness (T-121).** Ready uses the merge gate's own durable provenance and freshness evaluation: a current clear Review is always required, plus current clear QA when the resolved stage or item override requires per-item QA. Tasks outside a plan use `[plan] qa_default`. QA-marked criteria require QA verification; plan changes recheck descendant tasks. It rejects evidence from the holder of an Implementer or Aide claim. Verdicts and branch-tip changes schedule this check off the merge path; status writes use the tracker queue and recheck branch tips, file evidence and the item index revision before rename. Every item index change requeues the check; a changed revision drops a prepared write. Status converges after queued watcher/index events, and merge always re-reads the gate evidence. During `review-pending` or `qa-pending`, the UI keeps the last settled status and the gate still refuses merge. Once the check settles, an unchanged patch keeps `ready`; a changed patch or failed/timed-out patch-id check returns it to `in progress`. A new verdict or changed branch/base tips provides a new cache key for another check. Invalidated or failed readiness checks retry with a 50 ms–1 s backoff and stop after ten failed attempts, posting one Agents notice with the item and error. The next item index, verdict or branch-tip event starts the check again.
- **Verifier holds.** Reviewer and QA take `task.hold` (`cland task hold T-n [--release]`) beside the Implementer claim; Reviewer sets `review`, QA sets `qa`. The assignee and claim stay independent. Holds live in `hub.db`, appear as `holds` in view/list/task events, and release on their holder's verdict, explicit release, session stop/death, or item close. A first hello atomically adopts claims, holds and durable verdict writer provenance (including text-header verdict comments) from the provisional name to the session id. The in-memory alias is published only after commit; a failed adoption fences verdict, claim and hold work until a queued retry succeeds. At hub startup and Sessions binding, the hub scans durable provisional claims, holds and writer provenance, reconstructs fences for every known session identity, and retries atomic adoption before real-id work. Unknown identities remain provisional. Gate and ready evidence also resolve identities through the hub’s authoritative session mapping. At startup, binding Sessions reconciles holds of known non-running process identities; unknown and direct identities keep their holds. Release without a verdict preserves the review or QA status while gate evidence is missing or pending, including release on stop and startup reconciliation. If the required verdicts are already clear and current, the gate evidence takes priority and the queued check settles at ready, including after a repeated hold is released.
- **The index** (items, labels, blockers, verdicts) is rebuilt from the files at every start. `--verdict review=clear` matches the item's latest verdict of that kind.
- **Claims** are a session's live hold on an item, kept in `hub.db` (they survive a restart), never written to the file and distinct from `assignee`. A claim is held by the claimer's identity, not its name: a spoke's session id (a rename keeps the claim; another session taking the old name gets none of it), or `human` / `cli:<name>` for the CLI, which is never a session. `view` shows the holder's name (`session`) beside its identity (`sessionId`); the holder claiming again refreshes the name. Another holder's claim is refused unless forced; closing an item releases its claim.

`cland task …` speaks to the project's hub over its socket (a hub must be running: `cland hub start`); every subcommand prints a human-readable summary, or the raw result with `--json`. In a launched session's shell (`$CLAND_SESSION_ID` or `$CLAND_SESSION_NAME` set) it always acts as that session and sends its `$CLAND_SESSION_ID`: `--as` (the human's name, another session's, the Coordinator's) cannot change that, and a different `--as` only earns a note on stderr. Outside a session it acts as `--as <name> [--role r]`, else `human`. On the wire a frame's session id decides before its name: a frame carrying one is that session's call even when it names `human`. What stays open: a shell that unsets both variables is the human's, as any process holding the hub's socket is (the CLI's identity is its environment). Acting as a session the hub knows (by that id, or a name a session holds or held), the call is that session's: checked against the role the hub holds for it, audited as it, its claims held by its session id (Roles, Permissions); the frame's `--role` is then ignored. A name no session ever had is a CLI actor (`cli:<name>`), unrestricted as the human is. The hub refuses a name outside the session-name grammar (`[a-z0-9][a-z0-9-]{0,23}`, not reserved) and a role that is not one of the role names: both are written into item files.

| Command | Tool | What it does |
| --- | --- | --- |
| `cland task create <title> [--kind] [--size] [--regression-of] [--found-by] [--version] [--body \| --body-file] [--label]… [--assignee] [--parent] [--blocked-by]… [--topic] [--branch]` | `task.create` | Writes a new item file. |
| `cland task view <id>` | `task.view` | Frontmatter, file path, ancestry, body, plan (and planError on an invalid hand save), criteria and their warnings, comments, verdicts and the claim. |
| `cland task plan <set\|show> <epic-id> [--file plan.yaml]` | `task.plan` | Validates and writes, or shows, the epic plan (Epic plans above). |
| `cland task list [--under T-n] [--state] [--label]… [--kind] [--assignee] [--verdict review=clear]` | `task.list` | Queries the index. Each item carries its claim and its verdicts in file order (the latest last). |
| `cland task comment <id> <text> [--verdict review\|qa --result clear\|"not clear" --run <id> [--commit <sha>] [--scope full\|delta\|evidence]]` | `task.comment` | Appends a comment, or a verdict. |
| `cland task edit <id> [--version] [--title] [--body] [--kind] [--size] [--state] [--status] [--label]… [--add-label]… [--remove-label]… [--assignee]` | `task.edit` | Changes fields; `none` clears the assignee. |
| `cland task close <id> [--comment]` | `task.close` | Closes the item. |
| `cland task link <id> [--regression-of] [--parent] [--blocked-by]… [--unblock]… [--follows]… [--unfollow]… [--topic] [--branch]` | `task.link` | Sets the links; `none` clears one. |
| `cland task hold <id> [--release]` | `task.hold` | Reviewer or QA takes/releases its own verifier hold beside the Implementer claim. |
| `cland task criterion <id> <op> …` | `task.criterion` | Done, verify, fail, add, edit and remove criteria with role and claim checks. |
| `cland task rank <id> --top/--before T-n/--after T-n` | `task.rank` | Moves among siblings with minimal rank writes; returns changed and ordered sibling ids. |
| `cland task claim <id> [--release] [--force]` | `task.claim` | Takes or releases the claim. Claiming an open task in a project with a territory makes or reuses its branch and worktree (Task branches and worktrees). |
| `cland task import-github [--repo owner/name] [--all]` | — (`task.import` frames) | Imports GitHub Issues as items (below). |

UI clients can send `{type: "task.list", id: "open-items", projection: "summary", state: "open"}`.
The optional `summary` projection returns id, kind, title, state, task status and size,
labels, parent, blockers, claim, verifier holds and criteria counts.
`open_blockers` resolves the still-open blocker ids in the hub's complete index.
Task events carry this field too; closing, reopening or deleting a blocker refreshes
its dependents. Unknown blockers remain open.
It retains version, explicit rank, updated/closed times for ordering and cache invalidation, and only the
latest verdict per kind in file order, including its original `round`, `scope` and
one-line `reason` for open items. Closed rows defer these three card fields to
the bounded by-id read below. Findings, bodies, comments, full criteria, plans, verification
and index bookkeeping are excluded; clients read those details through `task.view`. State and other existing
filters combine normally. Unknown projections refuse. Omitting `projection` preserves
the existing response, including the CLI's `cland task list --json`; the CLI adds no
projection flag. Neovim requests `state:"open", include_containers:true` first: this
returns the same item set as the connection snapshot: open rows and their ancestors.
The flag accepts only an open summary request without other list filters.

The items snapshot contains open rows and the complete ancestor chain of each
open row, including a closed ancestor when legacy data puts open work below it.
Fully closed container subtrees stay outside the first payload. Retained rows
keep complete roll-ups from the full tracker index. The items domain also carries `done_items`,
the complete number of rows whose state is closed or task status is done. Task
mutation deltas, including file removals with `item:null`, carry the same
authoritative count, so hiding unloaded rows
preserves the total without client counting. Closed items of every kind are read per direct parent:
`{type:"task.list", id:"closed", projection:"summary", state:"closed", parent:"E-12", limit:100}`
returns `{items:[...], total, next}`. `parent:""` selects closed roots and closed items whose
parent is missing. Newly loaded containers expose their own child pages. A page contains at most 100 compact rows and reserves envelope
space below the 256 KiB reply budget; one oversized row refuses explicitly. Repeat
with `cursor:next` until `next:null`. Numeric task identity orders the cursor, so
re-ranking or deleting the cursor row does not skip later identities. `total`
counts matching closed items at that read; concurrent changes arrive as normal
task deltas. Clients replay those changes over a page in flight and deduplicate by
item identity. Closing tasks still arrive in deltas, leave the client's open set,
and update any loaded closed parent page. Reconnection renews requested pages.
Parent pages accept only parent, cursor and limit alongside the summary/closed
selector; ids and other list filters cannot combine with them.
Container summaries (including default lists and task events) include `child_counts`:
`total`, `done`, a sparse `statuses` histogram and `work` counts for `in progress`,
`review` and `qa`. The complete tracker index supplies these before list filters
apply, so unloaded closed children count from the first render. Progress counts a
release's direct containers and other containers' direct tasks; release work counts
all descendant tasks. Other work counts direct tasks. Closing, reopening, moving,
creating or removing a child publishes changed parent/ancestor task events;
clients do not need to re-read the list. Closed rows still load only on demand.

Item snapshots, summary lists and task deltas also carry `summary: {text?, from,
provenance}`, `blocked`, `derived_status`, `glyph` and `layer`. The summary follows
the plugin's `explorer_summary.lua` rule (v0.1.2 §3.9): an explicit `## Summary`
wins verbatim; otherwise the first eligible prose paragraph or list item supplies
up to two sentences and 50 words, after leading provenance sentences are removed.
`from` is `written`, the source section heading, or null for the body. `provenance`
is the fallback line shown by the Lua card, or null for written/empty summaries.
`blocked` means an unfinished item has an unresolved blocker, including an unknown
id; an active task keeps its status glyph even when blocked.

For open items, card facts also travel in snapshots, summary lists and task deltas:

- `verdicts[].reason` is the matching verdict comment's first sentence, collapsed
  to one line and capped at 96 Unicode code points. The subtree's
  `rollup.latest_verdict` carries the reason too. `round` counts that verdict kind
  in file order; `scope` remains the recorded source/evidence review scope.
- `decision: {text, by, at}` is the latest comment beginning with `Resolution`
  or `Decided` (optional Markdown heading/emphasis), using the Lua card's summary
  rule. Its single-line text preview is capped at 300 code points. Both prose
  previews end with `…` when truncated; full comments stay in `task.view`.
- `created`, `branch`, `regression_of` and `follows` supply the card's dates and
  relations. `verify` is null or the latest compact receipt: `{id, executor,
  state, result, head, finished, cached?:true}`. It omits artifact paths and the
  full cache lineage. These transport-only fields travel in open item snapshots
  and deltas; ordinary `task.list` summaries omit them to protect Neovim's first
  payload budget. By-id pages include the complete compact tree row (identity, kind, title, state,
  parent, counts and relations) alongside those card facts for any item, so item-id
  links can load a missing row and walk its ancestors without reading its body.
  Each page retains the 256 KiB bound. Closed rows receive
  them only on that page.
- `agents_text: {sections, words}` lists the body's level-two headings in order
  and its whitespace-delimited word count, matching `explorer_summary.outline`.
- Every container with an accepted plan, open or closed, carries `stages`, in plan order:
  `{name, state, qa, merged, total, statuses}`. States use the existing stage gate;
  `merged` counts closed members with a dev landing receipt (closed non-task
  members need no task receipt), and `total` includes every planned member,
  including unloaded closed items. `statuses` is the complete sparse histogram.
  Stage facts refresh on member changes, plan edits and stage-cover settlement.
  Lane membership, QA evidence and full plan history remain on demand through
  `task.plan show`; that detail response includes the same stage counts.

These facts let a card read verdict reasons, decisions, stage states and the text
fold line without fetching each item's full text or each epic's plan. Neovim's
stage counters consume the hub's counts; the rest of its card-detail adoption is
separate work. Older hubs retain explicitly labelled loaded-only counters.

A container has `next` (the first unblocked planned task in rank-ordered tree
order, with open ancestors, or null) and `rollup`: the highest descendant-task
`layer` (or null for no tasks), `stage` (`{number,total,name}` for the first open
stage, else null), `claims` (`{item,claim}`), `holds` (`{item,hold}`),
`latest_verdict` (the subtree verdict with its item id, title and round, else null),
and `last_activity` (`{at,item,title,source}`). Verdicts come from descendants;
activity includes the container itself and topic messages. Equal verdict times
choose the later row in rank-ordered traversal; equal activity times retain the
first source. Open containers whose children are all done remain backlog until
the container closes, matching Lua. The top-level `layer` is the item's visibility;
`rollup.layer` is the container card's derived task layer.

The 2026-10-21 T-1052 decision keeps the items snapshot cap at 1 MiB. Only open
items carry `summary.text` in ordinary snapshots, lists and deltas. Closed items
retain provenance and the inexpensive fields. Read their full text in batches:
`{type:"task.list", id:"closed-text", projection:"summary", ids:["T-12","T-14"]}`
returns `{items:[{id,summary,agents_text,decision?,verdicts,created,branch,regression_of?,follows?,verify}], remaining:[...]}`.
The 2026-10-21 T-1058 Coordinator decision puts closed items' card facts on these
same pages: verdict reasons, rounds and scopes, Decision previews and text outlines
stay out of closed snapshot/list/delta rows. Stage facts remain on all planned
containers. The copied-live boundary test measures and asserts the items snapshot
at or below 50% of 1 MiB after excluding fully closed subtrees. The Lua differential
guard recursively restores closed rows through parent pages, deduplicates retained
ancestors by identity, and compares every body.
Supply at most 100 ids and repeat
with `remaining` until empty. Each page reserves envelope space within the 256 KiB
reply budget; an individual text-and-card row exceeding that budget refuses explicitly.
Ids require the summary projection and the existing `task.list` read permission.
The CLI's flags are unchanged. Full agents' text still comes from `task.view`.

These fields are in-memory projections, never written to item files (ADR 0002).
Parsed-body summaries are cached at indexing. A change recomputes that row and
its ancestor chain from cached child aggregates; a move also invalidates the old
chain. Ancestor state/reparenting changes also invalidate descendant containers
whose effective `next` changes, since Lua checks parents above the scoped
container too. Ordinary task edits still touch only their ancestor chain.
Blocker-state changes invalidate dependents and their ancestors; topic
messages and visibility changes invalidate the affected context and chains.
Only changed rows are published, including stage-only changes on asynchronous
cover/tree settlement and freshness/claim/hold changes. Pending verdict
freshness remains guarded.
`explorer-recomputed` diagnostics name the touched ids and synchronous duration;
they exclude file I/O, transport and Git waits. The differential test preserves
Lua parity on every copied tracker body, fetching closed text through bounded
pages, and checks the copied snapshot cap (833,088 bytes for 1,063 copied items plus three ancestor-regression rows on
2026-10-21). Oversized open sets still refuse atomically; item-domain paging is
separate work.

Lane order is a separate `follows` list beside `blocked_by` in epic frontmatter. Set it with `cland task create "Next epic" --kind epic --follows E-1`, or `cland task link E-2 --follows E-1`; remove an edge with `--unfollow E-1`. Repeated flags and the matching `task.create` / `task.link` tool fields take multiple ids. Any recognized prefix or bare number resolves to the canonical epic id; non-epic endpoints and cycles refuse. `task.view`, the card and explorer show follows beside blockers. Only `blocked_by` marks an item blocked.

A follow is met when its predecessor is closed, or has task children all closed with its last ticket merged on dev. Plain `task view` shows `follows E-1: met` or the open tickets (and explains an empty or unmerged predecessor); JSON supplies `followStatus`. Prepare the next epic’s tickets and plan while every ticket of the predecessor’s last stage is in review, then launch its first stage on the last merge, subject to real blockers and plan approval.

While that open predecessor’s follow is met and its demo is pending, the merge gate returns `merge-hold` only for follower tickets touching its merge surfaces. The exported `epicMergeFiles(root, taskIds, ref, env?)` helper in `src/tracker/epic-surfaces.ts` reads `Item:` trailers on dev and includes both sides of renames and deleted paths. The gate names the predecessor, pending demo and overlapping files. Unrelated files merge at once; either recorded hub QA demo verdict (clear or not clear, excluding stage verdicts) or predecessor closure releases the hold. Epic demos still close epics and gate release.

The frames are `{"type":"task.<op>","id":"<request id>","item":"T-1",…}` with fields named as in the frontmatter (`labels`, `blocked_by`, `add_labels`, …); a CLI frame may carry `"as":{"name":…,"role":…}`, a spoke's always acts as its own session. The tools take the item as `id`.

### Importing GitHub Issues

`cland task import-github [--repo owner/name] [--all]` is the one-shot bootstrap of the tracker from a repository's GitHub Issues (spec 6). During onboarding, an Aide imports the existing project's open issues on the human's confirmation; existing projects with an explicit `[aide.permissions] tools` list add `"task.import"`. It reads GitHub through the `gh` CLI with the user's own login (no token is stored anywhere): the issues (pull requests skipped; open ones, closed too with `--all`; the repository defaults to the first GitHub repository named by `github`, then `origin`; pass `--repo owner/name` when neither names one), each issue's comments and its `blocked_by` dependencies; the parent comes from the issue's sub-issue relation. The hub then writes one item per issue:

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

At the repository root, `npm run check` runs typechecking and static/test lint.
Its T0 dictionary membership guard checks `hub/src`: string-indexed records,
`any`, `unknown`, bare objects and dynamic or undeclared keys use `Object.hasOwn` or `Map.has`.
Narrowing by a declared finite key stays allowed. Intentional prototype-chain checks
need `// cland-allow-in: <reason>` on the same or preceding line; diagnostics
include file and line. See [the testing guide](../docs/agents/tests.md).

`npm run typecheck` uses the native TypeScript 7.0.2 compiler, pinned under the
`typescript7` npm alias. The root command checks both `hub/tsconfig.json` (bin,
src and test) and `nvim/tsconfig.json` (bin and test); the hub command checks the
hub project. Both scripts use `hub/bin/typecheck.ts` to resolve the alias from
local or ancestor installs, including dependency-free task worktrees, because
both compiler packages provide a `tsc` executable. TypeScript 5.9.3 remains installed
as `typescript` for the compiler API used by `hub/test/executor.test.ts` and
`hub/test/lint-tracker-container-source.ts`; TypeScript 7 does not provide that
API. Adoption was gated on matching diagnostic codes, files and lines on both
clean projects and planted strict-option/import errors (T-427).

### Verification commands

Record the stack's commands with `cland config set verification.prepare|check|test`
(one key per invocation). These are project commands, independent of the language:

| Key under `[verification]` | Purpose | Where it runs |
| --- | --- | --- |
| `prepare` | Install what check and test need; optional | On the droplet builder when preparing an image, and after checkout cleanup before every droplet run; never locally |
| `check` | Fast gate; optional | Before test locally, and on the host before a droplet is created; the droplet checks again unless it can reuse the matching host receipt |
| `test` | Suite whose exit code decides the run | Locally or on the droplet, after check |

Set `test` before verifying: without it (or the optional tier commands described
below), `cland verify` refuses and names the configuration command. Empty strings
are unset. Each command runs from the candidate project directory under
`/bin/sh -c`; shell quoting, pipes and compound commands retain their meaning.
A failed check stops the run. An unset check or prepare is logged and skipped.

For example, in a Python project after `cland init` and `cland hub start`:

```sh
cland config set verification.check 'python3 -m compileall -q .'
cland config set verification.test 'python3 -m unittest'
```

This project needs no prepare command if its tests use only Python's standard
library. A project with dependencies can also set, for example,
`cland config set verification.prepare 'python3 -m venv .venv && .venv/bin/pip install -r requirements.txt'`,
then use `.venv/bin/python` in check and test. Ignore `.venv/` and `__pycache__/`
in Git. Install local dependencies yourself: a local run never calls prepare.

Commands are resolved once at admission from the candidate's working
`.cland/config.toml`, or its committed file for a committed candidate; unset
commands fall back to the project root's config. Queued runs keep the recorded
commands across reloads. Commit configuration changes before a droplet run:
only a clean candidate's committed Git objects are bundled (tracker and rulebook
edits have the exclusions described below).

Verification identity and tree exclusions have one definition in
`verification-tree.ts`; admission owns selection policy and pins the command
plan, tiers and base for execution, cache lookup and reports. Reuse a receipt only
when command, tree, tier and occasion coverage, and execution overrides all match.
Release requests also require the effective executor and OS (Linux for droplets,
the host OS for local runs), including when the executor comes from configuration.
Persist stage and schedule state in durable records rather than reconstructing
it from transient history or message text.

Prepare must be idempotent and write only ignored files, leaving HEAD and tracked
files unchanged. Delivery cleans the checkout before rerunning it, preserving
`node_modules` and `.cache`; other ignored checkout outputs can disappear.
Caches under `$HOME` survive. Both fresh builders and run deliveries receive
`CLAND_PREPARE_KEY` as JSON describing the snapshot inputs; a matching key alone
is no proof that a fresh builder has installed dependencies. A failed prepare or
unignored output stops delivery before tests, with its output in the run log.

A project using only `test` runs that command in full. Coverage selection, the
`hub` and `nvim` package modes, the load gate and file sharding belong to cland's
own runner; another stack does not acquire them by configuring these commands.
Use mode-free `cland verify --report <topic>` for ordinary task verification.
Optional tier commands let any stack split execution explicitly; they do not
supply cland's file selection. This repository's values, modes, covers and shards
are documented in [agent test guidance](../docs/agents/tests.md#this-repositorys-verification-commands).

### Remote executors: droplets

Project test commands are configured under `[verification]`: `test_unit` (T1),
`test_component` (T2), `test_integration` (T3), and `test_soak` (T4).
Each is a POSIX shell command; empty means unset. Use
`cland config set verification.test_unit '<command>'` to store it verbatim.
Tasks with hosting batch protection run `check`, unit and component; merge batches run commands matching `merge.batch_tiers` (default unit/integration; this repo unit only); periodic `dev-t3` runs integration;
integrated dev, explicit `all` and tasks without batch protection run T1–T3; occasions and nightly soak run all
four. Tier lines report exit, duration and output tail. Admission records the
commands so config reloads cannot change queued evidence. With only `test` set,
the whole command runs per task and `[merge] queue` defaults to `false`.
Enable it for batch landing; `merge.batch` (default 3) and `merge.batch_wait`
(default `"10m"`) set the maximum heads and oldest-request wait, and both are
settable through `cland config set`. See [test guidance](../docs/agents/tests.md).

Choose the project default with `[verification] executor = "local"` (the default)
or `"droplet"` in `.cland/config.toml`; restart the hub to apply scheduling changes.
`cland verify --executor local|droplet --report <topic>` overrides it for one run.
Use `--executor local` on a macOS host for a macOS-only question or when the human
asks. Both executors share admission order, the tree/mode cache and the
artifact-backed result. Review source first, then verify the exact reviewed head
(D25), whichever executor runs it.

#### Close runs

`cland verify all --occasion stage|epic|release --report <topic>` shards remote
integrated `dev` closes. The Coordinator may name any occasion; QA may name `epic`
for an epic demo. The project-root checkout must be clean, on `dev`, at freshly
fetched `origin/dev`. Other roles and task heads are refused. The MCP `verify`
tool takes the same `occasion` field. Batch and task runs stay on one slot;
`--executor local` keeps a close run local.

Every `after-stage` gate, including a stage with `qa.scope: none`, requires green
integrated full-suite receipts at the same verification tree on **Linux droplets
and macOS**. The Linux receipt comes from `--occasion stage` (normally sharded);
the Mac receipt comes from a local full run on macOS. A stage with a QA scope also
needs its clear stage QA verdict on that tree. Per-item stages keep their existing
gate. `task plan show` names each missing platform and the expected tree. A stage
request runs the chosen executor and its result names the other platform still
missing; the Coordinator submits that run separately, using `--executor local` on
the Mac. Cache reuse for stage requests preserves the executor and platform, so a
Linux cache hit cannot stand in for a Mac run. Completed stages remain closed
across later descendant builds, while their plan and landing evidence stay valid.

Restored covers can await background tree or ancestry checks. `task plan show`
reports those platforms as `pending`, not `missing`; JSON covers include an optional
`pending` platform array. A stage QA verdict's `current` stays absent until its
facts settle. Pending evidence holds stage closure and advancement. Stage ancestry
and task merge-gate comparisons run in a foreground lane independent of epic-demo
history scans. Demo surfaces and intervening changes each use one batched Git
history read, retaining every changed commit (including reverted edits and side
branches), rename/deletion paths and conflict commit identities. Closed epics
read cached demo currency without scheduling scans; an uncomputed answer stays
unknown, and reopening an epic restores background checks. Both lanes share the
tracker's shutdown cancellation and drain ownership.
The copied-tracker restoration probe and its stronger checkpoint-recompute mode
are described in [Implementer test selection](../docs/agents/tests.md#implementer-test-selection).

At admission, free remote slots up to `[verification] shards` (default 2) set the
shard count. Hub files are placed largest-first on the lightest shard using
`hub/test/durations.json` `files[*].seconds`; unknown files use the manifest
median. Neovim goes to the shard with the least hub time, on that same droplet.
`CLAND_SUITE_SELECTION` carries each explicit file list into the package runner, which retains free/machine classification inside that shard. Selections above 64 KiB, including large stage identity baselines, use a delivered JSON file named by `CLAND_SUITE_SELECTION_FILE` on both executors; test workers and repetition workers inherit neither selection variable.

The hub atomically reserves the whole group's estimated lifetime cost against
the shared daily ledger ($3 here) before creating machines. When the cap cannot
cover every shard, or fewer than two remote slots are free, it runs whole on one
slot with one warn notice: `sharding skipped: daily spend cap $3 would be exceeded`
or `sharding skipped: fewer than 2 remote slots free`. A provider failure after
sharded admission fails the run; shards are not silently retried or run locally.

One merged result sums counts, labels failed/lost shards, lists each machine,
size, duration and cost, total cost, and wall from admission to final collection.
The merged log and one log per shard are durable artifacts. Leases and child
receipts survive hub restart, and confirmed deletion precedes slot release.
An identical green tree/mode cache entry with matching soak coverage serves a later occasion request. Ordinary batch greens cannot satisfy occasions. Stage
and release requests also match the effective executor/platform; a stage's Linux cache must
itself cover a stage close.
Two c-8 machines with ten-minute lifetimes estimate $0.0833 total at $0.25/hour;
provisioning and cleanup add to billed lifetime. Read measured costs in each run.

#### Configuration and costs

| Key | Default | This project's D27 build value |
| --- | --- | --- |
| `[verification] executor` | `local` | `local` during the build; `droplet` after E-271 closes |
| `budget` | `1` (local cap) | `1` |
| `remote_budget` | `4` | `2` |
| `local_fallback` | `true` | `false` |
| `shards` | `2` (positive integer) | default |
| `lock_path` | `/tmp/cland-suite.lock` | default |
| `cache_max_age_minutes` | `1440` | default |
| `lifetime` | `110m` | `60m` |
| `run_timeout` | `75m` | `50m` |
| `daily_spend_usd` | `5` | `3` |
| `[verification.droplet] size` | `c-8` | default |
| `prepare_size` | `c-8` | default |
| `regions` | `["lon1", "nyc1", "sfo2"]` | default |
| `image` | `ubuntu-24-04-x64` | default |

`lifetime` and `run_timeout` are positive duration strings (`s`, `m`, `h`, `d`);
the lifetime must cover the timeout plus ten minutes. Droplet settings are read
again at each acquire; invalid values name their config key. The first available
configured region offering the size and holding the prepared image wins.

One local run uses the host's compatibility leases. Up to `remote_budget` droplet
runs proceed beside it, using their own machines' locks. A full remote budget with `local_fallback = true` (the default)
may send a default droplet request to a free local slot with a warning; with both budgets full,
it waits. `cland verify queue` shows `local:`, a `remote <used>/<budget>:` line per
remote run with session, item, machine, size, region and ETA, and waiters naming
their executor and the `local fallback: true|false` policy (`localFallback` in JSON).
With `local_fallback = false`, default droplet requests follow the same remote-only
policy as explicit `--executor droplet` requests: they stay queued for remote
capacity (including durable leases pending cleanup), labelled `waiting for remote`
with their position; later local requests can pass them. Their admission ETA
uses remote capacity only. JSON waiters include `waitingFor: "remote"`. A machine
still being acquired is shown as `acquiring`.

At [DigitalOcean's listed rates](https://www.digitalocean.com/pricing/droplets),
c-8 costs $0.25/hour and c-16 $0.50/hour. A full suite on c-8 costs about $0.10
(roughly 24 minutes); c-16 costs twice as much per hour, with its run cost depending
on duration. Billing is per second with a 60-second or $0.01 minimum, whichever
is higher. cland's result estimates cost from the size's hourly price and lifetime
with a 60-second minimum; it is not an invoice. [Droplet snapshot storage](https://docs.digitalocean.com/products/snapshots/details/pricing/)
costs $0.06 per GB-month, separately from run and builder time.

#### Controls and the prepared snapshot

The hub owns the lifecycle: sessions never create, list or delete droplets by
hand. `cland executor status|prepare|reap|retire-legacy` belongs to the human and Coordinator.
Under D27, T-282's hand driver retired when T-346 merged; Linux proof runs now
use `cland verify --executor droplet` under the hub's enforced limits. The stand-in
keeps the hourly tag check; the hub's sweep and watchdog do the automatic cleanup.
Legacy hand-driver droplets carry only `cland` and are swept only after the
configured lifetime plus ten minutes.

The droplet lifecycle uses DigitalOcean's REST API. Set `DIGITALOCEAN_TOKEN` in the
shell that starts the hub. Each API call reads it at use and sends it only in the
Authorization header; cland never prints, logs or saves its value, or sends it to a droplet. Calls
have a 15-second bound and do not retry creates. The lifecycle needs permission
to read the account, sizes and regions, and to create, read and delete droplets
and account SSH keys. See the [DigitalOcean API reference](https://docs.digitalocean.com/reference/api/reference/).

`cland executor prepare [--report <topic>] [--json]` submits a hub-owned snapshot
job and exits. Status shows its step and elapsed time; one hub notice in the
chosen topic (General by default) reports the key, image, regions, duration,
builder lifetime and cost. A second prepare while one runs is refused.
Preparation and the other executor controls belong to the human and Coordinator.

The snapshot contains the base packages, the host's exact Node version, the
ordinary `runner` user, a bare repository mirror and a checkout of the base, plus
what the project's prepare command installs (for cland: `node_modules`, pinned
Neovim and Chrome Headless Shell). Root provisioning installs the Ubuntu 24.04
Chromium runtime libraries before the runner's `npm ci` installs the pinned shell.
Its key combines Node, the Neovim tag and Linux digest, the committed
base's lockfile SHA-256, and `origin/dev` after a fetch from the local territory.
A matching prepare reports `current`; a new key builds a replacement and deletes
the previous image only after the new image completes. Failures clean up the
builder and partial image while keeping the previous snapshot. Status includes
the image's size in GB.

The record lives in `.cland/run/executor/snapshot.json`, mirrored in `hub.db` under
`executor-snapshot`. Status lists its key and `current` or `stale: base|lock|node|nvim`
for the inputs that moved. A moved base increases future delivery bundles;
changed install inputs need reseeding during a run. Re-prepare after a release or
a lockfile change; this is a human or Coordinator action, never automatic.
After provisioning changes land, restart the hub onto that code before preparing:
the root cloud-init template comes from the running hub, while a delivered branch's
prepare command runs as the non-root runner. Collect Web evidence on the rebuilt image.

Acquire creates from the image, without user data, only in regions holding it.
It polls until active with a public IPv4 address under a five-minute bound,
then waits up to 180 seconds for SSH as `runner` to answer and for the image marker
to match the recorded key; a mismatch or timeout releases the droplet. Without
an image it refuses with `no prepared snapshot; run cland executor prepare`.
The image's per-boot script copies the newly injected root key to `runner`.
Private SSH/SCP calls use the lease key, ignore host SSH config and known-hosts
files, have explicit time bounds and strip `DIGITALOCEAN_TOKEN` from children.
`CLAND_SSH_BIN` and `CLAND_SCP_BIN` select alternative transports for tests.

`prepare_size` selects the builder; its disk must be no larger than `size`'s disk
so the resulting snapshot fits a run. Prepare refuses an oversized builder
before creating anything. The builder uses the same lease, tags, watchdog and
release as a run, installs the exact versions with digest checks, delivers from
the territory and runs the root's configured prepare command as `runner` (or
reports `prepare: not set`). It powers off before snapshotting,
polls actions under a twenty-minute bound, transfers to configured regions and
tags the image `cland` and `cland-p-<hash>`, then releases the builder.

Preparation owns its promise through shutdown: stopping the hub cancels machine
work and drains release and the outcome notice before closing the database.
Before submitting a snapshot action it saves image-recovery ownership under
`.cland/run/executor/snapshot-recovery/`. Restart and the lease retry timer retain
that ownership through late actions, delayed catalogues and refused image
deletions. Status lists outstanding recovery. An ambiguous old-image deletion
keeps the completed replacement until provider state decides whether to retain
it or restore the previous image; a failed catalogue read never counts as
absence. Recovery matches images to their builder, so a later prepare of the
same key cannot lose its image to an older failed attempt.
Once retirement is submitted, old-image presence may be stale or deletion may
still be running: cland keeps the replacement and retries retirement until the
old image is absent. Only an unstarted or definitely rejected delete permits
rollback to the old image.

`cland executor status [--json]` also reports token presence, live leases, their names,
ids, sizes, regions, ages and deadlines, whether each watchdog is alive, today's
spent and reserved USD against the daily cap, the shared ledger path, and the
number of droplets tagged `cland`.
`cland executor reap [--json]` deletes this project's tagged droplets with no live
lease, and unowned `cland` droplets past their lifetime plus ten minutes. Known
leases use their own recorded deadline: a short-lived scratch hub preserves a
foreign live run. Provider lists are followed by fresh durable ownership reads,
so concurrent acquisition cannot make a new resource look orphaned.
It also removes this project's orphaned account SSH keys. New key names start
with the droplet project tag, `cland-p-<hash>-`, so equally named projects cannot
reap each other's in-flight keys. Legacy `cland-<name>-` keys are removed only
when no live lease registered on this host names them and their known lease
creation/import time is older than lifetime plus ten minutes. Unknown-age legacy
keys are preserved: DigitalOcean's [SSH key schema](https://docs.digitalocean.com/reference/api/reference/ssh-keys/) has no creation timestamp. Hubs register their project roots
in the shared ledger so cleanup can inspect other projects' durable leases. Both commands belong
to the human and the Coordinator; reap requires the token.

#### Run and result

Before acquiring a droplet, the hub runs the recorded check command at the
submitted head on the host (`Host gate: <command>`). A failure posts
`host check failed (exit <n>); no droplet created`; an unset check logs
`Host gate: check not set` and continues. Delivery
bundles the head against its merge base with the prepared snapshot's base; without
a merge base, or when the bundle would be empty, it sends a full bundle. As `runner`,
the machine fetches that bundle, checks out the exact detached head and cleans the
checkout while preserving `node_modules` and `.cache`, then runs the recorded
prepare command on every delivery with `CLAND_PREPARE_KEY` as JSON. It rejects
changed HEAD, tracked edits and unignored output before starting the worker.

Cland's own prepare script (`node hub/bin/verify-prepare.ts`) runs `npm ci` and
seeds the Neovim pin when needed. It skips only when the snapshot inputs and a
successful-install marker (`node_modules/.cland-prepare-key`) match. Existing
images can use `$HOME/.cland-image.json` as a legacy receipt while dependencies
still exist; fresh builders install even with a matching key. The log retains
`dependencies match snapshot` and `Neovim pin matches snapshot` for warm runs.

Delivery ignores uncommitted changes under `.cland/tasks` and to `.cland/RULES.md`, including tracker writes
between submission and bundling. Every bundle contains the committed head's tracker
state; this applies to each shard of an occasion run too. Other dirty files still
refuse delivery, with their paths in the error. Integrated dev runs permit a changed
head only when the canonical candidate tree is unchanged; delivery still bundles
the submitted head. Task runs require their exact submitted head.

The host computes the suite selection while `origin/dev` is available. The uploaded
`env` carries the selection (inline JSON or a delivered selection file), worker
and limit settings, and `FORCE_COLOR=0` / `NO_COLOR=1`.
Cland's package runner reads that selection without fetching. A detached `setsid nohup`
run as `runner` executes the recorded check and test plan. A successful host check
is reused only when its command and candidate tree match; otherwise check runs
on the droplet before test. It uses the machine's own compatibility locks
and `timeout` with the configured `run_timeout`. The hub also cancels a run beyond
that timeout plus two minutes, collects its log and releases its machine. Both
paths report `run timeout <value>` once. Config load refuses a `lifetime` shorter
than `run_timeout` plus ten minutes, naming both values.

Every ten seconds the hub polls status and up to 256 KiB of log bytes by offset.
SSH failures leave the run unknown and are retried; an API 404, or five minutes
unreachable while the API reports active, fails it with `remote machine lost`.
Cancellation signals the remote process group, collects and destroys the machine.
A restarted hub reattaches to an active run, resumes at the local log's byte offset
and posts its result once. An expired lease reports `remote machine lifetime expired`.

After collection and confirmed release, the result adds a line such as
`Executor droplet · c-8 lon1 · cland-project-1a2b3c4d · linux x64 6.8.0 · Node v24.21.0 · Neovim v0.12.5 · lifetime 1398 s · cost $0.0971`.
The job and `suite-result` record retain the machine name, size, region, lifetime
and cost. A green same-head Linux result is merge-gate suite evidence for its tree
and mode;
a later local request may reuse it and still names `droplet`. It establishes the
selected suites on Linux, with macOS-only cases visible as `suite skip` records.
Those cases run in the release's final local suite ("Release v0.1.2 from the item").

A missing `DIGITALOCEAN_TOKEN`, refused create (including 4xx/5xx), unavailable
size in all configured regions, missing prepared snapshot, spent daily cap,
full remote budget with a free local slot, or
dirty candidate sends a requested droplet run to the local queue with
`executor: local`. Budget refusals before creation may retry remotely while
queued; other acquisition failures retain one create attempt per run. Its topic and recipients
receive `verify <id>: droplet unavailable (<cause>); running locally`, projected
with warn severity on messages and inbox warning surfaces. The journal records
`verification-executor-fallback` with id, item, requested, effective and cause.
The fallback applies when the executor flag is omitted and `local_fallback = true`
(the default). With `local_fallback = false`, default droplet requests use the
same remote-only policy as explicit `--executor droplet`: requests wait for remote
capacity and refuse submission when the daily spend cap cannot cover their lifetime
reservation, naming the cap. Other remote failures refuse submission or fail the run without
running locally. Acquisition
still reserves spend atomically; a cap reached after submission fails that run
instead of moving it to the local queue.

#### Leases, cleanup and spend

Every droplet carries `cland` and `cland-p-<hash>`, where the hash is twelve hex
digits derived from the project root path and name. Reap leaves droplets without
`cland` alone. Another project's young `cland` droplet is also left alone.

Before create, cland writes and fsyncs a lease in
`.cland/run/executor/leases/<lease>/lease.json` (mode 0600), mirrors it in `hub.db`
under `executor-leases`, generates its own ed25519 SSH key there, and arms a
detached watchdog on the hub host. The token stays in the inherited environment;
the watchdog command line holds only its entry file and the lease directory.
On macOS it runs `caffeinate -i -w <pid>` while live to inhibit idle sleep.
At the lifetime deadline it checks the droplet's name and tags, deletes the
droplet and key, retries until both are absent, and writes `watchdog.json`.
It survives a stopped or crashed hub. Restart consumes that receipt into the
`executor-watchdog-fired` journal event, recovers interrupted creates by name,
releases active leases with no run, and re-arms dead watchdogs for live leases.

Release confirms deletion by listing droplets and keys before marking a lease
released or removing its key files. An unconfirmed deletion stays `releasing`;
lease recovery retries it every minute and its watchdog remains armed. A lost
create or SSH key import response retains the lease while the resource may still
appear. Released
leases stay on disk for their accounting history. Cost uses the size's hourly
price, from create to the first accepted delete call, with a sixty-second minimum.

At hub start and every ten minutes, the hub runs lease reconciliation and the
orphan sweep. Each sweep journals `executor-sweep` with lease, reaped droplet,
reaped key and failure counts. Between sweeps, an unref'd timer retries lease
recovery every minute so a late provider-side deletion can be confirmed within
the six-minute recovery bound. Recovery and sweeps run serially; provider errors
are logged and retried on the next applicable pass. Reconciliation consumes new
watchdog receipts, re-arms a dead watchdog for a live lease's remaining lifetime
(`executor-watchdog-rearmed`), and retries every `releasing` lease. It skips
already-settled accounting history without ledger locks and settles interrupted
releases in one batch, preserving the recovery deadline for unfinished leases.

Sharded close results still publish when the spend ledger is unavailable after
the shards have reported. Group reservation release is retained under
`.cland/run/executor/shard-releases/` until the ledger confirms settlement;
reconciliation retries these requests across hub restarts, including reservations
for shards that failed before acquiring a lease. The log records
`executor-shard-reservations-deferred` and `executor-shard-reservations-released`.
Accounting retries do not rerun shards or publish a second parent receipt.

Before every create, including a prepare builder, cland reserves the configured
lifetime times the size's hourly price (at least sixty seconds) in
the [per-user executor spend ledger](#per-user-state), `$XDG_STATE_HOME/cland/spend.json`
(default `~/.local/state/cland/spend.json`).
An exclusive crash-recoverable lock serializes
reservation and settlement. The test override is `$CLAND_EXECUTOR_STATE/spend.json`.
Entries name the project, lease, run, size, reservation, actual cost and times;
they never contain the token. Confirmed release replaces the reservation with
the estimated actual cost; unconfirmed cleanup retains it across restarts and
UTC midnight. The cap checks today's spent plus all outstanding reservations
before creation. This is an estimate from hourly price and lifetime, not an
invoice; provider billing may differ (see costs above).
`cland executor status` prints the path and today's spent + reserved / cap.

#### Retiring legacy spend write-through

The human or Coordinator can run
`cland executor retire-legacy --confirm-registered-hubs [--json]`.
The flag confirms that the union of `projects` and every entry's `project` in
both ledgers covers all hubs this user runs. Before confirming, upgrade all
those hubs to code supporting the retirement marker and start them. Every registered project
must answer an authenticated live `executor.status` request within three seconds
and report both `spend.legacyRetirement: 1` and exactly the same primary spend path
as the requesting hub. Capability 1 means that all ledger transactions preserve
`legacyRetired` and stop legacy reads/writes once it is set. A state-directory
hub without this capability can otherwise undo retirement on its next write. Missing,
unreachable, malformed, non-capable or old-path hubs refuse retirement. Refusals list the
registered projects; stale discovery files and version strings are insufficient.
An empty registry, aliased ledger files and `CLAND_EXECUTOR_STATE` overrides also refuse.

Both ledger locks serialize the final reconciliation, checks, snapshot and
activation. `spend-retirement.json` beside the primary ledger records the checked
projects, time, paths and original legacy bytes. Only after durable snapshot
publication does the primary ledger activate `legacyRetired: true`. A failed
activation can leave an unactivated snapshot; retry the command. Activated
retirement is idempotent, survives hub restart, and stops legacy reads and writes
in upgraded code. The legacy file is never moved, deleted or changed by retirement.
Reservations, settlements and the shared daily cap continue in the primary ledger.

This check cannot discover a hub that never registered in either ledger. The
confirmation flag is the operator's assertion that no such hub remains. A later
downgrade can restore legacy behaviour or split accounting; do not restart older
binaries after retirement. This command does not run automatically during upgrade.


#### Epic demo leases

`cland demo start <epic> [--commit <sha>] [--json]` asks the hub for a demo droplet at a named commit on `dev` (the tip by default). It returns the lease id, full commit, deadline, lifetime and cost. Delivery uses the verification snapshot, installs changed dependencies and prepares the candidate's Neovim pin. The root checkout may keep moving or have tracker edits: only committed Git objects are delivered.

`cland demo exec <epic> -- <command…>` runs as the ordinary `runner` user in the delivered tree, with `hub/bin` on PATH. It returns stdout, stderr and the command's exit code; `cland --headless --qa qa/cases/<case>.lua` works there too. Each argument is preserved; use `sh -c '<script>'` for a shell pipeline. `cland demo status <epic> [--commit <tested-sha>] --json` reports lease state/accounting and, with a commit, its current freshness even after a local fallback. `cland demo stop <epic>` releases the lease and reports confirmed accounting.

Demo leases share `remote_budget` and the daily spend cap with verification and snapshot preparation. No slot or budget means a nonzero refusal naming the reason, without creating a droplet; QA runs locally at the same commit while the lane merge hold stays active. Callers are QA holding that epic, the Coordinator or the human. The hub owns provider calls, stores no DigitalOcean token, and uses the existing tagged lease, spend ledger, watchdog and reaper. Stop, the epic's QA verdict, or the earlier of `run_timeout` and `lifetime` ends the lease. Restart retains the lease; create, confirmed destroy and cost are comments on the epic.

Release confirms absence by droplet id, including when an accepted deletion leaves an archived response without tags. A genuine name or tag mismatch preserves the resource and spend reservation. Demo status and executor status then show operator attention with expected and observed identity fields and provider status; the epic records the refusal and the hub alerts the Coordinator once for that lease. The hub retries cleanup on reconciliation, clearing attention only after the identity is valid again or absence is confirmed.

An epic QA verdict names the tested dev commit. A later dev tip is acceptable when the commit is still on dev and every intervening commit avoids the epic's surfaces: files changed by its task merges, found through their `Item:` trailers. An intervening edit (even reverted), deletion or rename touching a surface makes the verdict stale; the refusal names the commit and files. The same rule governs verdict admission, cached freshness and epic close. Stage QA retains its existing exact dev build rule. The QA recorder copies remote captures locally before stopping and records the executor, commit, lifetime and cost; macOS-only cases run locally at the same commit.


### Tests

Verification runs the project's configured check and test commands; see
[Verification commands](#verification-commands). The following runner details
and package commands describe cland's own suite.

`npm run test:nvim-fixtures` refreshes the Neovim protocol recordings. Full
discovery selects runtime stub consumers through imports and launch URLs, rather
than test tiers, and excludes native clients that only share the command-validating
launcher (such as `artifact-browser.test.ts`) and type-only stub references. It
captures and validates all requested files before replacing fixtures, refusing
skipped or incomplete runs and captures below the existing frame counts. See the
[fixture maintenance guidance](../docs/agents/tests.md) for full, retained and
per-file slice refreshes.

Use `projectHub(t, root, env?)` from `hub/test/harness.ts` for project tests by
default. Each test serves its own project through `serveProject` in the test
process, with normal discovery, Unix socket and WebSocket edges. Real CLI
subprocesses, discovering spokes and fake harnesses keep their production
protocols. Pass environment overrides to the fixture; never temporarily mutate
`process.env` for one hub. Teardown stops the served hub, disposes the fixture's
owned processes, then fails on surviving owned handles, timers or process
listeners, with `process.getActiveResourcesInfo()` diagnostics.

Keep `startDaemon` only when an assertion concerns the hub process: startup,
shutdown, signals, crash/restart, lock/discovery/PID identity, orphan sweeping,
watchdog behavior, or CLI behavior with the hub down or unreachable. Session
stop, resume and native harness crashes alone do not require a spawned hub.
New tests using `startDaemon` must name the process lifecycle behavior they
prove. Do not share one project hub across unrelated tests. Validation duplicates
may call the existing dispatcher or tracker directly while retaining one real
frame proof per tool/refusal family; adapter parsing edges use a fake native
transport while launch/inject/turn/stop/resume retain frame coverage.

Package suites pass `--test-timeout` to every Node test phase. The default is
120 seconds per test; `[verification].test_timeout` in `.cland/config.toml`
sets a positive duration (`s`, `m`, `h` or `d`). A timed-out test fails by name.
An explicit test-level timeout still overrides Node's default.

The local verification worker also watches stdout and stderr during check
and tests. `[verification].stall_timeout` defaults to `"10m"`. After that much
silence it fails with `stalled: no output for <n> min` and the last eight started
tests, captured by the package reporter before they finish. It terminates the
verified command tree (including detached test runners and spokes), retaining
observed child identities if a parent exits before its output pipes close. It sweeps owned
suite roots, and releases compatibility leases before publishing the result.
If a detached writer escapes observation and keeps inherited pipes open, the
failed result says `cleanup incomplete: unverified inherited-pipe writer`,
including known parent/pipe evidence. The hub posts one warning in Agents and
the human's inbox and journals it. It preserves unverified processes and releases
admission so the next run can proceed.
Droplet runs retain their separate enforced `run_timeout` and machine lifetime.
They also enforce the admitted `stall_timeout` against new bytes in the mirrored
stdout/stderr log. Status replies and failed log reads do not renew the timer.
Observed output is checkpointed before mirror append, and replay after restart
keeps that original silence boundary. With a responsive transport, detection
takes at most the same stall limit plus the 10-second progress polling interval;
the next poll moves earlier for a silence deadline between polls. The result
retains in-flight file/test receipts and classifies as `timeout`. The hub cancels
the worker and releases its droplet, including each timed-out shard; confirmed
cleanup/accounting can finish later than detection. See
[`docs/agents/tests.md`](../docs/agents/tests.md) for fake-executor regression guidance.

`hub/test/prepared-project.ts` supplies `preparedProject(t)` (a repository after
file provisioning, with its territory and an intentionally empty tracker), `preparedProject(t, 'repository')` (main with
one Initial commit), and `preparedReleaseProject(t)` (also a private bare GitHub
stand-in). The `native-territory` shape provisions only the territory and ignores
`.cland/`, for the existing native-boundary tests. The merge tests use the `verification` shape, with a tiny package in
its initial commit. `copyPreparedProject(root)` fills an empty directory already
owned by `tempProject` when a helper accepts a root instead of a test context.
Each shape is built once per worker process under its temporary root; a cached
promise serializes concurrent callers. Seeds stay private and unchanged after
preparation. Copies have independent files, including objects, refs, index,
config, hooks, worktrees and `.cland` state, with remote paths relocated to the
copy. No objects are hardlinked or shared. Test teardown owns copies just as it
owns `tempProject`; worker teardown removes seeds and the runner's phase sweep
also covers them. Tests asserting repository/territory construction, init
reports or a custom initial history must still build their own fixtures.

The spawn census counts `child_process` calls inside the suite's Node processes,
with command totals and sources ranked by test file and helper. Run
`node hub/test/spawn-census.mjs run .tmp/census-before` from the repository root;
it preloads the recorder through `NODE_OPTIONS`, runs `npm test -- --all` under the
ordinary machine-wide suite locks, and writes `report.md`, `aggregate.json` and
`suite.log`. The report records the measured head and runner's `suite duration`
line; invocation wall time also includes queue wait. Compare two runs with
`node hub/test/spawn-census.mjs compare .tmp/census-before/aggregate.json .tmp/census-after/aggregate.json`.
The census cannot see non-Node descendants (including git hooks and
`git-receive-pack`) or subtrees that replace or strip `NODE_OPTIONS`; its report
names test files with those overrides and sandbox-exec launches that may deny log
writes. A denied log open leaves the child uninstrumented and preserves its behavior. Shell calls count as `sh -c`. Records
contain only the command basename, first argument, test file, helper and timestamp,
never environments or remaining arguments. Append-only records remain in the
printed temporary root for inspection; failed runs produce partial reports.

Automatic Node module compile-cache activation is disabled: warm loads fail on
the supported Node 24 engine range. The [qualification check and measurements](../docs/node-compile-cache.md)
record the reproduction, per-process-cache cost and upstream follow-up (T-220).
Re-run it when a new Node 24.x is released or Node 25 support is added, before
enabling a shared cache and validating that configuration with a full suite.

Implementers use `cland verify` for full runs and wait for its artifact-backed result;
see [the agent test workflow](../docs/agents/tests.md). The package commands below
are also available for humans and isolated CI.

`cland verify [all|hub|nvim] [--fresh] --report <topic|session> [--to <session>]…`
runs the project's check and test detached and posts one artifact-backed result.
It persists requests in the hub database before admission. Waiting requests have no
worker PID. The Coordinator's integrated dev runs go first, then human `npm test`
waiters in enqueue order, then item rank at submission, then other runs in enqueue
order. The queue survives hub restart. A known dead
requester's queued run is cancelled with one hub note to its original recipients;
a disconnected spoke alone does not prove death. `cland suite` is a transition alias.

Results include `Executor local · <os> <arch> · Node <version> · Neovim <pin>`
after the branch and head line. The worker records OS, architecture, OS release,
the Node on its PATH in the candidate worktree and the candidate's
`nvim/NVIM_VERSION` pin (`none` when absent). Cards name the executor, status and
journal records carry the executor/platform, and cache hits keep the original
run's executor and platform. Older jobs without an executor read as `local`.

Task runs may report `hub-selected`: changed hub tests, tests covering the changed
functions, and `HUB_SMOKE`/`NVIM_SMOKE`. A hub source imported by Neovim keeps the
full Neovim phase. The report names the deciding functions and coverage artifact.
Clean integrated `dev` full runs record per-test-file V8 coverage, including the
CLI, lifecycle daemons, spokes and fake harness descendants, and publish a
function-range map with their head and canonical candidate tree. Close-run shard
maps merge into one artifact. Task runs never refresh the map.

Admission reads the newest artifact whose head is an ancestor of the task's merge
base. `[verification].coverage_max_age` is a positive duration, default `"2d"`.
Missing, invalid, stale or unrelated maps keep the package rules and name the
reason. Protocol/contract, package, harness, fixture, runner and executor changes,
unsupported paths, unknown source/functions, untested functions, top-level edits,
missing covering tests and hunks changed since the map also keep those rules.
Unchanged lines are translated from the merge base back to the map across the
intervening diff. Integrated full runs remain the regression backstop; a selected
run can miss a regression which the next batch detects.

Coverage artifacts remain the source of truth; `.cland/run/coverage-maps/` holds
rebuildable pointers shared by linked task worktrees. Cache reuse for
`hub-selected` also requires the same selected tests and Neovim phase.
`node hub/test/selection-replay.ts <first-parent-range> --coverage` prints the last
40 task landings, missing-map fallbacks, deciding functions and each selected share
of hub test-time. `--nearest` explicitly labels retrospective maps that may postdate
the merge; live admission always requires an ancestor and enforces age. Supply
`--failures <json>` to include historical failed test paths keyed by full/short
merge SHA. The replay also reads retained suite logs by item and names their count; old logs
without source identities remain unavailable rather than guessed.
`--count N` changes the replay window (default 40); an incomplete window exits 2.
Exit 1 reports own or historical misses for inspection; the agreed own-test bar
and historical miss causes are reported separately.
Shares use the current duration manifest, rather than claiming historical wall
times. The replay bar is zero misses on those merges' own changed/added tests;
every wider miss must be listed with its cause.

**Close-run sharding.** Only integrated `dev` requests with `--occasion
stage|epic|release` shard remotely; ordinary batch runs stay on one slot. The
Coordinator sets the occasion; QA may use `epic` for its demo. File balancing,
Neovim placement, the daily-cap whole-run fallback and per-run costs are described
under [Remote executors: Close runs](#close-runs). The result and queue show the
occasion and the remote shard machines.

**Executors.** `hub/src/executor/executor.ts` defines acquire, deliver, prepare,
start, status, log, cancel, release and reap. The backend owns its durable lease's
resource payload; detached starts outlive the hub and status reattaches after
restart. `local` is the default; `droplet` runs on a prepared DigitalOcean snapshot. The local backend
owns the existing suite worker, compatibility slot and process cleanup; the hub
shares the queue, cache, timings, verify card and report across executors.

`[verification].budget` defaults to 1. Higher values are retained in config but
capped at 1 with a `verification-budget-capped` log note. T-215 retains this
conservative budget: only five hermetic hub files qualify for overlap, too little
to justify overlapping process-heavy local runs. `[verification].remote_budget`
is a positive integer, defaulting to 4, beside the local slot of one. The scheduler
walks the same ordered queue, admitting droplet runs into free remote slots without
checking the host's compatibility leases. A blocked local waiter does not hold up
remote waiters behind it. When all remote slots are reserved and the local slot is
free, a default droplet request with `local_fallback = true` runs locally with one warn notice
`verify <id>: remote budget <n>/<n> full; running locally` and a
`verification-executor-fallback` journal record with cause `remote budget full`.
A default request that already fell back because the remote budget was full,
but is still waiting for local admission, reclaims a free remote slot in the same
queue order, including after a hub restart. The hub reports
`verify <id>: remote capacity available; moving queued local fallback to droplet`
to its topic and recipients and journals `verification-executor-reclaimed`.
Only budget fallbacks are reconsidered; other acquisition failures stay local.
`--executor local` always uses the local slot. Launching/acquiring jobs reserve
remote slots through confirmed release; acquires proceed in parallel and each
checks the shared daily spend cap. The provider also counts durable preparation
and unconfirmed cleanup leases before permitting a create. `verification-admitted` records `remoteActive`
and `remoteBudget` for each remote admission.

The compatibility broker keeps both legacy locks as a fence, and a hand
`npm test` or pre-V1 holder occupies admission. The worker takes a verified lease
before typecheck; V1 package runners borrow it through all phases and publish
recovery metadata in a unique `<lock>.runs/<token>.json` record as well as the
legacy ownership sidecars. Records track the planned root, inode/device and
runner PID/start identity and are removed only after cleanup. Pre-V1 package runners take their own lease after protected
typecheck. A racing hand run remains excluded by atomic lease acquisition.
Admission identity probes are asynchronous and bounded. Stale process/root recovery
runs in a bounded subprocess; failure retains ownership and logs
`verification-admission-blocked` for retry.
`verification.lock_path` defaults to `/tmp/cland-suite.lock`; isolated fixtures
may select another absolute path (the Neovim lock then uses its `-nvim` suffix).
Keep the default on a shared machine. Exact submitted heads remain in results.
Integrated dev runs survive tracker-only and rulebook-only commits before admission
or during execution when the canonical candidate tree stays unchanged; their result
covers the new head. Task runs still require the submitted head. Merge gate
semantics stay unchanged. Logs and ordinary results use T-203's artifact checkpoint
and message id to prevent replay.

Green results are cached by the Git tree of the submitted head **excluding
`.cland/tasks` and `.cland/RULES.md`**, plus the selected effective mode (`full`, `hub-only`, `hub-selected`, or
`nvim-only`). A private Git index constructs this canonical tree without changing
the worktree's staged contents. Tracker-only or rulebook-only dev commits and rebases that reproduce this tree
reuse the original run; every other committed path, including `.cland/config.toml`,
still participates. Dirty tracked/staged files or nonignored untracked files outside
the tracker and rulebook bypass caching and cannot seed it. Clean cache candidates are checked
again before and after execution; changes to suite inputs still fail verification.

`--fresh` bypasses reuse. `[verification].cache_max_age_minutes` defaults to 1440
(one day); 0 disables caching. Age starts at the original successful completion,
not at subsequent hits. A release occasion reuses only a full receipt with matching
commands and tier/occasion coverage on the effective executor and OS: Linux on a
droplet, or the current host OS locally. This applies to configured defaults too;
a macOS stage or release receipt cannot satisfy a droplet release request. Missing
platform evidence is a cache miss. A compatible full stage receipt on Linux
droplets can satisfy a droplet release request. An explicit `--executor droplet` reuses only a green that
ran on a droplet. If only a local green qualifies, it starts a fresh remote run
and names that cache bypass in the result header and log. With no executor flag,
ordinary reuse stays cross-executor, including when the configured default is droplet;
`--executor local` also keeps cross-executor reuse. Hits retain the original
executor and platform. Only successful completed, reported runs with an available
log artifact qualify; old pre-cache jobs, failures and cancelled runs do not. A
new failed or pending fresh attempt supersedes older green evidence for its key
(restricted to droplet attempts for an explicit droplet request).
Cancelled attempts (by the requester, requester death, or a head change before
admission) do not supersede older green evidence. Test failures, worker crashes
and timeouts still do.
The cache survives restart and may reuse evidence from another worktree in this
project. Requests from a repository subdirectory bypass caching, since their npm
scripts can differ from those at the worktree root. A hit creates its own durable request and posts once to the usual topic
and recipients, with the requested head, `cached`, original run/head and identical
canonical tree hash. Its log artifact carries the original log and provenance.
Cache notices and logs name the original occasion and executor separately from
the requested occasion; older cached records without an occasion say `unknown`.

The merge gate and T-209 criterion freshness remain exact-head: a cache hit alone
never refreshes a stale mark. The Reviewer must verify the new head using the posted
cached result as evidence; no tree equivalence is applied to review or QA marks.

A human's `npm test` outside a cland session asks this same scheduler for a
connection-owned slot before taking the compatibility lease. The runner prints
its queue position, holder elapsed time and ETA as they change, and at least once
a minute. Integrated Coordinator dev runs come first, then human waiters in
enqueue order, then ranked item runs, then other runs in enqueue order. Human
waiters have `kind: "hand run"`
and `session: "human"`. Admission reserves ten seconds to acquire the lease;
closing the connection removes the waiter, and an unused reservation expires.
The journal records `verification-human-queued`, `verification-human-admitted`
and `verification-human-left`, including waiting time. A linked worktree finds
the main project's hub through the usual discovery path. With no answering hub
within a few seconds, the runner prints that no hub queue is in use and takes
the compatibility lease as before.

`npm test -- --force` removes the flag from the test arguments and runs unlocked
beside the holder. Before starting, it sends `suite.forced`; the hub journals
`verification-forced` with worktree, head, selected mode and the holder it ran
beside. With no answering hub, it prints that it runs unlocked. Unique phase
roots and process cleanup still apply. Use this only for an intentional bypass.
Session-shell `npm test` retains the compatibility-lease path; it is not the
human queue path. Inherited hub worker leases are borrowed directly. Crew full
runs go through `cland verify`.

The human runner frames sit beside `suite.start`:

| Frame | Result and lifetime |
| --- | --- |
| `{"type":"suite.slot","id":…, "mode":"full"|"hub-only"|"nvim-only", "cwd":…, "head":…, "pid":…, "token":…}` | `{id, admitted, locks, queue}`. First call registers a human waiter; repeated calls on the same socket poll it. Keep the connection open through the run. An expired reservation returns an error. `token` matches the runner's compatibility owner. |
| `{"type":"suite.forced","id":…, "mode":…, "cwd":…, "head":…, "pid":…, "token":…}` | `{}` after journalling the bypass; no slot or lease is taken. |

`cland verify queue [--json]` prints `local: <holder or none>` (including
compatibility **hand run** holders, labelled `human` for an admitted human slot),
one `remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> ·
since <t> · ETA <d>` line per remote run, then the ordered waiters with their
requested executor, elapsed wait and admission ETA. A machine is labelled
`acquiring` until its lease is available. JSON keeps `holder` as the local holder
and adds `remote`, `remoteBudget` and `waiters[].executor`. Integrated dev comes
first, then human `npm test` waiters in enqueue order, then ranked items, then
other runs in enqueue order. Its human-facing form is the sessions panel's
one-line `verify:` summary (holder, run time, waiting count and next ETA). Enter on the summary
or the palette's **Open verification queue** opens the centre queue view with
ordered waiters, elapsed waits, admission ETAs and timing metrics; `q` returns.
Both follow the same queue live from `verification.queue` events;
`hub status --json` includes it as `verification`, with the scheduler's
latest compatibility-holder observation (refreshed each second). An explicit CLI
queue read refreshes ownership immediately. Status metadata and recorded timing
metrics never wait for OS probes. JSON `version: 1` uses
milliseconds, explicit nulls for unknown estimates, and ordered `waiters` with
one-based positions. `holder.etaMs` estimates remaining execution;
`waiters[].etaMs` estimates time until each admission. Estimates use recent
successful executions of the same mode and executor; remote duration includes
acquire time. Remote holders do not add delay to local waiter estimates. A cache hit completes
without entering this queue even when a hand run occupies the compatibility slot.

Each run's status includes `admittedAt`, `completedAt`, `waitMs` and `runMs`.
Admission starts executor acquisition; `runMs` spans admission through the durable
worker `finished` receipt, including typecheck and all package phases. Recovery
uses that receipt even without live worker status, excluding hub downtime.
For close runs, each `shard duration` names admission through remote finish, and
`shard collection` separately names remote finish through final collection and
machine release (or the bounded accounting wait). Missing timestamps report
`unavailable`; the merged overall wall still spans admission through collection.
A cancellation before admission records its elapsed wait and zero run time.
Cache hits record zero wait and run time; their separate `completedAt` never changes
the original `finished` used for cache expiry. The journal records `verification-timing`
once per measured request. Existing T-232 receipt/start records seed estimates at
second resolution and are labelled `timingEstimated` in status (`estimated` in the
journal); unavailable timestamps remain null.

`cland verify queue` also shows queue wait p50 and p90 for the last 24 hours
and the last 50 completed requests **per effective executor** (`local` and
`droplet`). Both its JSON and `hub status --json` expose the same values at
`verification.metrics.queueWait` (the queue command omits the `verification`
wrapper). `targetP90Ms` is the configured target in milliseconds;
`last24Hours` and `last50Runs` each contain `local` and `droplet` values with
`count`, `cacheHits`, `p50Ms` and `p90Ms`. Empty samples have null percentiles.
P50 is the median (the average of the middle pair for an even sample); p90 is
nearest-rank. The last-50 window includes cache requests in its limit, but
cache hits are counted separately and excluded from both percentiles because
they never enter the queue. Requests cancelled before admission, unknown or
invalid timings, and internal shard jobs do not contribute wait samples.

Wait is durable `queued` to `admittedAt`, including failed executed runs. A
fallback is counted under the executor that actually ran it. Windows use the
durable `finished` time when available, otherwise `completedAt`, so restoring
a receipt after a restart does not move the run into a newer window or add
recovery delay to its wait. This metric does not use `runMs` or the recovery
clock to infer admission.

`[verification] wait_p90_target = "20m"` sets the target (a positive integer
followed by `s`, `m`, `h` or `d`); it is informational and does not change
admission. Metrics use the loaded config snapshot: `cland hub reload` publishes
a changed target; an invalid reload retains the last good value. The hub records
the same target and window values in a
`verification-wait` journal entry on the first scheduler tick of each UTC
hour. The last recorded hour survives restart, preventing duplicate records;
after downtime only the current window is recorded, without inventing past
hourly samples.

Integrated dev runs completed from the cover-record rollout onwards persist
`cover: {status, cause, tests}` in their hub run record, expose it as
`hub status --history --json`'s `suites[].cover`, and include it in the journal's
`suite-result` event. Task runs and child shards have no `cover`; a sharded
integrated run records one cover from its merged outcome and log. Historical
already-reported runs are not backfilled or scanned at startup.

`status` is `green`, `red` or `cancelled`. `cause` is always present: `null`
for green, `test-failure` for failed tests (also the fallback for an otherwise
unclassified failed outcome), `budget` for duration-budget diagnostics without
test failures, `timeout` for test/run timeouts or the silent-output watchdog,
`cancel-head` for a changed submitted head/candidate, or `cancel-requester` for
explicit cancellation or a queued requester's death. A run with both test and
budget failures is `test-failure`. `tests` holds deduplicated repository-relative
`file::test` identities from failure receipts and duration-budget diagnostics;
a file-wide budget uses the file path. It is `[]` for green or when no test
identity is available. Cancellation and timeout retain any observed failures.

`cland verify classify <run> load-flake --note <text> [--json]` lets only the
Coordinator or the human shell reclassify a finished red integrated cover.
The nonblank note is required. The command changes `cover.cause` to
`load-flake`, preserves the original derived cause as `cover.derivedCause`, and
adds `cover.classification: {note, by, at}` (`by` is the session name or
`human`; `at` is an ISO timestamp). Repeating classification retains the first
derived cause and replaces the annotation. Tests and the original process
outcome remain intact. The update persists across restart and is journalled as
`verification-cover-classified` with `id`, `head` and the updated `cover`.

`hub status --history --json` also returns `covers`, at most ten recorded covers, newest
completion first: `[{id, head, branch, completedAt, cover}]`. `completedAt` is
an ISO timestamp (or `null` when unavailable). `cland hub status --history` lists their
run ids, status, cause and head; green's null cause displays as `none`, and a
classification also shows its derived cause and note.

`metrics` reports median and nearest-rank p90 wait/run durations over the last 20
completed requests, including hits and failures, with counts of available values.
ETAs use successful executed runs in that window matching the effective mode,
subtract the holder's elapsed run time, then accumulate preceding waiters' durations.
Hand runs use the window's successful execution median across modes. Missing history
or an ownerless manual lock yields an unknown ETA. These are estimates, not reservations.

`cland verify cancel [<suite id>]` requests cancellation through the hub and exits.
Without an id it selects the caller's latest active run. A session can cancel only
runs submitted by its own stable session identity; the human can cancel any run
by id. Reporting topic and recipients stay those of the original submission.
Cancellation reconciles only the selected run; unrelated submissions and cleanup
do not hold up its cancellation. A queued request has no worker or FIFO ticket;
cancellation removes it from admission immediately.
The hub persists cancellation before sending SIGTERM to the identity-verified
worker, when one exists. The worker forwards it to npm and the lock runner: a legacy queued runner removes
its FIFO ticket without disturbing the holder, and a running runner cleans its
children, temporary root and leases. Cleanup finishes before one `cancelled`
result (exit 143) is posted with its log. Restart and reporting retries retain
cancellation even when the worker receipt says interrupted; repeating an explicit
cancel is harmless. A finished run cannot be newly cancelled. If cleanup or
reporting cannot proceed, `cland hub status --json` shows the retained error and
the hub retries without duplicating the result.

`npm test` and `cland verify --report <topic>` default to diff selection. They fetch
`origin/dev`, compare the branch from its merge base with fetched dev, and include
staged, unstaged and untracked files. Renames include both old and new paths.
The pure `chooseSuiteMode` in `src/suite-selection.ts` uses ordered package rules.
A diff wholly under `web/` selects `web-only` (Web plus hub/Neovim smoke).
A diff wholly under `nvim/` selects `nvim-only`; a mix of Neovim and any other
paths runs full. Everything else selects `hub-only`, including hub code, docs,
skills, `.agents/` and `.cland/tasks/`.
Before those package rules, shared paths force full: the crew/role(s) CLI, adapter
contract, protocol, web edge/auth/CLI, Neovim hub transport/event state, package/lockfile/tsconfig
files, suite runner, selection and shards modules. A shard-manifest change alone
uses the package rules; the shard lint guards hub file assignments. Any hub
file imported by `nvim/test/**/*.test.ts` or their helpers also forces full.
Admission follows relative imports within `nvim/test/` from those test entries,
collecting hub imports without following hub-internal dependencies. It reads
static, type, side-effect, re-export and literal dynamic imports (quoted or
backtick) from source; interpolated dynamic imports fail closed to full. New shared
imports widen selection automatically; pure callers may
supply the list and otherwise use the current baseline. Dot or parent segments
are ambiguous and force full. Reasons name the deciding rule and shared file.
An empty diff or a failed fetch/diff runs full with its reason. Integrated `dev`
always runs full. `cland verify all` / `cland verify --all` and `npm test -- --all`
force full. The runner CLI's `--all` overrides explicit test targets as well as the
selected mode. Explicit `hub` / `nvim` requests reduce only a qualifying matching
diff; otherwise they widen to full. The duration line and durable suite report name the
mode, reason and deciding files. Hub jobs persist one selection for the worker
and report, including across restart.
Reports show a byte-bounded file summary with an omitted count when necessary;
the durable log retains every deciding path. Compact reports preserve the mode,
result and log-artifact pointer before other details when the configured cap is small.

With `tiers.json` and `[merge] queue = true` in both the candidate and hosting
hub, task verification plans T0 (check), all T1, coverage-selected hub T2 and
diff-selected Neovim T2. Coverage fallbacks run all T2 across both packages,
clearing inherited Neovim subsets. Task plans exclude T3/T4, including process
smoke; results name whether T3 is in the merge batch or deferred to periodic dev
and integrated occasions, with the queue state. Explicit `all`
retains T3. A flaky-gate second task receipt uses the same mode-free selection.
Projects with the queue disabled or absent, and legacy candidates without
`tiers.json`, retain their previous plan.

Code changes enqueue through `cland merge T-<n>` after same-head task verification
and final review/QA verdicts. `queued <n>` is a FIFO position, not a landing.
`cland merge queue [--json]` lists pinned heads and the active batch;
`cland merge T-<n> --cancel` withdraws an entry under the merge role/subtree gate.
Changes wholly in the documentation/tracker allowlist still land immediately;
skills and role configuration go through the queue.

The hub takes `[merge] batch` entries (default 3) when full or after `batch_wait`
(default `"10m"`). It checks the immutable merged candidate on one slot using
`[merge] batch_tiers`, a nonempty set of T1–T4 tiers. Its default is
`["T1", "T3"]`; this repository sets `["T1"]` (D67). When T3 is selected,
identities absent from the last green batch or stage receipt get five
repetitions. A green T1-only batch supplies no T3 receipt.
Green candidates land in FIFO order. Red batches rerun
failing files on leave-one-out trees: `merge-bisected` rejects a unique culprit
(or a red singleton). Without a unique green removal, one original-tree repeat
can supply green proof; otherwise `merge-bisect-unresolved` rejects every member
and notifies the Coordinator. Inconclusive runs hold the batch for its decision.
`merge-conflict` and `merge-budget` go to the item lead for a fix and renewed
review/verification. See the [merge skill](../.agents/skills/merge/SKILL.md) for
refusal ownership and recovery.

`[verification] dev_t3_every = "2h"` enables this repository's hub-owned
`dev-t3` occasion; `""` (the default) disables it. It selects T2 and T3 on one
droplet without load repetitions, under the shared remote budget and daily
spend cap. The first attempt is due one interval after activation; later runs
are due after the interval since the last attempt/start, only when dev's
verification candidate tree differs from the last started run's tree. The shared
exclusions in `hub/src/verification-tree.ts` make tracker-only commits ineligible.
The cursor survives restart, and a queued, running or unreported
periodic run prevents another. The hub requires clean root dev at freshly
fetched origin/dev. Periodic runs never hold or rebuild a merge batch.

Release occasions run T1–T4, including T3. `cland release`, including
`--dry-run`, refuses with `release-t3` unless a completed, reported green
dev-t3, soak, stage or release occasion covers the pinned release head's
verification tree (excluding `.cland/tasks` and `.cland/RULES.md`). A different
commit with the same build tree qualifies; T1-only batches, partial selections,
cancelled or incomplete runs do not. The refusal names the needed
`cland verify all --occasion release --report general` run.

`[verification] soak = "03:00"` schedules this repository's nightly UTC T1–T4
run on one droplet; the new-project default `""` disables it. The hub attempts
once per day, including late startup, on clean dev at fetched origin/dev and
skips an unchanged tree. It repeats identities absent from the last green soak,
reserves daily spend before creation and reports a cap skip. Results and
quarantine proposals go to the Coordinator in General; a red soak leaves the
merge queue running. Proposals require the normal evidence before the
Coordinator edits quarantine. See [Tiers and the merge queue](../docs/agents/tests.md#tiers-and-the-merge-queue)
for isolation, budgets, run plans and bisection evidence.

Reduced integrated/package runs retain a cross-package smoke baseline. Task plans filter out these T3 files. Both lists are named constants
in `src/suite-selection.ts`:

- `NVIM_SMOKE`: `nvim/test/scenarios/workbench.test.ts` and
  `nvim/test/startup-budget.test.ts`. A hub-only run executes the whole hub phase
  followed by real-hub Neovim attach/main views and the generated thousand-item
  startup budget (3 seconds from welcome to rendered explorer/header/sessions;
  first task response at most 128 KiB). Both are T3 and stay deferred in queued
  task plans. Full runs and web-only diffs retain them too. See the
  [measurement contract and scratch-only macOS probe](../docs/agents/tests.md#neovim-workbench-startup-budget-t-1010).
- `HUB_SMOKE`: `hub/test/scenarios/message-tracer.test.ts`,
  `hub/test/scenarios/hub-lifecycle.test.ts`, `hub/test/scenarios/startup-smoke.test.ts`.
  A Neovim-only run executes these spoke/daemon
  tests followed by the whole Neovim phase. The startup smoke starts the candidate
  tree's real detached daemon with `cland hub start` in a fresh project and requires
  `hub status --json` to answer over the Unix socket within one ten-second startup
  budget. It then serves a tracker request and stops the hub, observing PID and
  discovery/socket teardown. It runs in full, hub-only and coverage-selected hub
  phases too. The separate `hub/test/startup-smoke.test.ts` regressions plant
  pre-discovery and listening-but-silent daemon hangs to prove
  bounded failure naming the last structured startup log event. A test-only spawn
  observer owns the detached daemon independently of discovery, and cleanup proves
  its PID is gone while the fixture still exists. The hang cases' duration allowances
  pay for their real ten-second deadlines.

These smoke baselines apply to integrated and legacy package plans; queue-enabled
task plans filter them out after selection.

`hub/test/tiers.json` declares every hub and Neovim test file in a `version: 1`,
path-sorted `tests` map. Add each new file at its sorted path in the same commit.
The tiers are T1 unit (hermetic), T2 component (in-process hub with socket edges),
T3 integration (real process scenarios/contracts) and T4 soak (load/long/platform
checks); see [Test levels](../docs/agents/tests.md#test-levels-d53). Values are
`"T1"`, `"T2"`, `"T3"`, `"T4"`, or a T3 object with exactly one nonempty label:
`{ "tier": "T3", "contract": "codex" }` or
`{ "tier": "T3", "scenario": "release" }`. Fixture/tool writers use
`serializeTierManifest` from `src/suite-shards.ts` to keep the map sorted.

`npm run test:tiers` checks the manifest (`test:shards` is an alias for one release).
Package runs perform the same lint. Unclassified files, absent files, invalid
entries and an unsorted map fail, with the first out-of-order path named. T1
retains the hermetic check: process/port/timer APIs, process-fixture helpers,
wall-clock waits, legacy lock paths or Neovim in its source fail. Verify admission
refuses with `verify-tiers` before queueing; merge admission checks the immutable
merged candidate and refuses with `merge-tiers` before changing refs. The old
`verify-shards`/`merge-shards` wire codes remain accepted aliases.

T0 runs static checks. T1 maps to `hub free`, T2–T4 to `hub machine`, and Neovim keeps its package phase. Hub-owned batches plan T1/T3 on one slot. Ordinary `all` and integrated `dev` runs plan T1–T3. Stage, epic and release occasions plan T1–T4 on both executors and set `CLAND_TEST_SOAK=1` for tests and load-gate repetitions. Close-run balancing places T4 files like the others, and the merged result retains each shard’s tier lines. A pre-migration tree carrying only `hub/test/shards.json`
remains admissible: `free` maps to T1 and `machine` to T3, without requiring
Neovim entries or sorted keys. If both manifests exist, `tiers.json` takes priority.

The hub free shard runs on one worker. `[verification] workers` sets the hub
machine shard and Neovim concurrency (default 4). `[verification.droplet] workers`
overrides it on droplets and otherwise inherits it; this repository sets it to 2
(D53, measured on c-8; T-655, A-4106 and A-4156). Both accept positive integers;
`cland update` preserves them. Hand runs use the local setting even when the
project's default verification executor is a droplet.

`cland verify --workers N` overrides the count for one run. `--size c-16` overrides
the droplet size for one run and requires the droplet executor. The hub validates
that the provider offers the size in a configured region, then reserves its actual
hourly price against the daily spend cap before creating it. Overrides survive
queueing/restart and appear in the result header. Cache reuse requires matching
worker counts and size overrides; use `--fresh` for every timed measurement.
A droplet fallback uses the local configured workers unless `--workers` was given.

D53 sets droplet workers to 2 from the c-8 measurements. Earlier Mac runs at
four workers approached load 14–15, where readiness failures began; higher counts
need measured evidence after the inspection diet and in-process hub changes.
Compare c-16 at 4/6/8, then the quiet Mac at 4/5/6. Keep four locally unless a
failure-free leader improves wall time by at least 10%; repeat close contenders.
The [measurement procedure](../docs/research/T-396-worker-measurements.md) records
the table, decision rule and required accounting receipts. The Coordinator posts
the actual trade-off at stage-2 close before changing defaults.

Smoke targets use the same classification. Only machine phases
acquire `<lock>.machine`; the legacy lock pair stays held as the compatibility
fence for the complete invocation, including typecheck. Production invocations
remain serialized by budget one and this fence. This preserves hand-run and
pre-V1 exclusion; it does not enable production free-shard overlap yet.
Logs and suite reports include each shard's wall time, resource, workers and
machine wait, plus the hub queue wait and total suite/compatibility wait.

`hub/test/quarantine.json` lists exact top-level `file::test` identities (including
their subtests) with `owner` (`T-n`), a non-TODO `reason`, and UTC `added` and
`expires` dates. Expiry is exclusive at midnight, after addition and no more than
seven days later. Verify/merge admission and package runners refuse expired or
invalid entries by name. Only the Coordinator adds entries after two known-flake
failure receipts from different runs and 5/5 isolated green repetitions, recorded
in the owner ticket. See [the manifest example and evidence rule](../docs/agents/tests.md).

Quarantined tests still execute in task, integrated, close and release runs,
including new-test load repetitions. A complete, accounted test failure is
reported in the result's **Quarantine** section with passes and skips, without
failing the run or generating a shared-defect candidate. Raw Node counts and
diagnostics remain in the log. Crashes, cancellation, other failures, incomplete
receipts and duration budgets still fail. The hub records one outcome per real
run, uses the worst duplicate smoke outcome, and reports **cleared** after twenty
consecutive passes. Skips/failures reset the streak; cache hits, report retries
and absent tests add no pass. Streaks persist across restart and update atomically
with publication. Renewing an entry resets its streak. The Coordinator removes
cleared entries from the committed manifest; the hub never rewrites it.

`hub/test/durations.json` records each hub and Neovim test's median time and each
file's summed top-level test-time, and declares tier budgets in `budget.T1`
through `budget.T4`. `budget.mode` selects `report` or `enforce`; omission keeps
report mode for older manifests. This repository uses report mode until after
v0.1.4 (D73); enforcement returns under E-880.

In report mode, tier and T3 ratchet diagnostics cannot change an exit status.
Logs retain the complete `budget (report only): would fail …` list, and results
show the ten largest overages ranked by seconds over budget. The existing
new-identity gate remains active: a new test exceeding 5 seconds or a new file
exceeding 60 seconds fails the run. In enforce mode, every observed test and
file must fit its tier's budget or an exact allowance covering the measured
seconds. A known baseline does not exempt it; the runner fails with
`duration budget` independently of assertion quarantine. T4 stays unbounded.
See [duration budgets](../docs/agents/tests.md) for allowances and the T3 ratchet.

Tests are known by their exact
`file::test` key in `tests` or `allow`; files are known by their path in `files`
or `allow`. A known file never exempts a new test inside it; a renamed test is new.
Nested test times are already included in their parent. Add a justified exception in your task branch's `allow`
map: a test key is `path/to/file.test.ts::test name` with `seconds` and `reason`;
a file key is its path with `file: true`, `seconds` and `reason`. A file exception
does not exempt its tests. Admission (including verify and merge) refuses empty
or `TODO` reasons through the shard-manifest lint. Missing duration manifests
disable this check and the timing reporter, preserving fixture/older runner behavior.
Working-tree and immutable-candidate lint also refuse exact test/allow keys
with no matching source identity, and file keys naming missing test files.
Renames and moves must remove stale keys in the same change; a stage cover adds
the new baseline. Computed titles remain uncertain; literal and template titles
are matched within their own file.
This refusal happens during shard planning before a test receipt exists, so a
merge batch holds as inconclusive rather than bisecting a failing test. The
Coordinator diagnoses the named manifest key and recovers the batch after cleanup.

At each stage close the Coordinator refreshes on `dev` from the latest green
integrated full-run log artifact:

```sh
npm run test:durations -- --add-only /absolute/path/to/A-123-green-integrated.log
# Multiple logs take the median per test; pass the newest log last.
node hub/test/durations.ts refresh --add-only <older-green-log> <latest-green-log>
```

Until T-931 decides allowance-refresh policy, use `--add-only`: it prints and
adds missing test/file baselines, preserving all existing entry bytes, number
formatting and allowances. It creates no TODO allowances; review new
over-budget identities separately. It retains source artifact ids and updates
the source head. `refresh --help` describes the option.

Full refresh (without `--add-only`) preserves reasons, updates timing fields and removes tests absent from
the newest log. Only over-budget identities absent from both their previous
baseline and `allow` get a new `TODO` exception; known slow entries only update
their baseline seconds. Resolve every `TODO` before
committing. The `source` records the artifact ids and latest head. The runner's
file reporter emits one record per top-level test; `suite timing` lines retain
those records in the durable log after phase cleanup. Older spec logs use their
top-level result lines and start identities, falling back to source titles when
start identities are absent; ambiguous source matches refuse refresh.

In report mode's new-identity gate, known tests and files never fail the duration
budget. Over-budget entries always
report a `duration regression` annotated `over budget`, even when flat or faster.
Under-budget entries report at least 1 second and 50% slower than the recorded
baseline (threshold equality counts). Both kinds share the report's five-line
cap, ranked by seconds over baseline.
`suite budget overhead <ms> ms` measures manifest loading, the timing
reporter's bookkeeping/serialization, record reading, checks and reporting using
`performance.now()`. It excludes executing tests and waiting for their events;
serial absent/present whole-file comparisons also check the added reporter cost.

Task-branch verification also applies a **load gate** to each top-level test
whose exact `file::test` identity is absent from the manifest's `tests` baseline.
The phase reporter discovers names while the ordinary phase is running.
`[verification] load_gate_workers` parallel lanes (default 2) repeat each new name
five times in fresh Node processes, using an escaped, anchored `--test-name-pattern` on its file alongside the phase's normal
work. Each identity stays on one lane with sequential repetitions; no repetitions
are dropped to meet a deadline. The log and run report include the lane count.
Increasing it trades wall time for load independently of ordinary phase workers.
A reasoned duration allowance does not make a test known to the load gate;
the Coordinator's stage-close manifest refresh does for task runs. Occasion runs instead use the runtime identities from the latest completed, reported green integrated stage receipt, pinned at admission and carried to every shard. Names absent from that receipt repeat five times even if the current duration manifest knows them. Ordinary batches, failed stages and cache hits do not move this baseline; without a stage receipt every identity is new.

Every repetition needs a green process exit and exactly one passing receipt for
the named test. Skips, TODOs and missed names do not count. The log names each
test with `load gate: <file>::<test> <passes>/5 passed`; anything below 5/5 fails
the run and appears in its failure summary. The `suite duration` line reports
`load gate extra wall <seconds>s`, the time spent finishing repetitions after
the ordinary phase exits, summed across phases. This measures the tail added by
the gate, rather than the unmeasurable contention cost during overlap. Known
tests and integrated `dev` runs (including sharded close runs) get no repetitions.
The running hub computes the task flag carried in the suite selection; both the
hub and candidate runner must support it. A pre-upgrade hub supplies no flag and
does not request the gate. Exercise the gate through package-runner fixtures
during bootstrap, then prove the live task path after the hub is updated.
Without a duration manifest the gate is disabled, like the duration budget.
Repetitions share the phase's owned temporary root and cleanup, and their
receipts do not enter duration baselines or coverage maps.

All package runs queue once for joint admission to `/tmp/cland-suite.lock` and
`/tmp/cland-suite-nvim.lock`, and retain both locks through the chosen phases,
including smoke. Each phase cleans up its processes and temporary root before
the next starts. Explicit test targets passed to `runPackageSuite` retain the
single-phase targeted/fixture interface; a hub target run needs only the machine
lock. Compatibility admission serializes runs across projects and worktrees;
the separate machine lease is held only during machine shards. Joint waiters hold neither lock until both are free under their recovery
guards, so live legacy Neovim-first waiters can drain without an opposite-order cycle.
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

### Trying setup on a scratch machine

Shared hub test launches use `test/fixture-environment.ts`, through
`accountFixtureEnvironment(extra)` in the worker harness. They own scratch HOME,
XDG/account paths and Git configuration, discard inherited Git overrides and
identities, and filter provider/account credentials after the final overlay.
The default Git author and committer are `Fixture Test <fixture@example.test>`;
explicit synthetic identities in extras override those defaults.
They also remove ambient SSH-agent/askpass and package-manager credential config
handles. Account product tests use a separate `scratchAccountPaths` dependency
for deliberate HOME/database inputs, validated inside the disposable project.
Pass explicit scratch profiles and fixture identities as extras; do not add an
overlay after the builder returns. The manual `test/inbox-load.ts` probe uses
the same builder. Its root, including HOME, is removed after the served hub stops.
Fake-provider contracts opt in separately through the typed `syntheticProvider`
fixture dependency or `clandWithProvider`: only `cland-test-…` sentinel tokens
with an explicit HTTP loopback endpoint and port or the injected fake API qualify.
Credential overlays in the normal builder remain filtered.
Daemon restarts must pass the typed `syntheticProvider` dependency again.
Native Git contracts use `projectHub`'s typed `scratchGitConfig.excludesFile`
for a project-owned excludes file; the remote fixture's `gitExcludes` option
creates it. Only `core.excludesFile` is admitted through inline Git config,
and arbitrary `GIT_CONFIG_*` extras remain filtered.
See [Fixtures](../docs/agents/tests.md#fixtures) for the T1 poisoned-parent proof
and the deliberate synthetic-auth native adapter contract.

`node --test hub/test/scenarios/setup.test.ts` runs the complete setup scenario
through a pseudo-terminal: missing Codex, signed-out Claude Code, a declined
account profile, a stand-in workbench launcher, and one real scratch hub/Aide.
It checks terminal and nonterminal reruns, trust files and remembered installer
declines, then observes stopped processes before removing the scratch HOME.

`test/setup-machine.ts` builds a temporary HOME, XDG directories, Git identity
and project through the real `cland init`. Its PATH contains only allowlisted
host utilities and fake harnesses. It inherits no account overrides, shell
startup configuration or provider tokens. Never add the host PATH or a real
DigitalOcean token to this environment. No installer makes a network request:
the fake `curl` answers only the three official URLs, and rejects anything else.

For QA, make a local `hub/test/setup-qa.try.ts` with the following, then run
`node hub/test/setup-qa.try.ts` from a terminal (after setup ships). Claude Code
is missing, Codex is signed in and OpenCode is signed out:

```ts
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { fileURLToPath } from 'node:url';
import { setupMachine, signIn, calls } from './setup-machine.ts';
import { initIn } from './init-machine.ts';
import { beforeDirectories, ownProcess } from './process-cleanup.ts';

test('try setup', async t => {
  const machine = await setupMachine(t, { installed: ['codex', 'opencode'] });
  await signIn(machine, 'codex');
  console.log({ project: machine.project, home: machine.home });
  const child = spawn(process.execPath,
    [fileURLToPath(new URL('../bin/cland.ts', import.meta.url)), 'setup', '--attach'],
    { cwd: machine.project, env: machine.env, stdio: 'inherit' });
  ownProcess(t, child.pid);
  // Stop the scratch hub before the fixture removes its HOME and project.
  beforeDirectories(t, async () => { await initIn(machine, machine.project, 'hub', 'stop'); });
  const [code] = await once(child, 'close', { signal: t.signal });
  assert.equal(code, 0);
  console.log(await calls(machine));
});
```

The fixture cleans up after the test; remove the local try file afterwards.
`installFake(machine, harness, 'installer')` puts a binary only in its vendor's
folder, off PATH; the default `'path'` puts it in the fake bin folder.
`signIn(machine, harness, false)` signs out, and
`profileEnvironment(machine, harness, scratchPath)` selects another profile
(`OPENCODE_DB` for OpenCode). Apply that environment to a copy of the machine
before calling helpers or starting commands. `loginFails(machine, harness, true)`
makes login exit zero without changing its marker. Set
`machine.env.FAKE_INSTALL_FAILS = 'claude-code'` (or `'codex'`, `'opencode'`,
`'1'` for all) to make the emitted installer fail. OpenCode's default connection
is a credential; `signIn(machine, 'opencode', true, { connection: 'env' })`
models an env-only connection. `calls(machine)` reads invocations and Codex RPCs.

`node --test hub/test/setup-machine.test.ts` exercises the installers, profile
logins and Codex trust/EOF behaviour inside a poisoned inherited scratch HOME,
then compares its `.claude.json`, `.codex/` and `.config/cland/` contents. The
human's real account files are never opened by this self-test.

The fake harness fixtures use **30 ms turns**, **50 ms adapter polls**, **100 ms
Claude push trust**, and a **150 ms Codex refuse window**. Direct invocations of
the fake executables retain their 300 ms turn and 1500 ms Codex refusal fallbacks.
Pass `turnMs`, `pollMs` or `pushTrustMs` to `fakeClaude` / `fakeCodex` (or set the
fake's `FAKE_*_TURN_MS` in a standalone fixture) when a test needs a slower turn or
suppressed polling. Comment each opt-in with the race or behaviour it stages.
OpenCode's existing “take your time” input also selects a slow turn. A fast-default
race is a Bug to report to the item's lead; any temporary slow opt-in names it.

Positive waits use frames, journal records or `eventually`. Negative waits span
named schedule intervals; wall-clock boundary and real deadline proofs retain
comments explaining the wait. Claude logs its resolved `claude-schedule` so a
default can be asserted without waiting out 30 seconds. Executor fixtures can
scale runtime deadlines with `CLAND_TEST_EXECUTOR_LIFETIME_MS` and
`CLAND_TEST_EXECUTOR_RUN_TIMEOUT_MS`, alongside the existing sweep, watchdog and
collection timing knobs. These do not change config parsing or validation.
`CLAND_TEST_USAGE_EVENT_MS` similarly scales the existing Sessions usage and
account-limit publication window. Usage fixtures use 100 ms; stop-before-publication
cases and the real-window account-limits test retain the 1000 ms production default.

`CLAND_TEST_WAIT_MS` is a test-harness-only failure deadline: a finite positive
number sets the default budget for `eventually` and the gated verifier's startup
wait. Without it (or with an invalid value), `eventually` retains 15 seconds and
the verifier startup wait gets 30 seconds to prepare its worktree and start its
harness under load. Explicit deadlines on other waits stay as specified. The
verifier fixture releases its adapter only after the competing tracker operations
finish, without a timed gate opening. No production timeout changes. Linux proof
runs use the defaults, with this variable unset.

`CLAND_TEST_EVENT_WINDOW_MS` is a test-only daemon knob: a finite positive number
sets the equal-event coalescing window in milliseconds. Without it (or with an
invalid value), the production window remains 60 seconds. The window-boundary
test uses 250 ms and waits 300 ms, retaining its separate-event/count assertions;
other coalescing tests retain the default window. An injected-clock test checks
that the production default includes 59,999 ms and excludes 60,000 ms without
waiting a minute. In-process hubs can instead
use `eventWindowMs` or their existing injectable `now` clock. Timing fixtures
retain generous failure deadlines: shortening a window does not shorten how long
a loaded machine has to become ready.

Fixture hubs started with `startDaemon(t, root, env)` skip the startup orphan sweep
by default (`CLAND_TEST_SKIP_ORPHAN_SWEEP=1`) and log `orphan-sweep-skipped`.
Tests proving startup cleanup pass the fourth argument `{ sweep: true }`; an
explicit environment value takes precedence over that option. Production startup
without the variable still sweeps. Doctor and on-demand cleanup are unaffected.

Test helpers record each process's PID, process group and start identity at spawn
or first observation through the CLI, hub frames or fake harness records. PIDs
from one protocol result are captured together. Teardown
selects only those PIDs and their recorded leader groups (`pgrep -g`, followed by
`ps -p`), verifies the original identities, and kills a group only when its leader
and every selected member are owned. Non-leaders and groups with an unrelated
member receive individual PID signals. Processes older than the test worker are preserved; its ancestors are protected
using targeted probes. Current ancestry proves child ownership;
reparented members require a targeted cwd check under a still-owned fixture.
An exited leader retains its recorded group until selected survivors are checked;
verified survivors receive individual signals, since the absent leader cannot
authorize a group signal. A reused leader cannot authorize its replacement group.
Exit waits probe only captured PIDs. An already-absent registered non-leader needs no additional spawn. Directory teardown kills registered processes
before removing the directory, without a machine-wide process or cwd listing.
`cleanupProcesses` uses the same targeted path when given captured seed identities.
A live seed that no longer verifies falls back to the full ownership proof, preserving
its replacement identity. Root cleanup without seeds and the runner’s phase sweep
retain machine-wide discovery so unregistered leaks are still found.

`fakeClaude` closes writer admission after resource and hub shutdown, reaps
registered session groups, then drains every registered CLI before removing its
home. The 5-second drain deadline reports the remaining PID/start identities and
retains the home; it never authorizes killing a slow poll or removing its files.
Release or stop the reported writer before retrying cleanup. Removal itself
retries ENOTEMPTY/EBUSY for 1 second and names remaining files on exhaustion.
The lifecycle regression injects a complete `writerClock` to cross the drain
deadline with a deliberately held real poll, without a wall-clock delay.

An OS process identity disappearing and an `execFile` callback arriving are
different receipts: the callback waits for stdio closure and may arrive later
under load. Assert the writer's OS identity is gone at the removal boundary;
await the callback separately to check successful CLI completion. Do not treat
an undelivered callback as proof that a process can still write.

The machine shards run at concurrency 4 locally and 2 on droplets (D53, measured on c-8); hermetic shards run at 1. Targeted single-file runs are free:
`node --test hub/test/daemon.test.ts`. If calling the runner directly, use
`node hub/test/run-suite.ts hub` or `node hub/test/run-suite.ts nvim`; raw
`node --test` is reserved for targeted runs.

Each phase ends with `suite skip details N` and one `suite skip` JSON record per
skipped test, containing its repository-relative file, name and reason. Both
static platform skips and runtime prerequisite skips appear on macOS and Linux;
for a skip without an authored reason the record says so. The ordinary Node
reporter still owns the test counts: these detail lines do not match the hub's
`# skipped N` / `ℹ skipped N` count diagnostics and cannot double their totals.

#### Running the suite on Linux

Use Ubuntu 24.04 with `git`, `curl`, `ca-certificates`, `build-essential`,
`python3`, `jq`, `lsof`, `xz-utils`, `procps` and `locales` installed. Use Node
24.13 or later in the 24.x line (see `package.json`). For this repository, run
`node hub/bin/verify-prepare.ts` to install dependencies and fetch and verify the
release pinned by `nvim/NVIM_VERSION` and `nvim/NVIM_SHA256SUMS`. Local verification
does not run prepare; a droplet runs the configured prepare automatically. Run as
an ordinary login user with
a home under `/home`, with no added environment settings (normal login `HOME`,
`USER`, `LANG` and `PATH` suffice): `npm run check && npm test -- --all`.
`PS_PERSONALITY` and `CLAND_TEST_*` overrides are unnecessary. Agent runs still
follow the verification queue rules above.

For a local container, use `docker run --init` and an explicit CPU limit within
the host's available CPUs. A real init must reap orphaned descendants; using
`sleep infinity` as PID 1 alone leaves zombies that invalidate process-exit
tests. The macOS `sandbox-exec` cases are listed as skips on Linux, along with
an absent real OpenCode binary or any missing prerequisites. Installing OpenCode
is optional; its fake adapter coverage still runs. Root runs additionally list
the permission-denial recovery case that root cannot exercise.

The runner uses a short temporary directory for each phase (Unix socket paths must
fit). After the test process exits, one machine-wide discovery sweep is the safety
net for missed registrations and crashed tests. It verifies process start identities
and either cwd containment in the phase root or current ancestry to its recorded
runner before signalling; revalidation and exit waits target the captured PIDs and groups. Late group
members must prove current cwd containment or descent from an original identity;
they are captured during targeted revalidation.
The same discovery snapshot counts phase-owned `cland hook bridge` candidates.
Each phase prints `suite hook bridges: before cleanup N; after cleanup N` after
waiting for the captured identities to exit. A surviving candidate fails the phase;
ambiguous ownership still prevents a signal. Existing bridges outside the phase
are excluded by its root and run marker.
Each cleaned process is visible as `cleanup pid <pid>: <command>` in the runner's
log; ambiguous candidates are preserved and printed as `preserved pid <pid>:
ambiguous ownership`. Production inspection and test cleanup share
`ps -ww -e -o pid=,ppid=,pgid=,lstart=,stat=,command=` on macOS and Linux
(procps-ng); targeted listings replace `-e` with `-p <pids>`. The repeated `-w`
keeps the full command line, zombies are dropped, and start-time whitespace is
normalized to match the lock's `processStarted` identity. No `PS_PERSONALITY`
setting is needed. Cwd discovery uses `lsof` on macOS or `/proc` on Linux.
Environment markers select candidates and diagnostics; they never prove ownership.
The phase root retains its device/inode proof, including during crashed-holder
recovery, and is removed after the sweep. A test runner waits at startup until its
PID/start identity is durably recorded.

New process fixtures must use `tempProject` or `ownDirectory` and register each
process with `ownProcess` before awaiting startup. Helpers associate protocol/CLI
PIDs with their registered fixture directories; `ownProcess(t, pid)` also belongs
to that test context. Start fixtures detached when they need to own descendants as
a group. Signal handlers clean registered identities on SIGINT/SIGTERM; a crash
that bypasses them is covered and reported by the phase sweep.

Production grace waits select descendants of captured parents with bounded
`pgrep -P` walks and targeted `ps -p` snapshots. Each new child still needs a
current parent/start-identity proof before reservation and capture, so an observed
child stays owned after its parent exits gracefully. After freeze/KILL, waits
probe only captured PIDs. Termination
settles without another spawn when `kill(pid, 0)` confirms all are absent. Its full
initial tree discovery, repeated fork-to-freeze walks, immediate identity check
before each signal, ancestor protection and reservation/authority checks remain. Synchronous lock
acquisition caches only a successful identity for its own current-process lock
record, as asynchronous acquisition already does. A missing self identity is
retried. The general PID probe APIs and every foreign-PID pre-signal check stay
fresh; no identity of another process is cached.
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

`new` is the creation command; `create` remains an alias. The shell accepts directory sources, `--folder` for a new folder, and `--entry <relative-file>` to select its entry:

```sh
cland artifact new --kind note --title "v0.2 notes" --topic general --folder --content '# v0.2' --json
cland artifact new --kind note --title "Imported notes" --topic general --path ./notes --entry README.md
cland artifact open A-3
cland artifact keep A-3
cland artifact keep A-3 --release
cland artifact move A-4 A-3 --name details.md
cland artifact archive A-3
cland artifact promote A-3 docs/v0.2-notes
```

The Neovim workbench opens Markdown artifacts in a read-only rendered view using the thread’s projection, including laid-out tables and compact link tails. `␣v` (also in Keys and the palette) toggles the raw editable file; `:w` saves in raw. Each open defaults to rendered, while prompt drafts open raw. The artifacts browser opens folder entries and Markdown children through the same artifact opener; palette `CTRL-v` uses that opener for a split beside the centre. Each window toggles independently and renders at its own width. The client caches decorations by path, mtime, size and view width. Mermaid source and browser artifacts retain their existing open behaviour. See [Shared artifacts](../nvim/README.md#shared-artifacts).

`open` launches `$VISUAL`, then `$EDITOR`, or `nvim`, on the saved file or a folder's entry. Editor settings may include quoted arguments. Saving edits those durable bytes directly; adding files to the folder needs no hub operation. `open --json` launches no editor and returns the resolved `path`, artifact metadata, `editable`, and the folder's on-demand `files` list. Old ids of absorbed files resolve to their current location. Agents can read protected human and Aide paths with `--json`, but cannot open them for editing; this includes a formerly agent-owned file absorbed into a protected folder. An Aide may edit for the human. The hub includes `editable` in single-artifact `artifact.list` results based on the caller and the containing folder's author.

`keep --release` clears the kept flag. `move` takes the source file id and destination folder id, with an optional single file name. `archive` changes the artifact's layer. These commands use the same hub frames, author protection and calling-session identity as the spoke tools. All accept `--json`; irrelevant options and extra arguments are refused. A refused lifecycle command returns an error without stopping the hub.

Directory sources are copied as a single folder artifact, with `folder: true` and a project-owned directory `path`. Its `entry` is a relative file name: supply it at creation or let the first `.md` in sorted relative-path order become the entry. `folder: true` without a source creates an entry file (`index.md` by default), optionally filled from `content`. A copied folder must contain its entry, and only regular files and directories are accepted; symlinks and special files are refused. Folder contents have no separate ids. The entry is used for prompt sending, attachments, launch briefs and opening the chip in the workbench.

`artifact.list` is also a spoke tool. With `artifact: "A-3"` it resolves that id and returns `{artifact, files}` for a folder (`files` is a sorted list of relative file names), or `{artifact}` for a file. Without an id it lists the project or a supplied topic. Files are discovered on request, so editing or adding them does not require reindexing.

The UI can send `artifact.create` and `artifact.list` frames; list returns `{artifacts: [...]}` for the project or a supplied `topic`. Drafts are included in lists and emit `artifact` events for subscribed clients. A human `prompt.send` frame (`artifact: "A-3"`, optional `attach: true`) reads the saved prompt and posts its text when it fits `[hygiene].max_text_bytes` (8 KiB by default). Above the cap, or with `attach`, it posts `Prompt A-3: <title>` with the artifact attached. The pointer is bounded to the byte cap on a complete UTF-8 character boundary; the full title remains in attachment metadata. The message and `sent` status commit together before publication: a failed post or status write leaves the draft and no delivery. A prompt already sent cannot be posted again through `prompt.send`.

The spoke's `send` accepts `artifacts: ["A-3", "A-4"]` alongside `text`, `to` and `topic`. Each id must exist in that topic, be unarchived, and have a readable file; unknown or foreign-topic ids refuse the whole send. Availability and caller permissions are checked again after asynchronous file preparation. Attached prompt drafts become `sent` with the post. Deliveries include an `artifacts` array of metadata and durable paths; `artifact_id` and `artifact_path` name the first attachment for compatibility. Attachment messages retain their text alongside chips in the workbench.

Artifact creation prepares and cleans up its files asynchronously, with serialized id reservation, indexed ownership checks, and measured request continuations. The shared permission gate reads the in-memory roles snapshot, and journal appends use an ordered asynchronous queue (T-75).
### Promote, archive and retention

The human can keep an artifact in the repository with `cland artifact promote A-3 docs/design/merge-flow.mmd`, or press `p` in the topic's artifact list and enter a project-relative path. An Aide can promote through the `artifact.promote` spoke tool or from its shell. The Coordinator can promote agent artifacts from its own shell through the `artifact.promote` grant; Implementer, Reviewer and QA cannot. The UI frame is `{"type":"artifact.promote","artifact":"A-3","path":"docs/design/merge-flow.mmd"}` and returns `{artifact}`. Promotion copies the bytes, creates missing parent directories, records `promoted` in the index, and stages or commits nothing. Existing destinations, absolute paths, `..` segments, paths under `.cland/` or `.git/` (including case variants), and symlinked parent directories are refused. After copying, a resolved path outside the project or under `.cland/` or `.git/` is removed and refused. Promotion confines paths against the project tree as it is, not against concurrent filesystem changes by other processes. The list and picker show `promoted: <path>`. Promoted artifacts keep their original source and are exempt from archive and retention.

Closing a topic, directly or by closing its bound item, marks its unkept agent artifacts `archived` and records `archivedAt`. A message reopens the topic and restores surviving automatically archived artifacts to `shared`; explicitly archived artifacts stay archived. Archived files are deleted in the background at hub start and daily after `[artifacts] retention_days` (default `30`; `0` makes them eligible immediately). Deleting a closed topic leaves its archived entries eligible for retention. The index entry remains with `fileDeleted: true`, shown as **file deleted** in the CLI, topic list and picker. Reopening a topic does not restore deleted artifacts. Artifact-change events update connected workbenches.

Artifacts record immutable author kind and role at creation. The human's and Aides' artifacts are never archived or deleted automatically, including after the author changes role. A manual archive only changes their layer. `artifact.keep {artifact: "A-3"}` sets `kept: true`, exempts an agent artifact from retention; `kept: false` releases it, archiving it if its topic is already closed. Keeping an archived artifact restores it to shared. A kept artifact is classified `watch` in the shared classifier (T-205). `artifact.archive {artifact: "A-3"}` explicitly archives it. Agents cannot mutate a human or Aide artifact through these tools, move, or promotion; an Aide may act for the human.

`artifact.move {artifact: "A-3", folder: "A-4", name: "notes.md"}` absorbs a file into a folder. `name` is optional and defaults to the original file name. Existing names, dot segments, folder-to-folder moves, moved sources and destinations the caller cannot edit are refused. A human or Aide file requires a human or Aide folder so absorption preserves its protected lifetime. The source index becomes `status: "moved"` with `movedTo: {folder, path}`; it disappears from ordinary lists and follows the destination folder's lifetime. The old id still resolves through `artifact.list`, history chips, attachments and launch briefs to its file inside the folder. Move publishes the redirect before removing the old hard link; a housekeeping failure returns success with `followUp`, and retention retries removal without deleting a different file recreated at the old path.

Folder retention uses a rename to a deterministic `.retained` directory until the index commits. Failed index writes or a concurrent keep/reopen restore the entire folder; interrupted cleanup recovers on the next sweep. Deletion or housekeeping failures remain retryable. Ordinary file retention keeps its existing hard-link recovery.

`artifact.delete {artifact: "A-3"}` is a human-only UI protocol frame, used by the browser’s confirmed `x` action. Agent sessions, including session-attributed client frames, are refused; there is no agent tool or CLI command. It removes the artifact’s stored file or folder and retains `fileDeleted: true` in the index. A moved id deletes its file inside the owning folder. Artifact events update the browser and deleted chips in topic history. Promoted project copies are retained.

The built-in role tool lists now grant `artifact.keep`, `artifact.move` and `artifact.archive`. Existing explicit `roles.toml` lists need those grants added; `artifact.list` uses the existing history/read grant. No role clause changes are required.

Folder promotion copies the entire tree, including nested files, binary bytes and empty directories, into a new project-relative directory. The destination names that directory; it must not already exist, even if empty. Symlinks and special files added to an artifact after creation are refused, and the saved entry must still exist as a regular file. Promotion reserves the artifact across the copy and removes the entire partial destination on copy, permission or index failure. The source remains in the artifact workspace, and Git's index and commits are untouched. The same confined-path rules apply to folder promotion, including nested `.cland` or `.git` paths.

`cland init` writes `[artifacts]` with `retention_days = 30`. `cland update` adds that section to managed configurations that lack it and keeps changed values, including zero. It leaves unmarked config files and existing `roles.toml` files alone; an existing explicit Coordinator tool list needs `"artifact.promote"` added by the human.

Promotion reserves its artifact across asynchronous I/O, rechecks permission and the latest index state after copying, and rolls back its exclusive destination if the index write fails. A notification failure after the index commit keeps both the copied file and its promoted mark, returning a successful result with a `followUp` warning; a retry sees the existing promotion. Subscriber and error-logger failures cannot reverse committed promotion, archive or reopen state. Retention retains a hard link until deletion and its index write finish, so a topic reopened during deletion or an index write failure restores the original bytes. Interrupted retention is recovered on the next sweep; failed housekeeping is retried. A concurrent promotion/cleanup of the same artifact is refused with `artifact-busy` and can be retried.

### Harness termination and orphan sweep

`cland session stop <name>` waits for the launched OpenCode server, Codex app-server or Claude Code process tree to exit. All termination callers reserve the captured PIDs in a shared machine registry (`/tmp/cland-termination-<uid>`), including late descendants, and retain their reservations through final verification and recovery thaw. Overlapping callers wait for the owner, reverify identities, and report completion only when they terminated the tree themselves; disjoint trees can finish in parallel. Reservations use crash-recoverable PID/start-time owner locks and do not depend on the caller’s project or TMPDIR. It verifies each PID’s recorded start time immediately before signalling that positive PID, sends SIGTERM, and escalates after the grace period (`CLAND_STOP_GRACE_MS`, default 5000 ms). Before SIGKILL, it freezes verified PIDs with SIGSTOP, walks the tree again to capture and stop late children, and confirms the entire captured tree is stopped. It then kills each verified PID and confirms that every captured identity is gone. It never signals an entire process group: new group members cannot inherit ownership from an earlier snapshot. Every exit path sends SIGCONT to the PIDs this call stopped unless their identities are confirmed gone, including when process inspection is unavailable. If death or PID reuse happens without being observed before inspection fails, this recovery SIGCONT can reach a replacement process; the policy accepts that tradeoff because CONT does not stop or terminate a running process, although it can invoke that process’s SIGCONT handler. A refused or unverifiable escalation reports incomplete termination. Relaunch waits for that same termination before starting the replacement. `harness-ended` in `.cland/journal.jsonl` names the server PID, captured descendants and whether killing was necessary. An unverifiable PID is never killed; stop/relaunch fails and retains its running row and supervision.

Production startup sweeps unless `CLAND_TEST_SKIP_ORPHAN_SWEEP=1` is set. The `startDaemon` test fixture sets it by default, logs `orphan-sweep-skipped`, and accepts `{ sweep: true }` as its fourth argument for sweep proofs (an explicit environment value wins). This changes only the startup sweep, not doctor or on-demand cleanup.

After opening its sockets, a new hub sweeps this project’s harness servers whose session is exited, stopped or offline, or whose process-table row is missing. Ownership requires a verified OS cwd under this project or descent from a PID/start-time-verified wrapper with a project cwd. When a process row exists, its recorded PID and start time must match; an unknown start time or reused PID is preserved even when socket or log hints match. A recorded launch, project-specific Codex socket/log or OpenCode `serve.log` identifies candidates but never proves ownership alone. This also covers a Codex socket placed under the temp directory because the project path is too long. Verified running roots and their descendant trees are preserved for resume. Pending launch and resume reservations also protect servers before their process-table rows are published; the sweep rechecks these protections immediately before every signal. A PID/start-time-verified lock under `.cland/run/orphan-sweep.lock` serializes startup and doctor sweeps per project; a contender reports “sweep busy”. Within one sweep, workers atomically claim each process they capture, and ancestor candidates settle before queued descendants are reassessed. Cleanup runs in parallel in the background with a shared 12-second deadline, so it cannot delay socket readiness. Startup points to `cland doctor`, which reports the PIDs ended since the latest hub start from the journal (`orphan-ended`). Ambiguous candidates are reported as `orphan-preserved` and left alive. Sweep diagnostics also reach stderr.

Hook bridges retry an unavailable hub for at most 60 seconds, rereading discovery
so a restart within that grace can reconnect. Missing discovery, a refused bridge,
and a socket that never completes the handshake share the same deadline. Successful
attachment resets the grace; stdout failure and parent changes also stop the bridge.
Expiry tells the Claude mod to stop restarting that bridge.

`cland doctor` also lists the calling user's hook bridges whose explicit hub file
is missing. `cland doctor --fix` safely ends these with PID/start-time revalidation
and a fresh absence check before each signal. Any existing hub file is preserved,
even if malformed or unreachable. Ambiguous flattened arguments (including paths
with whitespace), inaccessible files and unknown user identities are preserved.
This is the supported cleanup for future orphan bridges; manual process killing
is unnecessary.

Fixture clients, stdio stubs and explicitly test-launched hubs also hold a private
PID-bound ownership receipt open outside their disposable directories. The receipt
names both the fixture cwd and its source checkout. Startup and doctor discover
these fixtures when either root has disappeared; `doctor --fix` requires the open
receipt, its private same-user file metadata, the process UID and fresh PID/start-time
checks before termination. Old fixtures without receipts appear as ambiguous
candidates and are preserved. Command lines and environments are never printed or
used alone to authorize signals. Task pruning, creation rollback and merge-batch
checkout removal stop receipt-bearing fixtures associated with that worktree and
observe completion before Git removes it; incomplete cleanup keeps the worktree.
When a deleted-project hub has both OS project ownership and a fixture receipt,
doctor reports it once as `orphan hub`; the hub classification takes precedence.
The receipt still authorizes fixture/worktree cleanup when its source checkout
disappears while the project itself remains live.

Neovim fixtures inherit the receipt as explicit child fd 3. Unix spawn clears
close-on-exec for this descriptor; the parent's copy then closes. Linux discovery
reads `/proc/<pid>/fd` symlinks, while macOS uses `lsof`. Receipt birth windows
include the second before the parent's spawn interval: Linux `ps lstart` adds
whole boot seconds to truncated start ticks, which can report that earlier second.
Open-file, UID, PID and fresh start-time checks remain required; the margin alone
never establishes ownership.

`cland doctor [dir]` reports orphan servers, names their recorded session and status, and recommends `cland doctor --fix`. The fix ends verified orphan harness servers while preserving running sessions and unverifiable identities. An unpublished server is preserved while another live hub holds the project lock, because doctor cannot see that hub’s in-flight launch reservations; stop that hub before retrying cleanup. Doctor also reports cland hub daemons whose project directories were deleted, using their OS cwd and open project files to prove ownership, and `--fix` ends those daemons. Doctor tests scope deleted-project discovery to their fixture root with `CLAND_TEST_ORPHAN_ROOT`, so parallel fixtures cannot end each other’s hubs. If the OS cannot supply ownership evidence, inspect the candidate manually. On Linux the sweep reads `/proc`; on macOS it uses bounded asynchronous `lsof` calls. Every session start-time probe and termination probe uses asynchronous `ps`, keeping process inspection off the hub’s synchronous request path. Concurrent start-time reads with the same timeout and timezone share one `ps -p a,b,c` per event-loop turn; callers for an already in-flight PID share that read. Results are removed before callers resume, so a later read still detects PID reuse.

### QA brief lint

`cland qa lint qa/briefs/T-957.md` checks a brief offline against the help and built-in role permissions in the executable build. It executes no commands and needs no hub. Exit 0 means no findings, 1 lists one `file:line` finding per line, and 2 means a usage or file-read error. Run it at the build under test before requesting item or stage QA. The brief is complete only when qa lint passes at the build.

Commands in table command/method/action/note columns are checked for known subcommands and flags; check IDs must be unique across case/manual tables and surfaces must match the recorder: `headless-grid`, `tmux`, `web-terminal`, `hub-api` or `real-browser`. A `role` or `actor` column, `Role: Implementer`, or a heading naming a role assigns commands to that built-in role. Implementer verification reports cannot target General or Agents; `topic create` needs a nonempty `--item` binding for that role. Variable `rm` operands in commands and shell fences fail even behind a path guard. Use literal cleanup paths. This static check does not resolve shell helpers, claims, live topic ownership or custom grants; the hub remains authoritative. See [QA brief lint](../docs/agents/qa-brief-lint.md).

Web briefs include local `real-browser` cases run by QA on Codex `gpt-6-astra` through computer use after the Coordinator tells the human. Open the `cland web` link (or a brief-specified local static page until available) in the human’s default browser, with normal HOME/login keychain and a dedicated cland profile; keep fixture commands in sealed disposable projects. Touch only the cland page and its browser permission prompts, save screenshots under `.cland/qa/<item>/<run>/`, close the opened tab and record with `qa-record.sh note`. Implementers and Reviewers never launch the real browser or GUI on the human’s Mac. Never press Reset or change keychain, profile or system settings; Cancel unexpected dialogs and report any that cannot be cancelled, missing permissions/profile or harness refusal to the item lead as a blocker. See [review and QA](../docs/review-and-qa.md#web-qa-in-the-real-browser) and the qa skill’s Web briefs procedure.

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
are available to the crew roles (Coordinator, Lead, Implementer, Reviewer and QA). Aides cannot subscribe; retained explicit subscriptions from a previous role do not deliver events while the session is an Aide. An Aide claimant receives its item's default subscriptions as direct lead deliveries. Existing projects can grant `subscribe`,
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
open items without an active lead in their ancestry (an Implementer or Aide claimant, or a
container Lead on an epic or release node); each lead covers its claimed items and their
descendants, excluding subtrees with their own active lead. Ownership walks up to the nearest active lead using stable session
identities; anonymous hellos retain distinct provisional name identities. Both subscription listings include these rows with `default: true`, a stable
`default:<session-id>:<item-id>` id, `events: ["task", "session.state"]` and `digest: "turn"`.
They follow claims, handovers, renames and reconnects; `unsubscribe` removes only
explicit requests. Closing an item delivers its final event and removes its default.

Default task events cover status changes, verdicts and final close/removal events.
A transition to `ready` also reaches the item's supervising lead (the nearest node Lead above the item, else the Coordinator) with `digest: "now"`, even without an explicit subscription; it starts a turn through the ordinary queue on adapters without steering. Intermediate claimed-item events stay lead-only and digested. Explicit subscriptions may widen this traffic, and overlap still delivers once per recipient;
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
idles also create journal records shown in the events view. Harness approval prompts remain in the inbox
because they require the human to answer.

### Crew staffing

`.cland/crew.toml` is committed project staffing policy. Init and the first hub start write it once; init/update preserve existing files. `roles.toml` continues to hold role definitions, permissions and harness defaults.

The top-level `idle_from` is an ordered list of open category ids, default `[]` (never take category work). `cland crew set idle_from C-216` sets one; a TOML list sets several, and `'[]'` clears it. Any recognized kind prefix resolves by number and is saved as `C-<n>`. Setting it refuses unknown items, non-categories, closed categories and duplicates, including aliases of the same number. On hand reload, invalid category references stay in the file and are ignored individually; `cland crew show` and `--json` list each reason while the remaining staffing stays in force. The reload reads the tracker once, and later item changes are reflected on the next reload.

The top-level `leads` is a unique list of configured container kinds (empty for a flat crew). Additional root kinds, including category, are refused: the Coordinator leads them. Tables `[crew.<role>]` accept `policy` (`per-item`, `per-group`, `pool`, `singleton`), optional positive integer `size`, boolean `keep_context` and `subagents`, and `stop_after` (`merge` or `never`), plus `heartbeat` (see Role heartbeats below). Unknown roles and keys are refused. Missing roles/keys take built-in defaults: Coordinator singleton; Lead per-item; Implementer per-item stopping after merge; Reviewer pool of one with kept context; QA singleton; Aide per-item without a cap. Only Coordinator and Lead allow sub-agents by default. Pool size defaults to one; singleton size must be one. Per-item/per-group size may be omitted for no cap. `per-group` staffs one session per lane in an epic plan. The Coordinator or Lead gives it the ordered ids and keeps it alive until the lane finishes, switching to each next task worktree after merge. Stage order and reuse are role-clause instructions; the hub does not schedule stages.

`cland crew show [--json]` returns the effective policy and its summary. `cland crew set reviewer.size 2` validates and atomically saves a complete TOML file; values accept TOML booleans, integers and quoted strings, or bare policy names. `cland crew set leads '["epic"]'` changes lead levels. Set normalizes the file, including filling omitted defaults. The human, Coordinator, Lead and Aide may set it; other session shells may show it. No role-clause or permission-file changes are needed.

The hub reloads every 500 ms off the request path. A malformed, invalid or missing file emits an Agents refusal notice to the Coordinator and retains the last good crew (built-in defaults before the first valid load). Set refuses to overwrite an invalid file. `crew.show` returns `{config, summary}`; `crew.set` takes `{key, value}` and returns the same shape. `hub.status.crew` carries that snapshot, and a `crew` event carries `{config, summary}` when the effective policy changes. The sessions panel header follows both snapshots and events, for example `impl per item · rev pool 2 · qa 1 · leads: epic`.

`session.launch` enforces the role's cap, including launches still being prepared, live spokes and supervised failed-launch cleanup. A singleton admits one running session; a smaller cap after reload prevents new launches and leaves existing sessions running. Failed admission releases its slot. Role exclusivity from `roles.toml` still applies.

For `pool` with `keep_context = true`, an item launch returns an idle member before starting another harness. Read the returned `process.name`: it may differ from the requested name. Reuse preserves native identity and context, updates `process.item`, and delivers an optional text/artifact brief through the ordinary message pipeline. A member with a current claim/verification hold, pending ordinary delivery, in-flight injection or lifecycle operation is unavailable. With `keep_context = false`, verifiers launch fresh and the cap still applies; stop an existing verifier to make room. An Implementer pool instead restarts an idle member with a fresh conversation.

Retained Reviewer and QA pools launch at the project root; their brief names the item, branch, head and task worktree to inspect. Other roles reuse only when the working directory matches. An idle Implementer pool member moves to the next item's worktree by stopping its old harness and launching a replacement there, keeping its name and pool slot. With `keep_context = true`, Claude Code resumes the native conversation with `--resume`, Codex uses `thread/resume` with the new cwd, and OpenCode reloads the native session and moves its stored location with [`session.move`](https://github.com/anomalyco/opencode/blob/dev/packages/protocol/src/groups/session.ts), waiting for that location before delivering work. With `keep_context = false`, the replacement starts a new native conversation. A requested different harness selects a matching member or launches fresh within the cap.

Every replacement gets a fresh cland session id and launch token; native conversation history is the only identity carried over. The ordinary launch admission, failed-spawn supervision, role clause, brief delivery and claim path apply to the replacement. The next brief is validated before stopping the old harness; missing native conversation identity refuses a retained handoff. Current claims, pending deliveries and lifecycle work prevent selection, and overlapping stop/resume requests cannot interrupt a reserved handoff. The verified stop releases the previous worktree for ordinary merged-item cleanup. A failed restart reports a launch error and takes no next-item claim. Reuse is recorded as `session-reused` in the journal and an Agents notice; restart entries also name the previous cland identity and whether context was kept.

After a successful merge closes the item, the hub stops its launched sessions whose current policy is `per-item` with `stop_after = "merge"`, before worktree cleanup. `stop_after = "never"`, pools and per-group sessions stay running. A stop failure returns a merge follow-up failure, preserving the landed commit; retry the merge to finish that follow-up. Failed/refused merges stop no sessions.

Role delivery appends the current crew's sub-agent rule to every clause, both at native first-turn spawn and at assignment/reconnect. Sub-agents report to their parent, never use its hub connection, and count to its cost. The Coordinator also receives the configured `leads` levels, or the flat-crew instruction when empty, and the active `idle_from` categories in order with their titles (or the rule that category work is never taken). Its base clause takes the lowest-ranked open, unblocked task of the first named category with one when the current release has no unblocked task; an epic in a category waits for promotion. Crew reload delivers updated clauses to live holders. Existing projects need only the Coordinator staffing sentence in `.cland/roles.toml` updated; sub-agent and level values come from `crew.toml`.

### Drafting and approving an epic plan

The Coordinator or the epic's claimed Lead runs the shipped `plan-epic` skill before work starts. Its `draft.mjs` helper reads the tracker and crew and emits a dependency-ordered first draft; the skill chooses QA policy and criteria before setting it through `cland task plan set`. Leads may set only their own epic plan.

`[plan] approval = "none"` is the default. With `"human"`, item-bound Implementer launches under an epic are refused until its accepted plan is approved. `cland task plan approve T-<epic>` and MCP/frame `task.plan` with `op: "approve"` are for the human or an Aide only; even the Coordinator cannot approve. Approval starts no session itself: the Coordinator or Lead starts the first stage afterward. `task.plan show` and `task view` expose `approval` with `required`, `state` (`pending`, `approved`, `not required`) and, when approved, `by` and `at`.

The epic file persists `plan_approval` (accepted-plan hash, approver and time); normal writes and hub restart preserve it. Changing the accepted plan makes its prior approval stale; repeating approval on the same plan is idempotent. Broken plan saves retain the previously accepted plan, and a broken candidate cannot be approved. The workbench's `gp` plan card reads this state; `a` approves through the hub and refreshes the card.

Stage order guides launches through the role clause. Finish the current stage's merges and any after-stage QA before starting the next. Under `per-group`, keep one session for each lane, even across its item merges; `stop_after = "merge"` applies when the lane has finished. Other crew policies retain their rules.

### Stage QA verdicts

For a stage with non-none scope and `when: after-stage`, its items merge on review; their QA-marked criteria still require QA verification before merge. An after-stage item override also requires stage QA, even under a per-item or none stage default; stage progress reports the strongest required after-stage scope. After every stage item lands on dev, QA runs the committed `qa/briefs/T-<epic>-stage-<index>.md` on that build and records `task.comment` on the epic with `verdict: qa`, `stage` (the exact plan stage name), `result`, `run`, and `commit` (the full tested dev SHA). The CLI adds `--stage "<name>"` to `cland task comment`. Only a live QA session can supply stage evidence; a review, human shell or file-only header cannot close it.

The hub checks all stage items are closed with dev merge receipts, that dev contains those merges, and that the verdict commit equals the dev tip. It rereads the plan, files and build before publishing. `task.view` and `task.plan show` expose `stages`, each with name, policy, item ids, open/closed state and latest hub stage verdict. A clear current stage verdict closes only that stage; not-clear keeps it open. Its snapshot covers the stage's lanes, policy, item overrides and merge records. Later dev descendants preserve that closed stage. The hub checks build ancestry in the background; an unknown or failed check, a dev rollback, changes to the snapshot or reopening a member keep it open until its evidence qualifies again. The historical verdict remains visible. A broken plan cannot receive a stage verdict. Altered or missing hub verdict headers invalidate closure.

Transient Git ancestry errors retry on the background tip schedule, at most once per two-second interval. Restoring Git can close a qualifying stage at the same dev SHA; no new commit or hub restart is needed. A completed negative ancestry check keeps it open.

The Coordinator or epic's Lead uses the qa skill's `STAGE-BRIEF.md`, commits the brief on dev and sends `qa request T-<epic> stage <name>` with the brief and dev SHA. QA uses a clean detached worktree, records every check under the epic id, and reports the stage result. After not-clear, the Lead adds finding items to the stage through a plan change, lands fixes, and requests a new run. Stage order continues through role clauses; no new launch scheduler is introduced. Stage verdicts do not mark epic criteria and cannot substitute for the separate final epic Definition of done QA run.

Plan-change notices in Agents expose `detail.item`, `by`, `previous` and `plan`, plus an optional `reason`. They are journalled and replayed with the same notice id after restart. `task.plan show` also returns ordered `history` entries (stable id, timestamp, author, previous/current plan or approval, and optional reason); `task.view` exposes them as `planHistory`. The tracker restores that history from the journal at startup, preserving publication order even at identical timestamps. Its history is independent of the Agents message retention window, so unrelated notices cannot hide unseen plan changes. `cland task plan set T-n --file plan.yaml --reason "why"` and the MCP/socket `task.plan set` field `reason` record that explanation only after successful publication. Refused plans create no change notice. Unchanged plans create a history entry when an explicit reason or large-task exception records a decision. Hand saves retain the `hand` author and do not invent a reason. Neovim keeps its per-machine last-look receipt in `ui.json`; it does not approve plans or alter tracker state to acknowledge a view.

Topic history accepts an optional `before` message id to page older retained messages in chronological order, including messages with equal timestamps. Each page retains the existing 200-message cap.

### Tracker id prefixes

An item's number is its identity. The hub returns the kind's canonical prefix (`R-` release, `E-` epic, `T-` task, `Q-` question, `M-` map, `S-` spec; `C-` category). Configured containers use their first letter, with collisions within the configured ladder refused. `task.view`, every task tool, item lead addresses, subscriptions and plan lanes accept any recognized prefix in either case, or a bare number. `T-107`, `R-107` and `107` resolve to the same epic `E-107`, even while its file is named `T-107-…md`. `A-12` is an artifact reference, not an item id.

Numeric resolution uses the indexed `tracker_items.n` column. The derived index and new ownership/evidence rows use a stable numeric lookup key spelled `T-<n>` internally; reads accept all kind prefixes and project canonical ids. Existing claims, holds, accepted plans, merge receipts, written verdicts, topic bindings, subscriptions and pending verification records are read by number without a startup rewrite. The process table projects its saved item reference through the same resolver. No journal, message, body, comment or branch is rewritten. Plans retain their reference spellings for approval hashing and compare lane membership by number.

New files and their frontmatter ids use the kind's prefix and one shared counter. Kind changes keep the number and slug and rename the file prefix. Duplicate numbers index once, prefer the file whose prefix matches its kind, log `task-duplicate-number` with both names and show a warning in `task.view`. The hub publishes the prefix table as `hub.status.tracker.prefixes` for Neovim.

### Task sizes and regression links

Tasks filed through CLI or MCP require `size` (XS, S, M or L), assigned ex ante by the author; other kinds refuse it. `task.create` without it returns `a task needs a size: XS, S, M or L`. Use `cland task create "Rework" --size S --regression-of T-321` with a landed target, and `cland task edit T-n --size L` to change a class; size cannot be cleared. `task.create` and `task.edit` refuse XL with instructions to split; existing XL and unsized files stay readable. Required size is checked only at the request layer, so GitHub import and internal `Tracker.create` callers stay compatible and sizeless.

Optional task `regression_of` names a closed task with a landing receipt on dev. Any recognized prefix or bare number resolves; reads show the target's canonical prefix. Create or `cland task link T-n --regression-of T-321` sets it, and `--regression-of none` (MCP null or none) clears it. Non-task, open, unlanded and self targets refuse with their reason. Both fields are file frontmatter and indexed columns used by `task.list`, `task.view` and task events, without list-time item reads. Every filed item carries a `## Summary` of one to three sentences; filing clauses and skills include the size and regression rules.

Offline `cland task migrate --sizes sizes.json --dry-run --json` previews a JSON id-to-size assignment map; omit `--dry-run` to apply. It fills only unsized open tasks, preserves existing sizes and closed tasks, and reports missing author decisions as unresolved. No size is guessed. It uses the existing migration startup lock and preflight safeguards. See `docs/agents/issue-tracker.md` for the backup, count review, idempotent rerun, suggested E-270 assignments and scratch-copy procedure. The Coordinator applies during the restart carrying T-331, then relaunches every role session including itself to refresh MCP schemas and clauses.


### Role heartbeats

Each `[crew.<role>]` in `.cland/crew.toml` accepts `heartbeat = "30m"` or
`heartbeat = "off"`. Durations use integer `s`, `m`, `h` or `d` units and must
be at least one minute. An omitted Coordinator setting defaults to `"1h"`;
other roles default to off. `cland init` writes the Coordinator's `"1h"`.
`cland crew show [--json]` lists each setting and marks inherited values
`(default)`; `cland crew set coordinator.heartbeat 30m` changes it live.
The next firing uses the new interval counted from the last firing.

Each session has a schedule in `hub.db`, keyed by its stable identity and
started at launch. Renaming and `session resume --relaunch` retain it. A fresh
launch starts a new schedule. Restarting the hub preserves due times; several
missed intervals produce one firing after restart.

At each firing the hub computes two sections, each capped at ten rows with
`and N more` for overflow. In flight lists claimed items with status and session,
running and queued verification runs, open asks, and live remote leases.
Stale lists ages for review items without a pending review request or verdict at
the current head, ready items not merged, sessions idle past `[inbox] idle_minutes`,
runs past their timeout or ended without a posted result, and unanswered asks.
Items and asks become stale only after one full heartbeat interval in that state.

Heartbeats need no subscription. An idle session starts a turn; a busy session
or one waiting for approval holds one heartbeat in its next turn's digest.
A newer firing replaces an undelivered older heartbeat. Heartbeats never steer
running turns, enter the inbox or count as needs-you. The events view keeps one
background row per firing, naming the session and the in-flight and stale counts;
`heartbeat` is the ninth event kind. The Coordinator's clause describes repairs
and escalation, and ends a clean heartbeat without a message.

Tests set `CLAND_HEARTBEAT_MS` in the **hub's** environment to shorten the interval.
The one-minute floor applies to `crew.toml`, not this override. Connection liveness
uses a separate keepalive (`KEEPALIVE_MS`, `CLAND_HUB_KEEPALIVE_MS`); its wire frame
remains `ping`.

Optional regression `found_by` records where the escape was caught: `review`, `cover`, `droplet`, `qa` or `human`. For example, `cland task create "Escaped regression" --size S --regression-of T-321 --found-by cover` stores `found_by: cover`; `cland task edit T-n --found-by qa` changes it and `--found-by none` clears it (MCP `task.create`/`task.edit`: `found_by`, null clears on edit). Values outside that vocabulary or attribution without `regression_of` refuse. Clearing `regression_of` or converting away from a task removes `found_by`. Frontmatter, the rebuilt index, task views/lists/events and the `task-written` journal record carry the field. Legacy regression items without attribution remain readable.

### Marketing publication

`cland publish <branch> --item T-n [--dry-run] [--json]` publishes a linear marketing branch before it merges into dev. The Coordinator or human previews the commits, paths and exact resulting tips, then obtains approval through an ask as described in the release skill. `[publish] allow_paths` in `.cland/config.toml` accepts exact paths and `directory/**` prefixes; defaults are site, brand docs, README, LICENSE and the Pages workflow. The command excludes inherited unreleased dev commits, refuses mixed-path commits, atomically fast-forwards GitHub's default branch and site, and merges both histories into dev without rebasing open lanes. It syncs the local territory and comments the tips on the item. Preserve `publish.tmp` and retry the same branch/item after a failed follow-up. See [the agent procedure](../docs/agents/issue-tracker.md#marketing-publication).

## Coordinator account refusal procedure

- On an `account-limited` launch refusal, never launch on another account by your own choice. Read `cland account list` and `ask` the human: name the limited account, its reset time (or `until cleared`), and the harness's other accounts with each window's current used share and reset (or `no reading yet` / `no limit data`). Offer this launch on account X, the role pinned to account X in `roles.toml`, or waiting for the reset. Apply the answer: `--account X` for this launch; or edit `[<role>.launch] account`, committed on `dev`, then `cland push`; or wait. Under D24, the stand-in answers this ask, as any other.

## Coordinator session procedure

Hub-launched Claude Code runs with `DISABLE_AUTOUPDATER=1`, enforced after
credential filtering and in the supervised session settings. Update Claude Code
between sessions. If its process is replaced anyway, the watcher holds the row,
role and claims for a one-second re-exec grace after observing the old PID gone.
Native discovery can adopt a live replacement PID with a verified process start
identity only when it names the same harness session id; a reused background id
alone cannot transfer ownership. Native identity learned after launch by
discovery or a hook is kept in both the watcher and the durable process row.
A hello or bridge reconnect during that grace keeps the session's ownership
while discovery refreshes the PID. A dedicated expiry callback runs the final
native query at the grace boundary, independently of the ordinary liveness
poll; it bypasses the ordinary 30-second native-query
cache, so a reconnect after the last snapshot is still observed. If launch or
resume already owns a native query, the watcher settles it before the final
observation and ownership decision. If the process stays gone, the hub records
the exit and releases ownership after
the grace expires.
An explicit stop still waits for verified termination and publishes its stopped
state directly. Test fixtures can inject `ClaudeCodeOptions.reexecGraceMs` or
use `fakeClaude(t, { reexecGraceMs })` through the internal
`CLAND_TEST_CLAUDE_REEXEC_GRACE_MS` hook; there is no user grace setting or CLI flag.
If a newer native-id hook arrives during discovery or a replacement's
process-start probe, stale results cannot publish a PID or conversation. The next watcher tick
reconciles the newer identity before any grace-expiry exit.

If the Coordinator stays vacant for ten minutes, the hub posts one `decision`
notice in General naming the last holder and the recovery commands
`cland session resume <name> --relaunch` and `cland role set <name> coordinator`.
It sends no further vacancy alarm while that vacancy lasts; filling the role
cancels a pending alarm and a later vacancy starts a new ten-minute window.
The deadline, last holder and sent-notice receipt survive hub restart. An
absent remembered holder starts monitoring when the reopened hub has no live
Coordinator; restarting an existing vacancy keeps its original deadline.
Hub shutdown cancels vacancy monitoring; late socket closes after terminal core
shutdown cannot write vacancy state, publish transitions or rearm its timer.

For `cland hub stop` reporting `stopped, lock released, process still alive`,
exit 1 means the named PID remains alive after acknowledged shutdown and the
ten-second exit deadline. The CLI leaves it running because it released the
project lock; inspect the shutdown log and owned process before recovery.

Clause procedure (defaults coordinator, project coordinator):

- Use `session.launch` for roles. `cland session resume <name> --relaunch` keeps conversation, name, role and valid claim. Inspect failures before `cland session resume <name> --fresh` with its brief. Report occupied exclusive roles/lost claims; retake verifier holds.

Clause procedure (defaults coordinator, project coordinator):

- Prune: `session.prune` or `cland session prune --older-than 7d`; preview with `--dry-run`; the journal is retained.

## Coordinator heartbeat procedure

- On a heartbeat, read the digest. For owned work request missing reviews, merge ready items through the gate, ask idle sessions for state and retry unreported runs. Ask the human only for decisions, cap overruns or rows stale two heartbeats after repair. Otherwise end silently.
- Heartbeat: read the digest; for owned work request missing reviews, merge ready items through the gate, ask idle sessions for state and retry unreported runs. Ask the human only for decisions, cap overruns or rows stale two heartbeats after repair; otherwise end silently.

## Coordinator subscription procedure

- Default subscriptions: tree outside active leads; topmost Lead death/long idle. Extras: `subscribe`/`subscriptions`. Events digest; `ready` starts merging.

### Web verification phase

The Web phase is outside T0–T3 and runs after hub phases: machine resource, two
local workers, four droplet workers. Task verification includes it, even under
the T0–T2 cap; merge batches exclude it. Periodic dev and integrated/occasion
runs include it. Reduced hub/Neovim modes include the Web smoke. Close shards
carry Web with Neovim once. Tier commands infer Web only for candidates declaring
`supportsWebPhase` in the cland runner; pinned commands and result/cache identity
retain its coverage. Root check builds the browser bundle; hand-run package suites
check its source receipt and build once before workers if needed.

Shards containing `hub/test/web-auth.test.ts` also build before workers, even
without Web or an available browser. Standalone runs of that file use the same
helper. Delivery cleans ignored `web/dist`; matching prepared dependencies skip
`npm ci`, and a matching host gate skips the remote check. A warm image therefore
does not guarantee a bundle. Cold installs and the Web-owning shard can mask this.
Build failures name `npm run build --workspace web` as the prerequisite command.

`npm install` prepares the bundle and pinned Chrome Headless Shell in node_modules.
`npm run test:web:install -- --with-deps` repairs the shell and Linux libraries.
`npm run test:web` queues selected Web files; `node --test web/test/smoke.test.ts`
runs one browser file after a build. Fixtures use isolated Headless Shell profiles,
scratch HOME/XDG/Git and a `web.link` frame on a scratch `projectHub`. They retain
CSP, poll through page evaluation, close each context, save failure traces and
prove the browser process group and hub edges are gone before deleting roots.
The 4 s/test and 40 s/phase budgets follow duration report/enforce mode; a separate
60 s gross guard reaps hangs. Web gets no load-gate repetitions. See
[the Web phase](../docs/agents/tests.md#web-phase) and
[browser fixture usage](../web/README.md#browser-tests).

Missing browser executables or libraries produce "Web unavailable on this machine"
with the reason and `webPhase: {status: "not-run", reason}` in the durable job and
result receipt. Other phases continue. This supplies no passing Web receipt and
is ineligible for cache reuse. The candidate prerequisite module resolves the pinned Headless Shell and checks
Linux shared libraries without launching a browser. Prepared snapshots carry these
libraries; missing image libraries require the human or Coordinator to rebuild the
snapshot as described under [Controls and the prepared snapshot](#controls-and-the-prepared-snapshot).
A broken probe remains an error.


### Startup replies

Default `hub.status` is compact for every client. `suites` retains queued and
running receipts in full. `recentSuites` holds only the latest completed result
per `(kind, occasion)`, at most 20: `{id, kind, occasion, head, exit, finishedAt,
artifact}`. Kind is `task` or `integrated`; an absent occasion is `null`.
Completed summaries omit selection maps and output tails. Historical `covers`
and duplicated `harnesses` are absent. `history: true` (CLI: `cland hub status
--history [--json]`) restores full historical diagnostics. Neovim consumes only
presence, crew, verification, keys, tracker, coordinator and needsYou; the CLI's
root lookup also uses compact status. The web client has no history consumer.
The copied-state status target is 64 KiB.

Startup indexing validates each plan once after all item files are indexed;
unchanged child reads do not revalidate the entire parent plan. Restoring stopped
sessions writes only their affected queued suites, rather than rewriting retained
suite history. The daemon awaits that scan's durable migrations without scanning
the folder again, and one journal prefix supplies plan, Agents and subagent restore.
A single text scan selects those startup records before JSON decoding unrelated
retained history. Existing role policy skips installation discovery. Terminal
process recovery commits its checkpoints together and publishes observers after
that commit; retained suite history reuses its original serialized snapshots.
Inbox status considers latest addressed reports only in topics waiting for the
human; unread direct messages and pending requests remain current. Status reuses
the current inbox count until a section changes or a message crosses its seven-day
age boundary. Non-approval process metadata and journal event projections do not
invalidate that count; ordinary coalesced inbox publications still refresh details.
`hub-startup-step` records identify tracker, journal, store, suite and session
restore phases. To profile a disposable copy, use
`node hub/scripts/measure-startup.ts /absolute/project/.cland`; add `--cli` to
measure the real `cland hub start` through the first status socket reply against
the five-second target. The default run measures dispatcher composition separately
against a 50 ms target. See [copied-state measurement](../docs/agents/tests.md#startup-reply-byte-budgets-t-1038)
for isolation, timing boundaries and cover-quiet requirements.
The generated T3 fixture uses a 15-second first-status regression guard: three
times the local target for loaded shards, still below the former 39-second
production startup. Its reply byte limits remain exact; the copied-state CLI
measurement retains its five-second limit.

`topic.history` returns complete messages in byte-capped pages below 256 KiB,
including envelope space. `more`, `before` (exclusive message id) and `after`
(exclusive sequence) identify continuation. The page always contains at least
one available message, even if that message alone exceeds the cap; bodies are
never truncated. In Neovim, `A` in the thread reads older pages on demand,
including pages shorter than the requested row limit.

`artifact.list` returns at most 100 entries, newest first, byte-capped below
256 KiB with envelope space. When more remain, `{more:true,before:"A-n"}` names
an exclusive numeric-id cursor; pass `before` on the next request. A single
oversized entry remains whole. The one-id detail/folder read is unchanged.
`cland artifact list --before A-n [--topic topic] [--json]` and the spoke tool
accept the same cursor. Neovim reads one page on startup; opening the artifact
browser or palette reads the next page, and scrolling or selecting More artifacts
reads another. Page snapshots replay concurrent artifact events over received
rows, without automatically draining the archive at startup.
