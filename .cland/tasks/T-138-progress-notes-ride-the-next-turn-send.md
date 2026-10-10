---
id: T-138
kind: task
title: "Progress notes ride the next turn: send gains kind; progress is held and digested with the next turn on all three adapters, across a hub restart"
state: open
status: in progress
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-108
blocked_by: []
topic: topic-52
branch: t/T-138-progress-notes-ride-the-next-turn-send
created: 2026-10-10T01:52:18.096Z
updated: 2026-10-10T02:08:55.104Z
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

## Comments

### impl-138 · 2026-10-10T01:53:15.203Z

Implementing at the agreed hub frame protocol and fake harness seams. Initial focus: Claude Code turn boundaries, one durable delivery queue, digest ordering, and hold/release await races.

### impl-138 · 2026-10-10T02:01:23.545Z

Implemented kind validation/defaults and durable per-recipient digest membership inside the existing deliveries queue. All three fake adapters passed ordered three-note batching before and after a hub restart. Lost-ack reconnect and uncertain admission/manual retry tests passed; typecheck passed. Default role clauses and hub README updated; instance roles.toml edits will be supplied as exact old/new lines for the Coordinator.

### rev-65 · 2026-10-10T02:08:55.104Z

verdict: review
result: not clear
by: rev-65 [reviewer]
run: rev-65-138-1
commit: 2b0755ab253689259603891b8b49f12bf136128c

High: 0. Medium: 4. Low: 0.

Medium — hub/src/hub/store.ts:606: claiming a human delivery queued under a vacant role fails to attach the eventual recipient's held progress, so its next turn starts without the digest.

Medium — hub/src/hub/store.ts:513: binding includes expired notes without checking their queue age; a fresh report revives them. Preserve the existing TTL and drop/journal expired notes before binding, as decided in 6cf9c510.

Medium — hub/src/hub/store.ts:915: retention can delete an older note while its triggering delivery remains pending, changing the immutable retry input. Retain pending digest members as decided in 6cf9c510.

Medium — hub/src/hub/core.ts:692 / hub/src/hub/store.ts:620: rename a→offline b merges away P/a when P/a is bound to R1 and P/b to R2; actual rename succeeds and R1's replay loses P. Refuse any target with queued deliveries before mutation, naming target/count, as decided in 8764c2b2; check other moveQueued callers.

All four are reproduced with pinned code and an actual in-memory SQLite Store; rename also exercises the actual Core method. Ordinary batch order, isolation of later notes, uncertain hold/manual retry and whole-batch confirmation pass. Three-adapter/restart regressions were reviewed, not rerun. Default clause changes match A-344's instance lines 45/70/98/122. No suite or edits.

Full item against e4bdb0c. Standards: 0 findings. Spec: 4 medium. Evidence A-347: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-347-t-138-full-review-of-2b0755a-queue-lifetime-and-batch-identity-findings.md. Combined fix head is pending.
