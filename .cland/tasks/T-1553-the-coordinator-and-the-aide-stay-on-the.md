---
id: T-1553
kind: task
title: The Coordinator and the Aide stay on the local host
state: open
status: in progress
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-1531
blocked_by:
  - T-1552
topic: topic-1305
branch: t/T-1553-the-coordinator-and-the-aide-stay-on-the
created: 2026-10-31T23:47:42.983Z
updated: 2026-11-01T19:08:47.559Z
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
- [ ] C6. The implement skill's Host sessions paragraph no longer says every production lookup resolves local: it names the host registry (T-1552) and the refusal for an unregistered host, in the existing Host section.

## Comments

### impl-1553 · 2026-11-01T19:07:50.808Z

Read A-15100/A-15205, spec §1–3.1 and E-1531. Dependencies present; fetched origin/dev (already current). Prepared first C1 frame regression in new session-host-placement.test.ts, leaving C5 preservation files unchanged. Red run and all heavy local commands are held for the Coordinator's cover-quiet release. Contract consumer inventory published in item topic.
