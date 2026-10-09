---
id: T-91
kind: question
title: Event subscriptions for sessions
state: open
labels:
  - wayfinder:grilling
assignee: null
parent: T-81
blocked_by:
  - T-89
topic: null
branch: null
created: 2026-10-09T19:09:44.389Z
updated: 2026-10-09T19:10:27.814Z
---

## Question

How does a session subscribe, through the hub, to events of other sessions, items and topics, and how are those events delivered to it?

## Context

Only UI and CLI clients may subscribe to hub events today; sessions poll `who`, `history` and `task.list` or run their own monitors (the Coordinator did, and so did a QA session), and idles and deaths reach only the Agents log and the human's inbox. The human wants a standard mechanism: a session subscribes to events (another session idle, dead or waiting; an item closed or a verdict posted; a topic waiting; a usage threshold) and receives them without polling. The session hierarchy implies defaults: a parent is subscribed to its children's state. Claude Code sessions take hub messages only between turns; Codex and OpenCode can be steered mid-turn.

## To decide

- The tools: `subscribe` and `unsubscribe` with filters by session, role, item, topic and event kind; what `who` and `status` still cover.
- Delivery: one delivery per event, batched digests, or an inject; ordering with normal deliveries; what the journal records.
- Hygiene: rate limits, coalescing of repeated states, expiry when the subscriber or the subject dies.
- Defaults from the hierarchy and from roles; what the human sees of subscriptions.
- The ADR: extend 0001 or a new one on events.

Record the resolution as a comment, the spec section and the ADR.
