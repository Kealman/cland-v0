---
id: T-1553
kind: task
title: The Coordinator and the Aide stay on the local host
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1552
topic: null
branch: null
created: 2026-10-31T23:47:42.983Z
updated: 2026-11-01T07:09:55.488Z
---

## Summary

`session.launch` takes an optional `host`, `local` by default. The hub refuses an unknown host, and refuses any host other than `local` for the Coordinator and the Aide, whether at launch, relaunch, fresh resume, role set or handover.

Hot files: `hub/src/adapters/sessions.ts`, `hub/src/adapters/requests.ts`, `hub/src/protocol.ts` (the `session.launch` frame), the role set and handover path in `hub/src/hub/core.ts`

## Acceptance criteria

- [ ] C1. `session.launch` accepts an optional `host` naming a registered host, defaults to `local`, and refuses an unknown host by name before anything is reserved or spawned (test).
- [ ] C2. Through the frame protocol, a launch, relaunch or fresh resume of a Coordinator or Aide with a test host is refused with a reason saying these roles run only on the local host, and nothing is spawned or reserved (test).
- [ ] C3. Setting or handing over the Coordinator or Aide role to a session whose row is on another host is refused with the same reason (test).
- [ ] C4. A launch of another role with a test host reaches that host's spawn (here refused by the test host), and a launch without `host` is unchanged (test).
- [ ] C5. The role-launch, roles-launch-permissions and session-launch test files pass with no test edited.
