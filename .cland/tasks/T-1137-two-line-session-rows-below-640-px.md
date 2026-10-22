---
id: T-1137
kind: task
title: Two-line session rows below 640 px
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1136
topic: null
branch: null
created: 2026-10-22T15:16:15.881Z
updated: 2026-10-22T15:16:15.881Z
---

## Summary

Below 640 px the Sessions area draws the two-line rows of P27 with no row actions, and a tap or Enter opens the session's page.

## Parent

E-418 (§3.6 the two-line row, P27 and P30; tracer step 3). E-419 places these rows and the page on the phone.

## What to build

Below 640 px each row is two lines: the glyph, the name and the role in its colour, with the state and its age at the right; then the harness and the item (the claim, a verifier's hold with its role and +N, or a requested item dimmed); a waiting row adds the command it waits on. The model, the account and the usage move to the session's page. The list has no row actions and does not unfold; a tap or Enter opens the session's page in the pane, with Stop, Resume, Archive and Capabilities and their confirmations, and Esc returns to the list at the same row. The header, the groups, their counts and their folds stay.

## Acceptance criteria

- [ ] C1. At 600 px wide each session row is two lines with the facts of P27, a waiting row adds its command, and no row offers an action (Web test).
- [ ] C2. A tap on a row at 600 px opens the session's page, Stop there asks for the confirmation, and Esc returns to the list at the same row (Web test).
- [ ] C3. At 1440 px the same sessions draw as the rows of P22 (Web test).
- [ ] C4. `web/README.md` describes the narrow rows and the page's entry (docs).
