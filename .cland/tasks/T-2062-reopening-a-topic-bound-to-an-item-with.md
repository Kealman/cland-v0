---
id: T-2062
kind: task
title: Reopening a topic bound to an item with many artifacts re-announces every artifact and visits thousands of stage-containment rows synchronously, stalling tracker storage for over 5 s
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: null
branch: null
created: 2026-11-23T02:29:26.297Z
updated: 2026-11-24T12:14:25.614Z
---

## Summary

On 2026-11-23 at 02:28:25.7Z (hub #99), creating one prompt artifact in topic-1631 reopened that topic, which is bound to the closed T-1807. Within 15 s, hub.log shows 109 `event-announced` lines, as the topic's artifacts were re-shared, and 5,838 `stage-containment-visit` lines. A `tracker-storage-stalled` "watch poll" ran from 02:28:25.878Z to 02:28:31.104Z (5.2 s), and `events.list` answered slowly (5,706 ms). It recovered on its own. The Coordinator has used topic-1631 for implementer briefs for weeks, so each brief post likely repeats this burst. Reported by cland-impl.

## What to build

Make a topic reopen bounded and asynchronous. Don't re-announce artifacts that were already shared, or batch the announcements. Don't trigger a whole-tree stage-containment visit for a topic whose bound item is closed, or make that visit incremental and yielding. Keep the reopen semantics (the topic shows as open with its history).

## Acceptance criteria

- [ ] C1. Reopening a topic bound to an item with 100 or more shared artifacts completes without a tracker-storage stall and without re-announcing artifacts that were already announced (test, red before).
- [ ] C2. The stage-containment work triggered by a topic reopen is bounded or deferred off the request path (test).

## Comments

### coord · 2026-11-24T12:14:25.614Z

Seen again after hub restart #102, from cland-impl's hub.log reading on 2026-11-24. Between 12:06 and 12:08Z the hub logged 130,573 stage-containment and ancestry-visit lines, 95,516 of them in the 12:07 minute alone, plus 151 task-freshness-settled. This is probably the startup freshness drain over the 5 tracked heads. The same synchronous per-landing visit loop runs at startup, not only when a topic is reopened.
