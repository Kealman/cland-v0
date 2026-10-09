---
id: T-104
kind: task
title: "Concurrent launches for one exclusive role: the role is reserved after awaits, so admission order can flip under load"
state: open
labels:
  - ready-for-agent
  - hub
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T20:04:50.886Z
updated: 2026-10-09T20:04:50.886Z
---

## Parent

Part of T-19. Found by the Coordinator's full suite on dev a9be9a0 at 19:55Z on 2026-10-09, after T-75 and T-77 merged.

## What happened

hub/test/role-integrity.test.ts:70, "two launches for the Coordinator at once: the role is reserved before the spawn, so the second is refused at once", failed once in the full suite. It passed 3 of 3 times when run alone. The first launch, coord-1, was refused with "role coordinator is held by coord-2", so the second launch reserved the role first. Exclusivity held, since only one session got the role and nothing spawned twice. Admission order did not. T-75 added a fresh roles read, and T-77 an async stat of the cwd, before the reservation. Both are awaits, so under load the later request can reach the reservation first.

## What to build

- Reserve the exclusive role synchronously at request admission, before any await. Then do the fresh roles read and the cwd check. If the role turns out to be invalid or the launch fails, release the reservation, as the failed-launch path already does.
- Keep the guarantees of T-75 (a fresh roles read for launch, with the grant rechecked after the await) and of T-77 (async launch stat).

## Acceptance criteria

- [ ] Two concurrent launches for an exclusive role: the first admitted wins, deterministically, which a deferred test proves by holding the fresh read of the first launch.
- [ ] A launch whose fresh roles read revokes the caller's grant releases the reserved role, which a test proves.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex. Class B, a race across an await (A-96).
