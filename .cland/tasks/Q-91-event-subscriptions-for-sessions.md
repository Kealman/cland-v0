---
id: Q-91
kind: question
title: Event subscriptions for sessions
state: closed
labels:
  - wayfinder:grilling
assignee: human
parent: M-81
blocked_by:
  - Q-89
topic: null
branch: null
created: 2026-10-09T19:09:44.389Z
updated: 2026-10-09T20:27:20.845Z
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

## Comments

### human · 2026-10-09T20:27:12.195Z

Resolution (2026-10-09, the human accepted every point).

- Tools: subscribe (subject: session, item, topic, role, or a node with its subtree; a list of events), unsubscribe, subscriptions. Events: session.state (idle, busy, waiting for human, waiting for approval, died, launched, stopped), task (status changed, claimed, verdict posted, criterion marked, closed), topic (waiting for human, closed), usage (threshold), artifact (created, shared). Messages are not events.
- Delivery: an event is a delivery from hub with a one-line body through the same queue and injection as a message; digest = turn by default (one message at the next turn start), now for immediate delivery by steer where possible.
- Progress notes: send gains a kind; progress never starts a turn and arrives in the next digest; report, question and decision start a turn; role clauses mark progress notes (up to 59% fewer turn starts in the v0 run).
- Defaults: a lead is subscribed to its node's subtree less subtrees with their own lead (session died, waiting for approval, idle beyond idle_minutes; task verdict, status change, closed); explicit subscriptions widen this.
- Hygiene: coalescing of equal events on one subject within 60 s, digests capped at 10 events with "and N more", subscriptions die with the subscriber, a subject's death sends a final event, events have their own limit.
- The human: nothing in the inbox (background), `cland hub subscriptions` lists them, the journal records them like messages.
- ADR 0007 "Events reach sessions as deliveries, digested at turn boundaries". GLOSSARY: Event, Subscription.

Recorded in docs/spec/v0.1.md §3.9, GLOSSARY.md and docs/adr/0007-events-reach-sessions-as-deliveries.md.

### human · 2026-10-09T20:27:20.845Z

Resolved: see the resolution comment; spec v0.1 §3.9; ADR 0007
