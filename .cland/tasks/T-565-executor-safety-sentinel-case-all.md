---
id: T-565
kind: task
title: 'executor-safety sentinel case: "all executor leases finish releasing" not within 15000 ms on a droplet'
state: closed
status: done
size: S
labels:
  - bug
  - hub
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T02:58:29.602Z
updated: 2026-10-20T06:07:27.949Z
closed: 2026-10-20T06:07:27.949Z
---

## Summary
Reported by impl-551 on 2026-10-16. In T-551's droplet run a53c3d9c at b2565458, which ended at the 50-minute timeout on a droplet that peaked at load 15.29, the only ordinary red outside T-551 was hub/test/executor-safety.test.ts:289. In the sentinel safety case, "all executor leases finish releasing" didn't happen within 15000 ms. T-551 doesn't touch executor-safety. Sibling of T-524, the same-name hubs case in the same file.

## Acceptance criteria
- [ ] C1. Find why lease release in the sentinel case can exceed 15 s under droplet load, and either fix the release path or wait on the observed release event instead of a fixed bound, with the cause recorded on this item.
- [ ] C2. executor-safety.test.ts passes 5/5 serially as a whole file on the Mac and once on a droplet in the task's verify.

## Comments

### coord · 2026-10-20T06:07:27.949Z

Closed in the D76 triage (2026-10-20, read-only check at dev 9b2cb194, artifact to follow in General): fixed by 4deaec2f (T-524): the executor-safety sentinel case no longer races lease release.
