---
id: T-559
kind: task
title: The inbox projection is rebuilt from SQLite after every change, about 70% of the hub's CPU
state: open
status: in progress
size: M
labels:
  - v0.1.3
  - hub
  - bug
assignee: null
parent: E-425
blocked_by: []
topic: topic-351
branch: t/T-559-the-inbox-projection-is-rebuilt-from
created: 2026-10-16T01:14:12.317Z
updated: 2026-10-16T01:15:41.540Z
---

## Summary
A 25 s CPU profile of the live hub (pid 12296, 2026-10-16 01:11:58Z, taken by the stand-in; A-3539) shows self time almost all in SQLite: `all` 14.95 s, `get` 3.09 s, `prepare` 2.44 s, idle only 0.64 s. Inclusive project frames:
- `Inbox.list` (hub/src/hub/inbox.ts:204): 17.38 s, of which 14.42 s comes from the setImmediate callback in `Inbox.#changed` (inbox.ts:368), which recomputes the whole inbox after every change.
- Inside `list`: `store.inboxMessages` (store.ts:1368) 10.56 s and `store.topics` (store.ts:1188, via core.topics core.ts:421) 4.61 s.
- Second path: `eventsProject` (core.ts:469) → `list`, 2.95 s.

With about 20 live sessions and steady session-usage, state and announce traffic, the hub spends most of its time rebuilding the inbox. Tracker calls queue behind it: task.hold 26 s, suite.start 12 s, task.comment 8 s. T-548's journal scan is a separate cost; it didn't appear in this window, since no task.view calls ran. Same family as T-293's inbox.observe cost.

## Acceptance criteria
- [ ] C1. Inbox changes are coalesced, so a burst of N changes causes at most one rebuild per short interval (for example 250 ms), or the projection updates incrementally from the changed rows. The inbox the human sees, and its ordering and counts, stay identical.
- [ ] C2. `store.inboxMessages` and `store.topics` don't rescan all rows per rebuild: an index, a bounded query or a cached topic list, with the query plan recorded.
- [ ] C3. A load test with about 20 fake sessions emitting usage, state and announce events at live rates shows hub CPU and the p95 of task.hold and task.comment within budget, with before and after numbers recorded on the item.
