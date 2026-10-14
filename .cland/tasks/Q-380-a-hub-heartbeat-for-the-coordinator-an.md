---
id: Q-380
kind: question
title: "A hub heartbeat for the Coordinator: an hourly delivery by default, configurable, so a broken chain of events gets noticed"
state: closed
labels:
  - ready-for-human
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-14T08:41:13.838Z
updated: 2026-10-14T16:43:54.280Z
closed: 2026-10-14T16:43:54.280Z
---

## Open question

Observation from the human (2026-10-14, during the v0.1.2 build). The Coordinator should have a heartbeat: the hub sends it a delivery at a set interval, one hour by default and configurable, so that the Coordinator wakes up and checks whether some chain of events has broken (an item in review with no verdict requested, a ready item never merged, a session idle for hours, a run that never reported, an ask that nobody answered) and acts, instead of sleeping until the next event that may never come. During the v0.1 build the human had to keep an hourly check running outside the hub for the stand-in session; the hub should own it.

To decide: where the interval lives (crew.toml per role, `heartbeat = "1h"`; the Coordinator by default, other leads optionally); what the delivery carries (a digest of what is in flight and what looks stale, computed by the hub, so the turn starts with facts rather than a bare tick); whether the heartbeat starts a turn only when the session is idle, and how it coalesces with a pending digest (v0.1 §3.9 hygiene); what the Coordinator's clause says to do on a heartbeat (the checks, the repairs, when to escalate to the human); that a heartbeat is never a needs-you; how it shows in the events view (§3.7 of v0.1.2); and the timer as an event kind under ADR 0007 (events reach sessions as deliveries).

## Comments

### human · 2026-10-14T16:43:54.280Z

Decided on 2026-10-14: recorded in docs/spec/v0.1.3.md §3.3; built by E-423 Rules and rhythm
