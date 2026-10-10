---
id: T-141
kind: task
title: "The item's lead: the claimant leads its item; events, reports and verdicts route to it; @lead T-n resolves to it, else to the Coordinator"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by:
  - T-139
topic: topic-58
branch: t/T-141-the-item-s-lead-the-claimant-leads-its
created: 2026-10-10T01:52:18.890Z
updated: 2026-10-10T04:00:05.489Z
---

## Parent

T-108 (A quiet Coordinator), slice 4 of 6. Spec §3.7 (Routing, the item lead).

## What to build

The Implementer that claims an item leads it. Events, reports and verdicts about the item go to that lead, then to the Coordinator, then to the human. The address `@lead T-n` resolves to the item's current claimant, else to the Coordinator, when the hub records the message. The Reviewer and QA clauses report to `@lead T-n`. A message with no item goes to the Coordinator, as today.

## Acceptance criteria

- [ ] A Reviewer's "review not clear T-n" sent to `@lead T-n` reaches the Implementer holding the claim, not the Coordinator.
- [ ] With no claimant, `@lead T-n` resolves to the Coordinator; resolution happens when the hub records the message, and the recorded addressee is the resolved session.
- [ ] A claim change after recording does not reroute an already recorded message.
- [ ] The default Reviewer and QA clauses report to `@lead T-n`; list the exact `.cland/roles.toml` lines in your report.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.
