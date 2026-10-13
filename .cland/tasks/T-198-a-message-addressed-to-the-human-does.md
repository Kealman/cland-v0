---
id: T-198
kind: task
title: A message addressed to the human does not raise the top bar's needs-you count
state: closed
status: done
labels:
  - qa-found
  - needs-triage
assignee: null
parent: E-110
blocked_by: []
topic: null
branch: null
created: 2026-10-10T16:58:19.973Z
updated: 2026-10-10T17:04:18.969Z
closed: 2026-10-10T17:04:19.058Z
---

Found by qa-15 in T-110's demo (verdict qa-2026-10-10-15-110-c, M6/C6, at e3b702e; report in topic-95).

Ten agent-to-agent sends leave the top bar's count unchanged, as wanted. A Coordinator send addressed to the human (topic, no to) also leaves it unchanged: 0 to 0 in a clean scratch project, 1 to 1 with an open ask. hub/src/hub/inbox.ts computes needsYou as asks + approvals + waiting topics only, the T-169 rule, so a plain now-layer message is not counted.

Conflict: T-110's Goal, tracer step 5 and Definition of done say a message addressed to the human raises the count. T-169 (stand-in decision, 2026-10-10) narrowed the chip to the hub's needsYou. Triage needs a decision: count unread human-addressed messages in needsYou (hub side, with a resolution rule such as read or answered), or amend T-110's C6 to T-169's rule.

## Comments

### coord · 2026-10-10T16:59:14.016Z

Decided (a) by the stand-in, 2026-10-10: T-110's C6 and tracer step 5 amended to the T-169 rule; the brief's M6 follows (QA rerun). The counted-message kind moves to T-171 as a candidate. Closes with T-110's M6 rerun.
