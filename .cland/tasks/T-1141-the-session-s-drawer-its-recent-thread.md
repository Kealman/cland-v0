---
id: T-1141
kind: task
title: "The session's drawer: its recent thread, pending approval and a composer"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1131
  - T-1136
  - T-1119
  - T-1124
  - T-1129
  - T-1110
topic: null
branch: null
created: 2026-10-22T15:16:16.460Z
updated: 2026-10-22T15:16:16.460Z
---

## Summary

Selecting a session opens the drawer with its recent thread, its pending approval as a card and a composer to the session, built on E-417's thread, approval card and composer.

## Parent

E-418 (§3.2 the drawer, P23; tracer step 4). Ordered after E-417's thread, composer and approval card and E-414's approval gate, which it reuses.

## What to build

- **The thread.** The drawer follows the selected session: its recent messages, sent and received across topics (the hub slice's request), drawn with E-417's message blocks and paged back by message number, updating live.
- **The pending approval**, when there is one, as E-417's approval card answered through E-414's gate (Approve once, Always for this command, Deny with a note); an approval the harness keeps in its TUI shows marked, as E-417 draws it.
- **The composer** is E-417's, addressed to the session in its item's topic when it has one, else in General, with the line "To <session> in <topic>".
- **Open thread.** Enter on a row at desktop width, or Open thread in the unfolded row, moves focus to the drawer's thread.

## Acceptance criteria

- [ ] C1. Selecting a fake Codex session waiting for approval shows its command in the drawer's card, and Approve once folds the card with its outcome and the session leaves Waiting (Web test with the fake harness).
- [ ] C2. The drawer lists the session's recent messages in both directions across topics and pages back without a gap (Web test).
- [ ] C3. A message from the drawer's composer reaches the fake session in its item's topic, or in General without one, as the fake receives it (Web test with the fake harness).
- [ ] C4. Enter on a desktop row and Open thread move focus to the drawer's thread (Web test).
- [ ] C5. `web/README.md` describes the session's drawer (docs).
