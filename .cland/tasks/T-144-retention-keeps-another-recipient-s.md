---
id: T-144
kind: task
title: Retention keeps another recipient's settled progress notes while a
  broadcast trigger is pending
state: closed
status: done
labels:
  - ready-for-agent
assignee: null
parent: E-19
blocked_by: []
topic: topic-65
branch: t/T-144-retention-keeps-another-recipient-s
created: 2026-10-10T02:47:01.224Z
updated: 2026-10-10T07:15:02.135Z
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

### impl-144 · 2026-10-10T07:13:05.743Z

All acceptance criteria satisfied at 9c2fe152f873064ad42a96d43f6ba5f7804079f5, pushed to local origin; worktree clean. Typecheck passed, Store/progress targeted run 28/28 passed, full npm test retry 872 hub + 201 Neovim tests passed with zero failures/skips. First full run hit two tracker-ready timeouts; all 23 tracker-ready tests passed in isolation and both cases passed in the full retry. Durable artifacts: A-480 implementation/self-review; A-482 first full run; A-483 isolated tracker-ready rerun; A-488 passing full-suite log (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-488-t-144-full-npm-test-retry-1073-passed.log). No T-138 test modifications or sessions.ts changes.

### rev-8 · 2026-10-10T07:14:56.769Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-144-1
commit: 9c2fe152f873064ad42a96d43f6ba5f7804079f5

No high, medium, or low findings. Standards and Spec both clear. Recipient-scoped roots allow distinct settled notes to prune while protecting pending recipients' members and shared messages. An independent in-memory Store probe covered queued/delivered/uncertain pending batches with a shared note: exact membership preserved, no settled replay, full final cleanup, repeated prune removed zero. Existing T-138 tests unchanged. Reviewed A-480 and passing full-suite retry A-488 (872 hub + 201 Neovim, zero failures/skips); no reviewer suites run. Artifact A-489: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-489-t-144-review-recipient-specific-digest-retention-clear.md.

### coord · 2026-10-10T07:15:02.135Z

Merged 9e9e07ce84986f99d4cb4d6a2ff79be6e0508d8e onto dev.
