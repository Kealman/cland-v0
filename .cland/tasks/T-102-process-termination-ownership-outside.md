---
id: T-102
kind: task
title: "Process termination ownership outside the sweep: overlapping doctors on deleted hubs, direct endProcess calls, and the SIGCONT doc"
state: open
status: backlog
labels:
  - hub
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-216
blocked_by: []
topic: null
branch: null
created: 2026-10-09T19:16:42.280Z
updated: 2026-10-11T15:30:41.480Z
---

## Parent

Part of T-19, a follow-up to T-70 and T-76. Listed by rev-65 in rev-65-76-5 on T-76 (A-168) as pre-existing hazards in the shared termination helper, outside T-76's own scope by the Coordinator's decision.

## What happened

T-76 serialized sweeps per project and gave each sweep's workers atomic capture claims. Two gaps remain beyond that:
- `cland doctor --fix` runs started from different projects, or caller roots, can overlap on the same globally discovered deleted-project hubs. The per-project sweep lock does not cover them.
- Direct `endProcess` calls outside a sweep, from session stop, relaunch and lost-claim cleanup, have no shared termination ownership. Two of them, or one of them and a sweep, can freeze and thaw the same tree.
- A low docs correction from the same verdict: SIGCONT is not "harmless" in every case, because it can run a SIGCONT handler even in a running process. The README sentence on the accepted identity-free CONT needs that qualifier.

## What to build

- One machine-wide owner for terminating a given process tree. For example, a per-pid claim registry shared by every termination path, or a machine-wide lock for deleted-hub cleanup across doctors.
- Correct the CONT sentence in hub/README.md.

## Acceptance criteria

- [ ] Two doctors from different projects that both find one deleted hub end it once, without one freezing or thawing the other's tree, which a test proves.
- [ ] A session stop that overlaps a sweep on the same tree ends it once and reports one result, which a test proves.
- [ ] The README's CONT sentence carries the qualifier.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size M; triage before scheduling. Follow T-70 and T-76's ownership rules (A-96, class D).
