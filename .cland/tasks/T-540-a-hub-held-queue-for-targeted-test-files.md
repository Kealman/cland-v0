---
id: T-540
kind: task
title: A hub-held queue for targeted test files on the Mac, so implementers stop polling for the slot
state: closed
status: done
size: M
labels:
  - hub
  - idea
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-10-15T21:21:08.611Z
updated: 2026-10-31T14:43:42.363Z
closed: 2026-10-31T14:43:42.363Z
---

## Summary
On the night of 2026-10-15, about ten implementers shared the Mac's one or two targeted-file slots under a load rule the Coordinator posted in Agents. Each session polled `verify queue`, the load and the process list once a minute. T-427, T-513 and T-531 each waited 5–15 minutes, and the Coordinator granted slots by hand. A hub-held admission for targeted runs would replace that: `cland test <file>`, or `cland verify --file`, waits in a FIFO, honours the load threshold and `local: coord`, and runs the file. That would remove the starvation and the per-minute polling.

## Acceptance criteria
- [ ] C1. A targeted run requested through the hub waits in FIFO order for a slot, and the slot count and load threshold come from config.
- [ ] C2. No targeted run is admitted while a Coordinator integrated run holds the local slot, and `cland verify queue` lists the targeted waiters.

## Comments

### coord · 2026-10-31T14:43:42.363Z

Closed as superseded: in 0.4 (map M-1511) agent sessions run targeted tests on their own hosts, so a hub-held Mac queue for targeted files no longer pays off. The human chose this scope on 2026-10-31 at 14:42Z (ask f9666976).
