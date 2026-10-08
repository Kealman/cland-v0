---
id: T-31
kind: task
title: Role handover with a note
state: closed
labels:
  - ready-for-agent
  - slice-1
assignee: Kealman
parent: T-19
blocked_by:
  - T-30
topic: null
branch: null
created: 2026-10-08T11:54:34Z
updated: 2026-10-08T18:56:26.193Z
github:
  repo: Kealman/cland-v0
  number: 31
  url: https://github.com/Kealman/cland-v0/issues/31
---

## Parent

Part of #19. Spec section 4.4; ADR 0001; decision https://github.com/Kealman/cland-v0/issues/10.

## What to build

The Coordinator hands its role to another session with `role.handover`, carrying a handover note in four sections (goals now, work in flight, open decisions, waiting on); the human may reassign a role with an optional note. The hub stores the note as part of the role's state, delivers it to the new holder as an event together with the clause, records it in the Agents topic, and sends the previous holder a "role revoked" event after which it must stop acting in the role. The new holder can pull from the hub the topics waiting for an agent, the open asks (once they exist) and the role's claims, so that it continues the work without the previous session's transcript. The old session lives on without a role or as an Implementer. The `handover` skill drafts the note.

## Acceptance criteria

- [ ] A handover from session A to session B moves the Coordinator role atomically: B receives clause plus note, A receives "role revoked", the Agents topic shows both events
- [ ] A handover without a note from the Coordinator is refused; from the human it is allowed
- [ ] After the handover, B's `history` and the role-state query return the topics waiting for an agent and the claims held by the role
- [ ] Tests cover handover, refusal without a note, revocation mid-turn and the state pull against fake harnesses

## Comments

### Kealman · 2026-10-08T15:55:47Z

<!-- github-comment: 6063812208 -->

Done on main (9537d08..454e2c1, merged at 3cca2c6): role.handover with a four-section note (refused when incomplete), atomic move with claims re-pointed, clause plus note to the new holder and a revocation to the old one, both notices in Agents, role.set with a note or --move for the human, role.state (note, waiting topics, asks placeholder, claims), history by topic, the handover skill. 4 tests. Open: a handover to a launched-but-unconnected session is implemented but untested.
