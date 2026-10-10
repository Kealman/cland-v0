---
id: T-142
kind: task
title: "Default subscriptions of leads: the Coordinator holds the tree less claimed items, an item's lead its item; death and long idle reach the node's lead or the next one up"
state: open
status: review
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-140
  - T-141
topic: topic-70
branch: t/T-142-default-subscriptions-of-leads-the
created: 2026-10-10T01:52:19.101Z
updated: 2026-10-10T09:12:28.493Z
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

## Comments

### impl-142 · 2026-10-10T08:41:16.815Z

Implementing default lead subscriptions at the existing hub protocol seam. Scope stays in subscription/hygiene code; sessions.ts and adapters remain untouched. Baseline bd9ee7c includes event hygiene and item lead routing.

### impl-142 · 2026-10-10T08:53:29.697Z

Implemented and committed 0355a59: dynamic default subscriptions follow claims (including before first hello), pooled verifier holds, and offline Coordinator recovery; terminal events retain the existing atomic fan-out/checkpoint. Targeted ownership/lifecycle/long-idle/restart tests and typecheck pass. Full npm test and two-axis local review are running; no role/clause changes.

### impl-142 · 2026-10-10T09:01:34.938Z

Local Spec review found and reproduced two gaps: removed items lost final default events, and terminal recovery could send an older pooled Reviewer death to its already-dead lead. Both are fixed with regression coverage. Coordinator authorized an isolated Sessions.releaseInterruptedLaunches() startup seed plus HubCore.seedProcess(), and the existing subscription-hygiene crash-fixture arrangement (durable status setup, frame-history-only assertions). Existing item-lead tests now accept report digests; all ten pass.
