---
id: T-140
kind: task
title: "The other events and the hygiene: topic, usage and artifact events, subtree subjects, digest now, coalescing, the digest cap, lifetimes, the events' limit and cland hub subscriptions"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-139
topic: topic-57
branch: t/T-140-the-other-events-and-the-hygiene-topic
created: 2026-10-10T01:52:18.585Z
updated: 2026-10-10T04:00:05.150Z
---

## Parent

T-108 (A quiet Coordinator), slice 3 of 6. Spec §3.9 (Tools, Delivery, Hygiene, The human).

## What to build

The remaining events: `topic` (waiting for human, closed), `usage` (a threshold crossed, with the subscription naming its own cost or token threshold) and `artifact` (created, shared). Subjects add a role and a node of the item tree with its subtree. `digest = "now"` delivers at once by steering where the adapter can and falls back to the next turn elsewhere. Hygiene: equal events on one subject within 60 seconds coalesce into one with a count; a digest holds at most 10 events and summarises the rest ("and 12 more"); subscriptions end with their subscriber; a subject's death closes the subscription with a final event; events have their own limit, a key of its own in `[hygiene]`, and never count against the messages limit. `cland hub subscriptions` lists every session's subscriptions for the human; the inbox shows none of them; the journal records event deliveries.

## Acceptance criteria

- [ ] A burst of equal events within 60 seconds arrives as one line with a count; an eleventh event in a digest is summarised.
- [ ] `digest = "now"` steers on the adapters that can and falls back to the turn on the others, proven per fake harness.
- [ ] A subscriber's stop ends its subscriptions; a subject's death sends a final event and ends the subscription.
- [ ] Events never count against the 30-messages limit, and their own limit applies.
- [ ] `cland hub subscriptions` lists them; the inbox shows nothing of them; the journal records event deliveries.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.

## Comments

### impl-140 · 2026-10-10T04:00:05.150Z

Implementing the remaining subscription events, subjects, digest modes and lifecycle/hygiene on top of T-139. Starting with protocol and queue/storage behavior; verification will cover the frame protocol and fake adapters.
