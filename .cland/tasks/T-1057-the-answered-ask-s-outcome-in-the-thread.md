---
id: T-1057
kind: task
title: The answered ask's outcome in the thread and the inbox departure
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-413
blocked_by: []
topic: null
branch: null
created: 2026-10-21T14:04:15.186Z
updated: 2026-10-21T14:04:15.186Z
---

## Summary

Carry an answered ask's outcome into its thread and into the inbox's departure, so a client folds it in place to one line.

## Parent

E-413 (§3.4 "The answered ask" and "The inbox's leave rule, refined"; tracer step 4).

## What to build

An ask's record carries its outcome for good: the option or the free answer, who answered and when. The thread shows it, and the inbox's departure reports the row as `answered` with that outcome. How long a client keeps the folded row is the client's choice; the hub reports the outcome.

## Acceptance criteria

- [ ] C1. Answering an ask with an option makes its thread entry carry the option, the answerer and the time, also on a later history read (test).
- [ ] C2. The inbox's departure for that row says `answered` with the same outcome (test).
- [ ] C3. A free-text answer is carried the same way (test).
- [ ] C4. `hub/README.md` describes the outcome fields and the departure.
