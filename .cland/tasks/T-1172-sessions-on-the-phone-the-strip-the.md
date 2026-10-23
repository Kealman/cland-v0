---
id: T-1172
kind: task
title: "Sessions on the phone: the strip, the queue sheet and the page"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-419
blocked_by:
  - T-1165
  - T-1166
topic: null
branch: null
created: 2026-10-23T07:00:04.138Z
updated: 2026-10-23T19:06:53.266Z
---

## Summary

At phone width the Sessions screen shows its counts, the accounts strip of cells, the verify line opening the queue view as a full-height sheet, and the two-line rows of T-1137 whose tap opens the session's page full screen.

## Parent

E-419 (§3.6 the sessions, P27 to P30; tracer step 4). Reuses T-1136's page and confirmations and T-1137's rows.

## What to build

- **The header** names Sessions with the waiting, busy, idle and yours counts.
- **The accounts strip** is one row of cells in the registry's order (name, the worst window with its share, a thin meter; red with the reset when limited; a dash without data); a tap on a cell opens Accounts read-only.
- **The verify line** keeps its one-line summary with a chevron; a tap opens the queue view as a full-height sheet with a close control, instead of in place.
- **Rows** are T-1137's two-line rows with no row or swipe actions; groups fold as on the desktop.
- **The session's page** opens full screen on a tap with a back control (the browser's back too, returning to the same row): the model, the account, the usage, the command a waiting session waits on, and Stop, Resume, Archive and Capabilities at least 44 px tall, Stop and Archive confirmed in place as T-1136 does.

## Acceptance criteria

- [ ] C1. At 390x844 the Sessions screen shows the header counts, one accounts cell per account and the two-line rows, and no row offers an action (Web test).
- [ ] C2. A tap on the verify line opens the queue view as a full-height sheet whose close returns to the list (Web test).
- [ ] C3. A tap on a waiting fake session opens its page full screen with the command it waits on, and the browser's back returns to the same row (Web test).
- [ ] C4. On the page, Stop on a busy fake session asks for a confirmation and stops it after Confirm, as `cland session list` reads, with each action at least 44 px tall (Web test).
- [ ] C5. A tap on an account cell opens Accounts read-only (Web test).
