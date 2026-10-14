---
id: Q-400
kind: question
title: "The hub's client surface for a browser: what the Neovim plugin consumes, what a browser needs on top"
state: closed
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:48.943Z
updated: 2026-10-14T13:35:24.309Z
closed: 2026-10-14T13:35:24.309Z
---

## Question

What does the hub expose to a client today and what does a browser need on top? Read what the Neovim plugin consumes (every frame type and request it sends and reads, the connection and reconnection path, how it re-reads after a drop, what it renders from which fields), the hub's spoke and human-client handling (how many human clients it allows, what the TCP port in hub.json serves, the REPLACED close code), and list, with the protocol names: what a browser can use as is over a WebSocket carrying the same frames; what is missing (a snapshot on connect, deltas with sequence numbers for catch-up, pages of thread and event history, static serving, a token exchange for the hub's secret, several human clients); and the cost of each. Deliver docs/research/web-client-surface.md on research/web-client-surface with a table of frames against the web areas of spec v0.2 §3.2, and the resolution comment here.

## Comments

### human · 2026-10-14T13:35:15.259Z

## Resolution

Research done: `docs/research/web-client-surface.md` on `research/web-client-surface` (948a8134), with two probes under `docs/research/web-client-surface/`. `frames-inventory.mjs` reads the source. `log-rates.mjs` prints counts only from the project's process log, over 2026-10-12T00:00Z to 2026-10-14T13:00Z (61 h). The code was read at `dev` 69519893. No hub was touched.

### The frames Neovim consumes

- **Requests: 37 types.** On every `welcome` the workbench sends `subscribe`, then reads 8 lists: `topic.list`, `session.list`, `hub.status`, `role.list`, `inbox.list`, `task.list`, `account.list`, `artifact.list`. It also reads the events line (`events.list`), the Agents log and every thread view's `topic.history` (≤200). On demand it sends `task.view` per card (1,780 in 61 h, the busiest), `task.plan` (564) and the human's actions: `topic.send/answer/read/create/close/resolve`, `inbox.decline/read`, `task.criterion/rank`, `session.launch/stop/resume/archive/attach`, `visibility.set`, `artifact.*`, `prompt.send`, `account.poll`.
- **Pushed frames: all 21 `HubEvent` types are read.** `message`, `delivery`, `topic`, `ask`, `inbox`, `session.state/role/process/usage/cleanup`, `sessions.pruned`, `presence`, `account`, `role.vacant/filled`, `crew`, `verification.queue`, `task`, `artifact`, `event`, `visibility`. Their records ran at about 609 per hour, 1,764 at peak, so roughly 10 frames a minute. Each `task` frame carries the layer of every item (410 here).
- **The hub accepts 78 client request types**, and the workbench never sends 41 of them, the CLI's surface. A browser connected as the human could send all of them.

### The connection model

- **The TCP port in `hub.json` is the spokes' WebSocket.** It binds 127.0.0.1 on a new free port at each start. Plain HTTP gets 404, and an upgrade needs `Authorization: Bearer <secret>`. A client hello is refused there, because every session holds the secret.
- **The Unix socket (0600) serves the human's clients** (`nvim`, `cli`, `mod-bridge`), with the secret in the hello. Stdio serves a spawned child.
- **A human client is whoever holds the socket and the secret.** It is audited as `human` unless `as` names a known session.
- **There is no limit on human clients.** The CLI opened 16,462 connections next to the workbench's 24. REPLACED 4002 is a spoke code retired with T-51 that the hub never sends. Today's close codes are 4000 (hello refused) and 4001 (spokes kicked).
- **Only spokes beat** (ping every 30 s). The WebSocket edge cuts sockets silent for 60 s, the Unix socket has no heartbeat, and a client has no `ping`.
- **Reconnection** retries from 250 ms, doubling to 5 s, then does a full re-read. Each read keeps a client-side journal of the frames that arrive meanwhile. There are no sequence numbers and no replay.
- **Ordering:** one ordered stream per connection, and a request's synchronous publications go before its result. Results that wait for I/O come later. `inbox` and `presence` go out once per tick when changed. Journal rows coalesce within 60 s (`replaces`). At-least-once delivery exists only for spokes (`deliver` + `ack`).

### What is missing, and its cost in sessions

| | Piece | Neovim benefits | Size |
| --- | --- | --- | --- |
| W1 | Web edge: a stable-port listener with `ws` (already a dependency; Node 24 has no WebSocket server), client hellos admitted on it without the secret, spoke hellos refused, server pings | no | 1 |
| W2 + W8 | `cland web` one-time token → cookie (hashed in `hub.db`, revocable); Origin and Host checks; no CORS | no | 1.5 |
| W3 | Several clients made cheap: project and serialize once per frame, drop the all-items `layers`, audit label | no | 0.5 |
| W4 | Snapshot on connect, composed in one tick and stamped with seq | optional | 1.5 |
| W5 | Deltas: one emit path (`task` frames included), `seq` + `epoch`, a bounded ring, `resume` → replay or `resync` | yes | 2 |
| W6 | History pages: `seq` on messages (stored, not sent), `topic.history {after}`, `artifact.list` paged | small | 0.75 |
| W7 | Static serving of `web/dist` | no | 0.5 |
| W9 | Artifact files over HTTP, HTML sandboxed, capability URLs for folders, a draft write | no | 1.25 |
| W10 | Fields both clients need, computed once (summary rule, roll-ups, unread per message, sessions projection, blocked flag) | yes | 2 |
| W11 | Read marks in the hub (events' last look, plan seen) | yes | 0.75 |
| W12 | Approving a command from the browser: no frame, approvals belong to the attached TUI | no | research first |

The extension proper (W1–W9) is about 9 sessions; W10 and W11 add about 3.

### Risks and open questions for Q-407

1. **The entry is a token, not the secret** (spec §3.1 says "the hub's secret as the entry"). Every session holds the secret.
2. **The web needs a stable port and one canonical origin.** Cookies are not port-isolated (RFC 6265 §8.5), so name the cookie per project. `localhost` and `127.0.0.1` are different origins.
3. **A second listener for `[web] bind`** keeps the spokes on loopback. ADR 0003 needs an amendment.
4. **Cross-site WebSocket hijacking and DNS rebinding:** check Origin and Host (RFC 6455 §10.2). SameSite ignores ports.
5. **A web cookie holds the human's full authority,** including `hub.stop`, `release`, `session.launch` in any directory and `artifact.create` from any readable path. Decide whether the web edge gets an allowlist.
6. **An HTTP LAN origin is not a secure context.** It gets no service worker and no notifications, which affects spec §3.6. Decide whether HTTPS is in 0.2.0.
7. **20 hub restarts in 61 h:** an in-memory catch-up ring only covers client-side drops.
8. **Two emitters and mixed frame kinds:** decide which frames replace whole state and which append.
9. **Snapshot weight:** every artifact (2,382 entries) and closed topics are returned whole today.
10. **`visibility` invalidates everything,** and every client re-reads.
11. **Layers age with the clock.**
12. **`ui.json` holds human read state** (last look, plan seen), so clients would disagree on what was seen.
13. **Spec §3.8's "approving a command"** has no frame.
14. **Browser liveness:** use server pings.
15. **One event loop for N clients:** serialize once and cache the snapshot.
16. **Vocabulary:** "the Neovim spoke" in the spec; `HubEvent` versus the glossary's Event.
17. **The PTY later** gets its own route, not the frame socket.

### human · 2026-10-14T13:35:24.309Z

Resolved: see the resolution comment; docs/research/web-client-surface.md on research/web-client-surface
