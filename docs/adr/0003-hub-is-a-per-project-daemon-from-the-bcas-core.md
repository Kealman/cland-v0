# The hub is a per-project daemon extracted from the BCAS driver hub

cland's hub is a daemon per project, started by `cland` from the repo root, independent of the Neovim UI and outliving it; it owns the harness processes through adapters, and the UI only attaches to them. Its core is extracted from the BCAS driver hub (Node 24, TypeScript without a build step, `node:sqlite`, `ws`): the per-session MCP spoke with one WebSocket to the hub, the versioned hello / welcome / deliver / result protocol, store-and-forward, hygiene, and the test harness that drives a real spoke and a real hub. The Neovim UI talks to the hub over a Unix socket carrying the same frames as JSON lines, because Neovim's Lua has no WebSocket client. Two stacks, a TypeScript hub and a Lua UI, are accepted.

## Considered options

- **The hub inside the Neovim process**: rejected. It would die with the UI, and Lua has neither WebSocket nor SQLite.
- **One stack**, by rewriting the hub in Lua or both halves in Rust or Go: rejected for v0. The BCAS core works and is tested; a rewrite buys nothing yet.
- **A sidecar process** bridging Neovim to WebSocket: rejected. One more process and one more protocol, for no gain over a Unix socket the hub serves itself.

The same JSON-lines frames also run over the stdio of a child process: for QA runs inside the Codex sandbox, where Unix sockets are blocked, the UI spawns the hub (or a stub of it) as a child and talks to it over stdin and stdout.

## Consequences

- Sessions survive a UI restart only because adapters own the harness processes and the UI merely attaches; the adapter contract must provide attach for every harness.
- The hub binds 127.0.0.1 and a Unix socket only, with a per-project secret file that is never committed.

## Amendment, 2026-10-09: launched Codex sessions are no longer where sockets are blocked

The statement above that QA runs "inside the Codex sandbox, where Unix sockets are blocked" is superseded for sessions the hub launches. The human decided on 2026-10-09 (item T-48) that a Codex session launched by cland runs with `approvalPolicy` `never` inside a sandbox chosen for its role in `.cland/roles.toml`. For the Implementer and QA that sandbox allows Unix sockets under the project's `.cland/`, the session's directory and the temp dir, and loopback, with the rest of the network closed; the Implementer's also allows writes to the main worktree and the project's git directories. `docs/review-and-qa.md` ("The Codex sandbox") says what each role's sandbox allows and how it was measured.

The stdio transport stays, and so does its reason, for the places where sockets are still blocked: a rescue run (`/codex:rescue`), which the hub does not launch and which runs in Codex's own default sandbox, and any role whose `network` is `none`, such as the Reviewer.


## Amendment, 2026-10-20: an independent web edge (v0.2 §3.7, T-978)

The hub process also owns a separate loopback HTTP listener for the web bundle.
Its stable port is recorded as `hub.json.webPort`, independently of the spokes'
WebSocket `port`. `[web] port` overrides the automatically kept port; `[web] dist`
selects a development bundle. A taken web port starts the hub without that edge,
with the reason in the log, `hub.status.web` and `cland doctor`; it never changes
the browser's origin to another port: the origin carries browser storage and
notification permission. The spoke and Unix-socket edges keep their
existing admission rules. This amendment permits the separate loopback edge;
network binding remains subsequent work under E-412.

T-980 adds browser authentication on this listener: a human-only `web.link`
request over the Unix socket mints a one-time link, `/auth` trades it for the
per-project `cland_<key>` HttpOnly, SameSite=Strict cookie, and `/ws` checks
Host, exact Origin and cookie before accepting a secret-free client hello as
the human. `<key>` is the first 12 hex digits of SHA-256 of the canonical
project root; cookies are not isolated by port. Links and cookie sessions are
held as digests in memory here; T-982 adds session persistence. The hub secret
never crosses the browser edge.
