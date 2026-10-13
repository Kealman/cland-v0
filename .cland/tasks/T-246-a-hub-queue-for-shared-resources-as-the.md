---
id: T-246
kind: task
title: A hub queue for shared resources, as the human experiences it
state: closed
status: done
labels:
  - v0.1.2
  - ready-for-human
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:49:03.051Z
updated: 2026-10-12T11:35:34.512Z
---

## Open question

Observation 12: named queues with a capacity, requested by sessions and the human, with a delivery saying 'your turn', release on death or timeout, and the panel showing who holds and who waits. v0.1.1's T-232 (cland verify) builds the suite queue. This item is the generalisation and the human-facing design (other resources, the human's own npm test, priority, UX), to grill after T-232 lands.

Source: the human's observations during the v0.1 build, memory note cland-v011-scope (2026-10-10). Backlog by decision D21: needs the human's decisions or a design grilling before it becomes tickets.

## Comments

### human · 2026-10-12T08:59:33.034Z

Decided (2026-10-12, round 2): no general queue API in v0.1.2 (cland verify is the suite queue, merges are serialized by the hub); the verify line in the sessions panel header becomes a one-line queue summary that opens the queue view (holder, ordered waiters with their wait, admission ETA from the median run); the human's own npm test goes through the same queue and does not start while it is busy unless --force. Recorded in docs/spec/v0.1.2.md §3.6.

### human · 2026-10-12T11:35:34.512Z

Decided on 2026-10-12: recorded in docs/spec/v0.1.2.md §3.6; built by T-275 Sessions: stopped sessions, verifiers' items, the queue line
