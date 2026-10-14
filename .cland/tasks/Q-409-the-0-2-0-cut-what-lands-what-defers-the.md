---
id: Q-409
kind: question
title: "The 0.2.0 cut: what lands, what defers, the epics"
state: closed
labels:
  - wayfinder:grilling
assignee: cland-design
parent: M-399
blocked_by:
  - Q-405
  - Q-406
  - Q-407
  - Q-408
  - Q-403
topic: null
branch: null
created: 2026-10-14T13:03:52.408Z
updated: 2026-10-14T16:01:23.593Z
closed: 2026-10-14T16:01:23.593Z
---

## Question

The cut of 0.2.0 after the prototypes: what lands in 0.2.0 and what defers to 0.2.x; the epics in order with their edges and lanes (hub protocol, web client, design); the crew for a web build; the definition of done (demos, the release from R-377, the retrospective); the spec's section 4 and status complete; the map closes.

## Comments

### human · 2026-10-14T16:01:16.004Z

## Resolution

The cut of 0.2.0, decided by the human on 2026-10-14.

- **Scope.** Everything in spec section 3 lands in v0.2.0: the shell with its seven areas; Items with the tree, the card and the Board, Graph and Plan views; Topics with threads, asks, approvals and the composer; Inbox; Events; Sessions; Artifacts; Accounts; the protocol extension (the web edge, the token and the cookie, the snapshot and the deltas, history pages, the hub-computed fields and the read marks per human, the approvals relay for Codex and OpenCode); notifications with the page open, the phone layouts, the PWA manifest and the QR sign-in; the web phase of the suite. About 50 sessions on the v0 scale.
- **Deferred to 0.2.x.** A harness terminal in the browser; direct edits with the mouse (drag to rank, move between epics); a home page over several projects; push notifications with the page closed; Neovim adopting the snapshot and the deltas; a read-only view for another person.
- **The epics**, nine children of R-377, each labelled `epic`, `v0.2` and `ready-for-agent`:

| Key | Id | Title | Blocked by |
| --- | --- | --- | --- |
| E01 | E-412 | The web edge and the protocol extension | none |
| E02 | E-413 | Hub-computed fields and read marks | E-412 |
| E03 | E-414 | The approvals relay | E-413 |
| E04 | E-415 | The web workspace and the shell | none |
| E05 | E-416 | Items in the web | E-412, E-415 |
| E06 | E-417 | Topics, threads and the inbox | E-413, E-416 |
| E07 | E-418 | Sessions, artifacts and accounts in the web | E-416 |
| E08 | E-419 | The phone and notifications | E-417 |
| E09 | E-420 | Release v0.2.0 from the item | E-414, E-418, E-419 |

- **Order.** Two lanes run in parallel. The hub lane is E-412, then E-413, then E-414. The web lane is E-415, then E-416, which also waits for E-412; then E-417, which also waits for E-413, and E-418 beside it; then E-419 after E-417. E-420 waits for E-414, E-418 and E-419. E-415 starts on the prototype's bridge and moves to the hub's edge when E-412 lands. The blocking edges are on the items.
- **When and who.** The build starts after v0.1.3 ships, led by the cland-impl session as v0.1.2 was; the human's questions wait in the inbox.
- **Crew.** As in v0.1.2: Implementers on Codex gpt-6.1-sol, Claude Code roles on claude-sonnet-5-5, the Reviewer pool at 2. `[plan] approval = "none"` project-wide, except E-415, whose plan the human approves by hand because it sets the patterns of the web lane; the Coordinator launches nothing under it until then.
- **Dogfooding.** Each epic is used as it lands: the edge and the snapshot serve the prototype's shell first; the human steers the rest of the build from the browser once Topics and the inbox land; the phone layouts are tried on the human's phone through their tunnel.
- **Definition of done.** Each epic's demo run by QA on `dev` with a clear verdict, the web phase included in headless Chromium; v0.2.0 released with `cland release --item R-377`; a retrospective artifact; no separate human acceptance pass.

Recorded in docs/spec/v0.2.md §4.

### human · 2026-10-14T16:01:23.593Z

Resolved: see the resolution comment; spec v0.2 §4; epics published
