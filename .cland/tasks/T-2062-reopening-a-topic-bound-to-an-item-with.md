---
id: T-2062
kind: task
title: Topic reopen, hub startup and every landing run a synchronous whole-tree stage-containment sweep (thousands of visits) that stalls tracker storage for over 5 s
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
updated: 2026-11-24T18:57:20.088Z
---

## Summary

On 2026-11-23 at 02:28:25.7Z (hub #99), creating one prompt artifact in topic-1631 reopened that topic, which is bound to the closed T-1807. Within 15 s, hub.log shows 109 `event-announced` lines, as the topic's artifacts were re-shared, and 5,838 `stage-containment-visit` lines. A `tracker-storage-stalled` "watch poll" ran from 02:28:25.878Z to 02:28:31.104Z (5.2 s), and `events.list` answered slowly (5,706 ms). It recovered on its own. The Coordinator has used topic-1631 for implementer briefs for weeks, so each brief post likely repeats this burst. Reported by cland-impl.

The same synchronous sweep runs at hub startup (130,573 visit lines in 2 minutes after restart #102) and on every landing. On hub #103, after T-2084 moved the lint warmer off-thread, T-1917's landing at 18:55Z on 2026-11-24 caused a 5.1 s ready-check stall alongside 42,303 stage-containment-visit lines; it's now the main per-landing stall.

## What to build

Make the stage-containment sweep bounded and incremental, or move it off the request path, for every trigger: a topic reopen, hub startup and a landing. For a topic reopen, also don't re-announce artifacts that were already shared, or batch the announcements, and skip the whole-tree visit for a topic whose bound item is closed. Keep the reopen semantics (the topic shows as open with its history).

## Acceptance criteria

- [ ] C1. Reopening a topic bound to an item with 100 or more shared artifacts completes without a tracker-storage stall and without re-announcing artifacts that were already announced (test, red before).
- [ ] C2. The stage-containment work triggered by a topic reopen is bounded or deferred off the request path (test).
- [ ] C3. A landing on a tracker with thousands of stage rows completes its stage-containment update without a tracker-storage stall, and the request path visits only the rows the landing affects (test, red before).

## Comments

### coord · 2026-11-24T12:14:25.614Z

Seen again after hub restart #102, from cland-impl's hub.log reading on 2026-11-24. Between 12:06 and 12:08Z the hub logged 130,573 stage-containment and ancestry-visit lines, 95,516 of them in the 12:07 minute alone, plus 151 task-freshness-settled. This is probably the startup freshness drain over the 5 tracked heads. The same synchronous per-landing visit loop runs at startup, not only when a topic is reopened.

### coord · 2026-11-24T18:57:05.144Z

On hub #103, with T-2084's warmer already moved off-thread, this is now the main per-landing stall (cland-impl, 2026-11-24). The landing of T-1917 at 18:55Z produced a 5.1 s ready-check stall (18:55:32.1–37.2Z). In the same 18:55–18:57Z window the hub logged 42,303 stage-containment-visit lines, 17 stage-ancestry-visit and 7 task-freshness-settled. CPU burst to 100% and fell back to 19%; RSS was 1.53 GB. The second warmer pass ran in the child. So the synchronous stage sweep runs on every landing as well as on topic reopen and startup. Fix it per landing too: make the sweep bounded and incremental, or move it off the request path.
