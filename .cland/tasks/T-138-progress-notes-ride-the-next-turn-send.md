---
id: T-138
kind: task
title: "Progress notes ride the next turn: send gains kind; progress is held and digested with the next turn on all three adapters, across a hub restart"
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by: []
topic: null
branch: null
created: 2026-10-10T01:52:18.096Z
updated: 2026-10-10T01:52:18.096Z
---

## Parent

T-108 (A quiet Coordinator), slice 1 of 6. Spec §3.9 (Progress notes).

## What to build

`send` gains `kind`: `progress`, `report`, `question` or `decision`; a `send` without a kind is a `report`. The hub holds a session's `progress` deliveries without starting a turn and injects them as one digest together with that session's next turn-starting delivery, on Claude Code, Codex and OpenCode. Held notes survive a hub restart. The role clauses tell agents to mark progress notes. The journal records the kind.

## Acceptance criteria

- [ ] On each of the three fake harnesses, three `progress` messages start no turn and arrive in one digest with the next `report`.
- [ ] Held progress notes survive a hub restart and are delivered with the next turn afterwards.
- [ ] A `send` without a kind behaves as `report`; `question` and `decision` start a turn.
- [ ] The default clauses tell agents to mark progress notes; list the exact `.cland/roles.toml` lines in your report.
- [ ] `hub/README.md` documents the kinds.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Implementer: Codex. ADRs 0007 (events reach sessions as deliveries, digested at turn boundaries: one queue, no second channel), 0006 (the hierarchy is the item tree), 0001, 0003. Research: `research/coordinator-load` (T-82, with `analyse.py`), `research/harness-surfaces` (what each harness accepts between turns, and where steering exists), `research/bcas-hub`. Tests through the v0 seams: the hub frame protocol first, then the fake Claude Code, Codex and OpenCode in `hub/test/fakes/`; no new seams inside the hub. The epic's "choices where the spec is silent" apply. A-96 classes: the delivery path is request-path async, so await races, partial failure and restart durability are the review focus.
