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
