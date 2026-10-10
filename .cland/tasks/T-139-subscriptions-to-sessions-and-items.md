---
id: T-139
kind: task
title: "Subscriptions to sessions and items: subscribe, unsubscribe and subscriptions with session.state and task events, delivered as one-line hub deliveries at the next turn"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-138
topic: topic-55
branch: t/T-139-subscriptions-to-sessions-and-items
created: 2026-10-10T01:52:18.322Z
updated: 2026-10-10T03:39:35.993Z
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

## Comments

### impl-139 · 2026-10-10T03:13:38.947Z

Starting implementation at the pre-agreed hub frame/MCP/CLI seams and fake harness boundaries. Session/item events will reuse slice 1's next-turn digest; testing subscription ownership, event stages, unsubscribe and restart persistence.

### impl-139 · 2026-10-10T03:20:55.980Z

Frame/MCP task-status slice passes. CLI/MCP subscription persistence and already-queued unsubscribe behavior pass across a hub restart. Session lifecycle delivery is now connected to the committed process path, with a restart snapshot to avoid duplicate launch events; implementing fake-harness state/death and digest ordering coverage.

### impl-139 · 2026-10-10T03:33:38.836Z

Committed bede5a45417141af1169c8d18cf54becfab4d588 (copied from git log -1) and pushed the task branch to local origin. The 11 subscription scenarios and focused live-permission/defaults check pass; typecheck and git diff --check pass. The required single locked root npm test is now running under Node v24.21.0. Handover will include exact instance role tool line edits; .cland/roles.toml remains untouched.

### rev-66 · 2026-10-10T03:39:35.993Z

verdict: review
result: not clear
by: rev-66 [reviewer]
run: rev-66-139-1
commit: 9c43f71d79766efffbcfa06ecef88b0f375ddab0

Medium — hub/src/tracker/tracker.ts:375 (startup cached-file return at :556): #announced is empty after restart for unchanged indexed items, so the first committed change seeds the baseline without emitting its status/claim/verdict/close event; durable subscribers miss that change.

Medium — hub/src/hub/core.ts:281: stopped/exited → running with the same sessionId emits no launched event, so actual session.resume --relaunch notifications are lost; all three adapters preserve that ID.

Low — hub/src/tracker/tracker.ts:377: adopting name:impl into its stable ID produces another claimed-by notification without a new claim because the comparison uses raw IDs.

Standards clear. Read-only pinned production/in-memory probes confirmed both losses and identity-adoption noise; no suite run. Queue fan-out, held ordering, synchronous unsubscribe and batch TTL passed focused Core/Store probes. Full two-axis review and limitations: A-395, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-395-t-139-review-9c43f71-restart-and-relaunch-notifications.md.
