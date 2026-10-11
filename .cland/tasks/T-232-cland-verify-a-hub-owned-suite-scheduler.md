---
id: T-232
kind: task
title: "cland verify: a hub-owned suite scheduler with admission by load budget and priority, replacing the lock file as the source of truth"
state: open
status: backlog
labels:
  - v0.1.1
  - ready-for-agent
assignee: null
parent: T-230
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:48:35.223Z
updated: 2026-10-11T17:48:35.824Z
---

## What to build

`cland verify [all|hub|nvim] --report <topic|session> [--to <session>]…`: a hub-owned scheduler for suite runs that replaces /tmp/cland-suite.lock as the source of truth (T-218 research A-1142, v0.1.1 row).
- The hub keeps one queue of verification requests in its database. Each request records the session, item, branch head, mode (from T-214's phase selection), priority and the time it was queued.
- Admission is by a load budget: one full run at a time by default, configurable. Priority is by item rank, with the Coordinator's integrated dev runs first.
- The hub launches and supervises each run itself (it reuses T-203's worker), keeps T-207's place across phases, and posts one result per request as T-203 does.
- The queue survives a hub restart. A request whose session died is cancelled with a posted note.
- Compatibility shim: `npm test` run by hand, or by a branch from before V1, still takes /tmp/cland-suite.lock. The scheduler treats the lock holder as an occupied slot and never runs beside it.
- `cland suite` stays an alias for `cland verify` during the transition.

## Acceptance criteria

- [ ] Requests queue in the hub and are admitted by budget and priority; two sessions requesting at once never run beside each other; the order survives a hub restart.
- [ ] A hand-run `npm test` holding the old lock blocks admission until it exits (shim), and a V1 run never starts while the lock is held.
- [ ] Results are posted once per request to the named topic and sessions; T-209's head binding is unchanged (the result names its exact head).
- [ ] A dead requester's queued request is cancelled with a posted note.
- [ ] Protocol tests cover queueing, priority, restart, shim and death. `npm run typecheck && npm test` pass.
