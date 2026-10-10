---
id: T-164
kind: task
title: "Launch role notice: 'took <Role> at launch' goes missing when spawn acceptance and the first hello race (T-141 regression)"
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
created: 2026-10-10T08:59:53.666Z
updated: 2026-10-10T08:59:53.666Z
---

## Parent

T-108 (A quiet Coordinator), a follow-up from T-141's merge (1f56cf1). Found by the combined dev suite at bd9ee7c.

## What to build

`hub/test/agents-journal.test.ts`, "lifecycle events land in Agents as notices with kinds", fails about half the time on dev, and also fails alone (1 of 2 runs). The launched `coord-1` holds Coordinator: its start, stop and revocation notices all name the role. But the `role-assign` notice "coord-1 took Coordinator at launch" is missing.

T-141 changed when the first grant applies: at the credentialed first hello, or retired at spawn acceptance. Most likely one ordering of first hello versus acceptance grants the role without publishing the notice. Every path that gives a launched session its role must publish exactly one "took <Role> at launch" notice, whichever comes first, and never two.

Assertion seen: `role-assign ~ /^coord-1 took Coordinator at launch/` against notices `[role-assign alpha…, claim, release, role-revoke alpha…, session-start coord-1 [Coordinator] started, session-stop, role-revoke coord-1 … stopped]`.

## Acceptance criteria

- [ ] Both orderings of first hello and spawn acceptance publish exactly one "took <Role> at launch" notice; a frame-protocol test forces each ordering deterministically, without timing.
- [ ] The agents-journal test passes 20 consecutive runs alone.
- [ ] The T-141 role-integrity regressions (name-reservation and item-lead tests) still pass.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. A v0.1 regression; it goes before the next hub restart if it is quick.
