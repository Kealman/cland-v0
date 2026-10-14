---
id: M-399
kind: map
title: "The web workbench: from the settled shape to spec v0.2, mockups, a prototype and the epics"
state: open
labels:
  - wayfinder:map
assignee: null
parent: null
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:48.458Z
updated: 2026-10-14T15:23:52.568Z
---

## Destination

Spec v0.2 (`docs/spec/v0.2.md`) complete and the v0.2 epics published under the release item R-377: the web workbench with everything the Neovim workbench shows and does, in the browser, the hub as the single source, Neovim kept as the console alternative.

## Notes

Charted on 2026-10-14 in the cland-design session from the human's direction of the same day, after two grilling rounds; what they settled is recorded in `docs/spec/v0.2.md` §3.1 to §3.8 (two clients of one protocol, the shell with a rail, a main area and a drawer, snapshot and deltas, threads and actions, editing parity with Neovim, notifications and the phone, serving and security, the scope of 0.2.0 without a terminal). This map stands on its own because a map cannot sit under a release. Skills: research, prototype (web mockups as a Design artifact on the human's current account with sources in docs/design/web/, then a clickable React prototype), grilling. Standing preferences: every artifact in English; sub-agents never use the hub; research on research/<name> branches and prototypes on prototype/<name>, never merged; recorders apply resolutions one at a time; the build of 0.2.0 starts after the v0.1.2 workbench lane.

## Decisions so far

- The hub's client surface for a browser: what the Neovim plugin consumes, what a browser needs on top (Q-400, .cland/tasks/Q-400-the-hub-s-client-surface-for-a-browser.md): the frame protocol carries over as it is (37 requests, 21 pushed frames, one dispatcher), several human clients already work, but a browser cannot connect today (the spokes' port is loopback-only, bearer-only and refuses client hellos), there are no sequence numbers and Neovim re-reads everything after a drop; the missing pieces cost about nine sessions plus three for hub-computed fields and read marks; the browser's entry is a one-time token and a cookie, never the secret; approving a command has no frame; HTTPS is needed off localhost. docs/research/web-client-surface.md on research/web-client-surface.
- Prior art: web interfaces for agent orchestration, threads with approvals, keyboard-first planning (Q-401, .cland/tasks/Q-401-prior-art-web-interfaces-for-agent.md): every multi-agent screen puts needs-you first with what each row waits on and for how long; approvals are fast when collected in one place and answered with keys, slow when answerable only inside a thread; timers that decide for the human cause trouble; reconnection is where products lose approvals, the designs that work are a snapshot plus numbered updates; on phones the needs-you list is home and nobody plans there; copy and avoid lists per §3.2, §3.4, §3.6 and three questions for Q-408 (asks as both inbox row and thread card with one state in the hub, folded runs in place or in the drawer, the composer's send key and queue). Correction: OpenCode v2 kept its web UI behind `opencode pair` (a one-time link, a 30-day cookie). docs/research/web-prior-art.md on research/web-prior-art.
- A harness terminal in the browser, later: what the harnesses allow and what the protocol must not preclude (Q-403, .cland/tasks/Q-403-a-harness-terminal-in-the-browser-later.md): every harness has an attach command, so a browser terminal is that command in a hub-owned PTY relayed to xterm.js (Claude Code shares one screen among attachments and repaints, Codex starts a TUI client per attach, OpenCode's TUI is a client of its server); node-pty would be the hub's first native dependency; eight protocol reservations recorded in spec §3.3; recommended after 0.2.0, Claude Code first; no adapter relays approvals today, which Q-407 and Q-408 must face. docs/research/web-terminal.md on research/web-terminal (524b88f, head 6265eed).
- Stack and seams: React with Vite in the workspace, serving from the hub, Playwright against the hub with fake harnesses (Q-402, .cland/tasks/Q-402-stack-and-seams-react-with-vite-in-the.md): React 19 with Vite, TypeScript strict, CSS Modules on the tokens, no UI library; the wire types in a hub-free module; the web edge on ws inside the hub, a one-time token for a per-port cookie; the web phase as its own shard on node:test with playwright-core, measured at 2.6 s fixed plus tenths per test; PWA cheap, phone notifications need HTTPS; side finding: TypeScript 7 typechecks the hub in 1.6 s against 18 to 26 s now. docs/research/web-stack.md on research/web-stack.
- The web canvas: a Design artifact with the shell, the explorer and card, a thread, the inbox and the sessions (Q-404, .cland/tasks/Q-404-the-web-canvas-a-design-artifact-with.md): five boards on https://claude.ai/artifact/Cqc3KRR8tXG1yd395B6vf6 accepted with proposals P1 to P25 and four canvas reactions (topics groups, folds remembered, no explanatory prose, Board, Graph and Plan as views of Items); spec §3.2, §3.4, §3.6; sources in docs/design/web/.
- The protocol extension: the WebSocket entry, several human clients, snapshot and deltas, history pages (Q-407, .cland/tasks/Q-407-the-protocol-extension-the-websocket.md): the edge in the hub on ws with a one-time link and a per-port cookie, Host and Origin checks, client hellos only; the cookie's authority minus hub stop and restart, release and artifacts from arbitrary paths; snapshot with epoch and sequence, numbered deltas, resume or a fresh snapshot, history pages; hub-computed fields and read marks per human; approvals relayed where the harness allows, Claude Code's in the TUI; spec §3.3, §3.7, §3.8.
- Threads, approvals and the composer in the web: the final shape (Q-408, .cland/tasks/Q-408-threads-approvals-and-the-composer-in.md): one ask record shown in the inbox and the thread with the same keys, decline never on Escape; folded runs open in place with a hub-built fold line; Enter sends a line, ⌘Enter always, queued messages with Withdraw, drafts survive; notifications for now items only, never while looking; spec §3.4, §3.6.
- Phone-width mockups: the inbox, the sessions, a thread, answering an ask (Q-406, .cland/tasks/Q-406-phone-width-mockups-the-inbox-the-sessions.md): four boards accepted with proposals P26 to P42 (More in the bottom bar, two-line session rows, the accounts strip, the queue sheet, the touch composer, the ask sheet with Decline on the label row, the disconnected strip); decided: declining is an answer with a reason, answered asks stay folded until the human leaves the inbox, plan approval on the desktop only, TUI-bound approvals marked, sign-in by QR with a 30-day cookie, notification switches in More and Accounts; spec §3.4, §3.6, §3.7.
- A clickable React prototype of the shell against the live hub, read-only (Q-405, .cland/tasks/Q-405-a-clickable-react-prototype-of-the-shell.md): built on prototype/web-shell with a read-only bridge, accepted by the human; first paint 250 ms, the full tree in two seconds for want of a snapshot, 2.5 ms frame to screen; the measurements shaped the snapshot in spec §3.3.

## Not yet specified

- Direct edits in the web (drag to rank, move between epics): 0.2.x, after living with the web.
- A harness terminal in the browser: a later theme; the protocol extension must not preclude it (research now).
- Several projects in one browser (a home page over known hubs): later; 0.2.0 is per project.
- The Accounts area's content beyond v0.1.2 §3.13 (limits per account) and the Artifacts area beyond v0.1 §3.6.
- Sharing a read-only view with someone else (a reviewer, a client): out of the human's own session model; later.

## Out of scope

- The Neovim workbench's own evolution: it stays the alternative and takes the protocol extension when it needs it; nothing in this map changes its views.
- Cloud hosting or an account service for cland: the hub serves the web on the human's machine or network only.
