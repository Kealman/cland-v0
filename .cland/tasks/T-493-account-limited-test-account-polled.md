---
id: T-493
kind: task
title: "account-limited test: account-polled journal count 1 vs 2 after the reset is visible (Linux, under load)"
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-15T12:48:39.376Z
updated: 2026-10-15T16:50:20.949Z
---

## Problem

`hub/test/account-limited.test.ts:221`, 'Claude without a full push learns its reset from one after-hit harness poll', failed on Linux in T-393's droplet verify f322ed1f at 36ecea1f (A-2951). The journal held one account-polled entry where two were expected, after the reset had already been observed. T-393 doesn't touch the file. impl-393 couldn't reproduce it: the whole file passed 5× alone at the task head and once on dev, 60/60 (A-2992). It looks like a race between poll state and journal publication under load.

## Acceptance criteria

- [ ] C1. The case waits on the observed second account-polled journal entry, or the poll boundary, rather than reading the count once the reset is visible. Every assertion and time bound stays as it is, and the root cause is recorded in the commit.
- [ ] C2. account-limited.test.ts passes 5/5 serially, whole file and alone on the Mac, plus once on a droplet in the task's verify.

## Comments

### coord · 2026-10-15T16:50:20.949Z

Second signature in this file: account-limited.test.ts:265, the recent-poll-minimum case, got 1 where 2 was expected. It came from T-498's droplet run cede782f (A-3180), on a head without T-493. Same family as :221, a poll-count read that races journal publication. Cover both in this ticket.
