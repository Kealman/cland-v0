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
updated: 2026-10-14T13:49:02.060Z
---

## Destination

Spec v0.2 (`docs/spec/v0.2.md`) complete and the v0.2 epics published under the release item R-377: the web workbench with everything the Neovim workbench shows and does, in the browser, the hub as the single source, Neovim kept as the console alternative.

## Notes

Charted on 2026-10-14 in the cland-design session from the human's direction of the same day, after two grilling rounds; what they settled is recorded in `docs/spec/v0.2.md` §3.1 to §3.8 (two clients of one protocol, the shell with a rail, a main area and a drawer, snapshot and deltas, threads and actions, editing parity with Neovim, notifications and the phone, serving and security, the scope of 0.2.0 without a terminal). This map stands on its own because a map cannot sit under a release. Skills: research, prototype (web mockups as a Design artifact on the human's current account with sources in docs/design/web/, then a clickable React prototype), grilling. Standing preferences: every artifact in English; sub-agents never use the hub; research on research/<name> branches and prototypes on prototype/<name>, never merged; recorders apply resolutions one at a time; the build of 0.2.0 starts after the v0.1.2 workbench lane.

## Decisions so far

- The hub's client surface for a browser: what the Neovim plugin consumes, what a browser needs on top (Q-400, .cland/tasks/Q-400-the-hub-s-client-surface-for-a-browser.md): the frame protocol carries over as it is (37 requests, 21 pushed frames, one dispatcher), several human clients already work, but a browser cannot connect today (the spokes' port is loopback-only, bearer-only and refuses client hellos), there are no sequence numbers and Neovim re-reads everything after a drop; the missing pieces cost about nine sessions plus three for hub-computed fields and read marks; the browser's entry is a one-time token and a cookie, never the secret; approving a command has no frame; HTTPS is needed off localhost. docs/research/web-client-surface.md on research/web-client-surface.
- Prior art: web interfaces for agent orchestration, threads with approvals, keyboard-first planning (Q-401, .cland/tasks/Q-401-prior-art-web-interfaces-for-agent.md): every multi-agent screen puts needs-you first with what each row waits on and for how long; approvals are fast when collected in one place and answered with keys, slow when answerable only inside a thread; timers that decide for the human cause trouble; reconnection is where products lose approvals, the designs that work are a snapshot plus numbered updates; on phones the needs-you list is home and nobody plans there; copy and avoid lists per §3.2, §3.4, §3.6 and three questions for Q-408 (asks as both inbox row and thread card with one state in the hub, folded runs in place or in the drawer, the composer's send key and queue). Correction: OpenCode v2 kept its web UI behind `opencode pair` (a one-time link, a 30-day cookie). docs/research/web-prior-art.md on research/web-prior-art.

## Not yet specified

- Direct edits in the web (drag to rank, move between epics): 0.2.x, after living with the web.
- A harness terminal in the browser: a later theme; the protocol extension must not preclude it (research now).
- Several projects in one browser (a home page over known hubs): later; 0.2.0 is per project.
- The Accounts area's content beyond v0.1.2 §3.13 (limits per account) and the Artifacts area beyond v0.1 §3.6.
- Sharing a read-only view with someone else (a reviewer, a client): out of the human's own session model; later.

## Out of scope

- The Neovim workbench's own evolution: it stays the alternative and takes the protocol extension when it needs it; nothing in this map changes its views.
- Cloud hosting or an account service for cland: the hub serves the web on the human's machine or network only.
