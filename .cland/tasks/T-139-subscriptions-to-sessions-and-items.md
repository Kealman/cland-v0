---
id: T-139
kind: task
title: "Subscriptions to sessions and items: subscribe, unsubscribe and
  subscriptions with session.state and task events, delivered as one-line hub
  deliveries at the next turn"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: E-108
blocked_by:
  - T-138
topic: topic-55
branch: t/T-139-subscriptions-to-sessions-and-items
created: 2026-10-10T01:52:18.322Z
updated: 2026-10-10T03:59:20.506Z
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

### impl-139 · 2026-10-10T03:42:22.837Z

Addressed all three rev-66 findings from A-395: startup baseline for every indexed item, canonical claim ownership, and launched on every transition into running. Four regressions reproduced failures before the fix and pass afterward; typecheck and diff checks pass. New head copied from git log -1: 647c81227d273227f63e45258cde26236ce9f410, committed and pushed to local origin. The earlier queued root invocation was cancelled before acquiring the lock; awaiting delta review before the final suite.

### rev-66 · 2026-10-10T03:44:39.269Z

verdict: review
result: clear
by: rev-66 [reviewer]
run: rev-66-139-2
commit: 647c81227d273227f63e45258cde26236ce9f410

Clear — no high or medium findings remain; this verdict covers the full item at 647c812.

All A-395 findings resolved: hub/src/tracker/tracker.ts:424 seeds unchanged cached items at startup; :377 compares canonical claim ownership; hub/src/hub/core.ts:281 recognizes actual transitions into running while keeping duplicate and seeded-restart publication silent.

Reran focused read-only A-395 probes: first post-restart status change emitted once, adoption stayed silent while real new ownership emitted, verdict repetition stayed silent, close emitted status and closed, stopped/exited relaunches emitted launched once. Production Core/Store held delivery, independent digests, synchronous unsubscribe and batch TTL passed. Standards and unchanged full-item checks carry forward. No suite run.

Two-axis review and probe limits: A-400, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-400-t-139-full-item-clear-review-at-647c812.md.

### impl-139 · 2026-10-10T03:54:48.762Z

Final root suite on 647c812: hub 851/852 pass; all 14 subscription cases pass. Existing Claude forced-stop case refused an unverifiable process identity; nvim was skipped by root's early exit. Per Coordinator, isolated forced-stop case passes 3/3 on 647c812 and 3/3 on pinned dev 8b2349d, with timing/load evidence in A-404; full log is A-403. Baseline diagnostic worktree removed. Locked nvim package suite is now running to complete the remaining phase. No stop-path or timing-threshold changes.

### impl-139 · 2026-10-10T03:58:26.262Z

Handover at committed/local-origin head 647c81227d273227f63e45258cde26236ce9f410 (copied from git log -1), clean worktree. Neovim package suite passes 162/162 (A-407); typecheck passes. Root hub 851/852, all 14 subscription cases pass; Coordinator accepted the isolated-comparison evidence and classified the one forced-stop refusal as T-147 (A-403/A-404). Review clear at this head (A-400). Final report A-408: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-408-t-139-final-handover-at-647c812.md. Exact old/new instance role tool lines and all four rationales remain in A-393; instance unchanged. Ready for Coordinator merge gate; no merge performed.

### coord · 2026-10-10T03:58:36.169Z

Merged b4d5cef5d5e53867570fd672201f9a71b4d48330 onto dev.

### coord · 2026-10-10T03:59:20.506Z

Merged by the Coordinator through `cland merge T-139`, after `cland push`: squash b4d5cef on dev.
Gate: review rev-66-139-2 clear on 647c812 (A-400), after rev-66-139-1 (A-395): a missing first post-restart item event, a missing `launched` on relaunch, and a duplicate claimed event on adoption. All three were fixed with four regressions that fail first and then pass (A-398).
Decisions:
- separate `event.*` frame types, leaving the UI's `subscribe` untouched;
- `send` refuses kind `event` from sessions;
- unsubscribe stops future events, while recorded events follow the normal lifecycle;
- events reuse T-138's queue and digest rules.
Evidence:
- hub 851 of 852 on 647c812 (A-403). The one failure is a load-dependent stop identity refusal that passed 6 of 6 isolated runs on both head and base (A-404); it's filed as T-147, a production item, since the same refusal was seen live.
- Neovim 162 of 162 (A-407); handover A-408.
Project instance: the subscribe, unsubscribe and subscriptions grants for all four roles, from A-393 and verified line for line, are committed next. They take effect at the next restart.
