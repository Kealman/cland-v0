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
project root; cookies are not isolated by port. Links stay in memory as digests. T-982 persists cookie-session digests with ids,
creation and last-use times in `hub.db`; they survive restarts and expire 30 days
after creation. Human-only Unix-socket `web.sessions` and `web.revoke` list them
and revoke one with its sockets closed before returning. The hub secret
never crosses the browser edge.


## Amendment, 2026-10-21: configurable web network binding (T-988)

`[web] bind` defaults to `127.0.0.1` and may name an IPv4 or IPv6 network address,
including a wildcard. Only the independent web HTTP listener uses it; the spokes'
WebSocket listener stays on `127.0.0.1`, and the Unix socket stays local. Host and
exact Origin checks continue on the web edge, with the concrete bound address
(or local interface addresses for a wildcard) added to the Host allow-list.

`[web] origin` names the human's HTTPS tunnel origin and adds its Host and exact
Origin to admission. A cookie issued with both Host and Origin matching it carries
`Secure`, even though the last hop is HTTP. Forwarded headers are never trusted.
The tunnel preserves these request headers; a top-level GET without Origin does
not meet the Secure condition. `cland web --qr` uses the tunnel first, otherwise
the LAN address, and refuses loopback alone. `cland doctor` warns for a network
bind without a tunnel because plain HTTP exposes cookies and lacks phone
notifications/install support. This supersedes the loopback-only web restriction;
the spokes' admission and binding remain as decided above.


## Amendment, 2026-10-26: the outbound-only gateway edge (v0.3 §3.1, T-1327)

For v0.3, we choose the [Gateway](../../GLOSSARY.md#hub) as an edge of the one
frame protocol inside the hub process, as decided in
[spec §3.1](../spec/v0.3.md#31-the-gateway-edge-and-its-authority). It starts and
stops with the hub and holds one conversation with the dispatcher, receiving
client frames and sending client requests as the identity `human`, never as a
session or a role ([ADR 0001](0001-roles-are-hub-held-state.md)). Its connections
are outbound-only: Telegram long polling and Discord's gateway WebSocket and
HTTPS. This adds no new protocol, socket or listener, and no hub secret; it needs no
webhook, tunnel or public address. Reusing the dispatcher keeps remote control
inside the hub's existing frame boundary without another sidecar or transport.

The gateway has its own deny-by-default authority table, checked before dispatch,
following the web edge's pattern in
[`web-authority.ts`](../../hub/src/hub/web-authority.ts) with narrower authority:
`topic.send` into General or as a reply into the replied-to message's topic,
`topic.answer`, `approval.answer`, and only the reads `hub.status`, `task.list`
and `inbox.list`. Session launch or stop, release, push, sync, configuration,
artifact actions and pairing approval remain outside a remote's authority.
Media uploads are the hub's own act, attributed to the human, and count as a send.

The glossary names the paired messenger chat a
[Remote](../../GLOSSARY.md#remotes) and its durable outbound queue an
[Outbox](../../GLOSSARY.md#remotes). This amendment records the v0.3 design
decision; it is not a claim that the gateway implementation has shipped.
