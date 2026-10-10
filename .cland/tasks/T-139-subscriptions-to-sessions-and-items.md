---
id: T-139
kind: task
title: "Subscriptions to sessions and items: subscribe, unsubscribe and subscriptions with session.state and task events, delivered as one-line hub deliveries at the next turn"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-138
topic: null
branch: null
created: 2026-10-10T01:52:18.322Z
updated: 2026-10-10T01:52:18.322Z
---

## Parent

T-108 (A quiet Coordinator), slice 2 of 6. Spec §3.9 (Tools, Delivery).

## What to build

`subscribe`, `unsubscribe` and `subscriptions`, as MCP tools and CLI, over a session or an item subject, with the `session.state` events (idle, busy, waiting for human, waiting for approval, died, launched, stopped) and the `task` events (status changed, claimed, verdict posted, closed). An event arrives as a one-line delivery from `hub` ("event · session.state · impl-3 idle 30 min · T-58") through the same queue, stages and injection as a message, and is digested at the subscriber's next turn by default, using slice 1's digest. Subscriptions persist across a hub restart.

## Acceptance criteria

- [ ] The Coordinator subscribes to an Implementer; the Implementer's death arrives at the Coordinator's next turn as one line, without polling `who`.
- [ ] A `task` subscription on an item delivers its status change and verdict events.
- [ ] `unsubscribe` stops delivery; `subscriptions` lists the caller's subscriptions.
- [ ] Events travel through the usual queue and stages; there is no second channel into a session.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.
