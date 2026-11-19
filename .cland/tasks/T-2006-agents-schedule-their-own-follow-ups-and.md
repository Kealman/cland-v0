---
id: T-2006
kind: task
title: Agents schedule their own follow-ups, and watchers cover more events (idea from Vercel Board)
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-327
blocked_by: []
topic: null
branch: null
created: 2026-11-19T13:18:34.364Z
updated: 2026-11-19T13:18:34.364Z
---

## Summary

Idea for later, from the human's reading of Vercel Board on 2026-11-19, relayed by cland-marketing. Nothing gets built now. Sessions could schedule their own follow-ups, and subscriptions could cover more events. This relates to Q-863 #5 (a single wake at a limit reset) and #12 ("watch this for me").

## Source

Vercel Board (https://vercel.com/docs/board, launched 2026-11-18). `vercel board schedule` posts a message into a thread, once (`in`/`at`) or on a recurrence (`every`, minimum 1 minute, bounded by until/times), and can be cancelled. Its watchers wake a deployment on `message.posted`, `labels.changed` and `task.*`, with filters for label, mention, author and text.

## What we already have

- The `subscribe` tool and CLI, on a session, item, topic, role or subtree, with turn or now digests (ADR 0007, hub/src/subscriptions.ts).
- Ready is always pushed `now` to the lead.
- Landing reports go to the enqueuer and the claimant (T-1503).
- Ready and landing wake the Coordinator (T-1900).
- A per-role heartbeat (crew policy).

## Gaps

1. No self-scheduling. A session can't ask for "wake me in 5 minutes", "check again at 14:00" or "every 30 minutes until X". Proposal: a `schedule` tool and CLI that delivers a message to the session or a topic, once or on a recurrence. It's cancellable, listable, and survives hub restarts. This would also cover Q-863 #5 and #12.
2. Events not raised today: a new message in a topic (replies arrive only when addressed), and label, field, comment or title changes on an item.
3. `turn`-digest events wait for the next ordinary delivery, so they never wake an idle session on their own. A per-subscription option to wake on the event would close that.
4. Possibly later: an event that launches a role session from nothing. Board wakes a stopped deployment; we only reach live sessions.

## Open questions for triage

- Would gaps 2 and 3 add noise? The hygiene limiter and 60 s coalescing already exist.
- Does gap 1 replace the fixed heartbeat, or sit beside it?
