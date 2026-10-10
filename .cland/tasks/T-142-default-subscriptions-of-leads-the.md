---
id: T-142
kind: task
title: "Default subscriptions of leads: the Coordinator holds the tree less claimed items, an item's lead its item; death and long idle reach the node's lead or the next one up"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-140
  - T-141
topic: null
branch: null
created: 2026-10-10T01:52:19.101Z
updated: 2026-10-10T01:52:19.101Z
---

## Parent

T-108 (A quiet Coordinator), slice 5 of 6. Spec §3.9 (Defaults from the hierarchy), §3.7 (Regardless of hierarchy).

## What to build

Leads hold default subscriptions. The Coordinator holds the item tree less the claimed items; an item's lead holds its item. Each covers the states of the sessions working on its items (died, waiting for approval, idle longer than `idle_minutes`) and the task events of its items (verdict, status change, closed). A death or a long idle reaches the node's lead, or the next lead up when the lead itself is gone. Explicit subscriptions widen the defaults.

## Acceptance criteria

- [ ] A Reviewer stopped mid-review is reported to the item's lead at its next turn.
- [ ] A killed Implementer is reported to the Coordinator, the next lead up.
- [ ] Defaults follow claim changes: a newly claimed item leaves the Coordinator's default set and joins the claimant's.
- [ ] The inbox stays free of these events; `cland hub subscriptions` shows the defaults.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.
