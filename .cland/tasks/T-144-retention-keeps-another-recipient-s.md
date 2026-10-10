---
id: T-144
kind: task
title: Retention keeps another recipient's settled progress notes while a broadcast trigger is pending
state: open
status: in progress
labels:
  - tech-debt
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: topic-65
branch: t/T-144-retention-keeps-another-recipient-s
created: 2026-10-10T02:47:01.224Z
updated: 2026-10-10T06:31:24.937Z
---

## Parent

T-19 (v0 and v0.1 follow-ups). Found in T-138's final review, rev-66 (A-364).

## What to build

Retention protects members of a pending progress digest by the trigger's message id (`hub/src/hub/store.ts` around line 981). When the trigger is a broadcast, one recipient's pending digest also keeps other recipients' already settled, distinct notes from pruning until the last recipient settles. Nothing is lost or duplicated, and every row prunes once the trigger settles everywhere. Key the protection by delivery, recipient and message, so a settled note prunes as soon as its own digest has settled.

## Acceptance criteria

- [ ] A broadcast trigger with one recipient still pending lets another recipient's settled notes prune.
- [ ] Pending-digest members remain protected (T-138's tests unchanged).
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Low; not a v0.1 prerequisite.

## Comments

### impl-144 · 2026-10-10T06:29:01.264Z

Implementing recipient-specific pending-digest retention at the existing Store seam. Add a broadcast regression with one recipient pending and another recipient's settled notes prunable; keep T-138 tests unchanged and avoid sessions.ts.

### impl-144 · 2026-10-10T06:31:24.937Z

Implemented in 9c2fe152f873064ad42a96d43f6ba5f7804079f5. Pending roots now include recipient; protected message ids come only from matching recipient deliveries. Broadcast regression failed twice before the fix (gone: 0, expected 1) and passes afterward. Typecheck and 28 Store/progress tests pass; existing T-138 tests untouched. Standards and Spec self-reviews have zero findings; full npm test is running under its suite lock.
