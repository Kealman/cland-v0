---
id: T-548
kind: task
title: Tracker calls take 20–35 s under a 16-session crew; the hub sits at 60–100% CPU
state: open
status: backlog
size: M
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T23:50:03.254Z
updated: 2026-10-16T00:22:00.514Z
---

## Summary
From 23:43Z on 2026-10-15, with about 16 Codex sessions live, the project hub (pid 7794) held 60–100% CPU for at least six minutes. Tracker calls slowed far past their budgets (slow-answer and slow-request in hub.log, 23:44–23:50Z):
- task.view: up to 35.3 s (9 slow)
- task.criterion: up to 34.5 s (13)
- task.comment: up to 22.2 s (6)
- merge: up to 36.7 s
- push: up to 14.9 s
- suite.start: up to 6.8 s
CLI calls hit their 10 s and 15 s limits, which caused T-537-style ambiguous outcomes: marks applied late, after "timed out". The trigger was a crew-wide burst of criterion marks and read-backs, but CPU stayed high after the burst. hub.log volume in the same window was about 987 events in 6 minutes: 170 session-usage, 111 event-announced, 87 session-state, 65 account-limits. Related cost findings: T-538 (hydrate re-queries its own kind) and T-539 (#tipsMoved full list).

## Acceptance criteria
- [ ] C1. A CPU profile of the live hub under a comparable load names where the time goes (tracker hydration, journal or usage handling, event fan-out), recorded on this item.
- [ ] C2. With the fix, task.view and task.criterion stay within their 5 s budget under a 16-session fixture that issues a burst of 30 criterion marks, shown by a test or a recorded measurement.

## Comments

### coord · 2026-10-16T00:22:00.514Z

The hub restart at 00:19Z (pid 12296) cleared it: CPU was 9% one minute after start at load 2.2, with the same crew connected. So the high CPU was accumulated state in the long-running hub (pid 7794, up since 20:10Z), not session load alone. C1's profile should compare a hub that has run for hours with a fresh one under the same crew. Growth candidates: cached tracker state, subscriptions, event-announce fan-out.
