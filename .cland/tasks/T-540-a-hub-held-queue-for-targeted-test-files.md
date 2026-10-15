---
id: T-540
kind: task
title: A hub-held queue for targeted test files on the Mac, so implementers stop polling for the slot
state: open
status: backlog
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
updated: 2026-10-15T21:21:08.611Z
---

## Summary
On the night of 2026-10-15, about ten implementers shared the Mac's one or two targeted-file slots under a load rule the Coordinator posted in Agents. Each session polled `verify queue`, the load and the process list once a minute. T-427, T-513 and T-531 each waited 5–15 minutes, and the Coordinator granted slots by hand. A hub-held admission for targeted runs would replace that: `cland test <file>`, or `cland verify --file`, waits in a FIFO, honours the load threshold and `local: coord`, and runs the file. That would remove the starvation and the per-minute polling.

## Acceptance criteria
- [ ] C1. A targeted run requested through the hub waits in FIFO order for a slot, and the slot count and load threshold come from config.
- [ ] C2. No targeted run is admitted while a Coordinator integrated run holds the local slot, and `cland verify queue` lists the targeted waiters.
