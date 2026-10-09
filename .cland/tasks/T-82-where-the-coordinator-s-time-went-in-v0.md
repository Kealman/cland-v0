---
id: T-82
kind: question
title: "Where the Coordinator's time went in v0: a journal analysis"
state: open
labels:
  - wayfinder:research
assignee: human
parent: T-81
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:09:37.318Z
updated: 2026-10-09T19:12:55.989Z
---

## Question

From the hub's journal and database of the v0 runs, where did the Coordinator's time and attention go, and which share of that load would each lever remove: a management hierarchy (reports handled one level down), batching and subscriptions (idle and death notices instead of polling and relaying), or nothing, because it is adapter-bound (Claude Code accepts hub messages only between turns)?

## Context

The human watched the Coordinator drown when many sessions ran in parallel: messages queue, every report and question lands on one session, and the crew waits. The retrospective artifact A-96 (T-73) records a vacant Coordinator for 24 minutes during hub stalls and 23 approval stalls. The data is in the main worktree's `.cland/journal.jsonl` and `.cland/hub.db` (read-only; never write there), plus `cland hub journal`.

## Deliverable

`docs/research/coordinator-load.md` on branch `research/coordinator-load`: the method; tables of messages received by the Coordinator per hour by kind (reports, questions, verdict notices, human instructions, Agents notices); queue depth and the wait between a delivery's queued and injected stages; turns that only relayed (a message in, a message out, no decision); idle gaps; the sessions that generated the most traffic; approval stalls. Then a ranked list of load sources, each with the lever it suggests and the share it would remove. The ticket "Session hierarchy: levels, reporting, routing and names" starts from it.
