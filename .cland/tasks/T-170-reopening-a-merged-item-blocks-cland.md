---
id: T-170
kind: task
title: "Reopening a merged item blocks cland push and strands its worktree: one rule for reopen after merge"
state: closed
status: done
criterion_seq: 4
labels:
  - tech-debt
  - ready-for-agent
assignee: impl-170
parent: T-229
blocked_by: []
topic: topic-161
branch: t/T-170-reopening-a-merged-item-blocks-cland
created: 2026-10-10T10:13:29.682Z
updated: 2026-10-12T01:32:37.045Z
---

## Parent

T-19 (follow-ups). Found on 2026-10-10 while reopening T-165 for a fix round.

## What to build

Reopening a merged task (`task edit --state open`) leaves its merge receipt active. `cland push` then refuses with "finish pending cland merge T-n before pushing dev", because the open item still has a landed receipt. Launching an Implementer on the reopened item recreated `.cland/worktrees/T-165`. Running `cland merge T-165` to clean up then refused: "already landed, but the task branch changed since; reconcile the item before merging further work". The worktree was left behind.

Decide and implement one rule for reopening a landed item. Either:
- reopening retires its merge receipt, so a new round starts from dev on a fresh branch; or
- `task edit --state open` on a landed item is refused, naming the follow-up-ticket path.

Then make `cland merge` able to remove a stale worktree for a closed, landed item.

## Acceptance criteria

- [x] C1. Reopening a landed item never blocks `cland push`; the chosen rule is documented in docs/agents/issue-tracker.md.
  - done: impl-170 · 2026-10-11T23:47:29.664Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T170-2 · 2026-10-12T01:17:54.816Z · commit 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd
- [x] C2. A stale worktree of a closed, landed item, whose branch dev fully contains, can be removed through cland, and a protocol test proves the removal leaves no other work behind. Cleaning up the real .cland/worktrees/T-165 is done by the Coordinator after T-170 merges and the hub restarts, recorded on this item; it is not a merge-gate criterion. Amended by the Coordinator 2026-10-11 23:43Z.
  - done: impl-170 · 2026-10-11T23:47:29.819Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T170-2 · 2026-10-12T01:17:54.816Z · commit 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd
- [x] C3. A CLI test covers reopen after merge, then push.
  - done: impl-170 · 2026-10-11T23:47:29.989Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T170-2 · 2026-10-12T01:17:54.816Z · commit 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd
- [x] C4. `npm run typecheck && npm test` pass.
  - done: impl-170 · 2026-10-12T01:17:33.076Z
  - verified: rev-17 [reviewer] · run rev-20261012-17-T170-2 · 2026-10-12T01:17:54.816Z · commit 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd

## Notes

Size S. tech-debt.

## Comments

### impl-170 · 2026-10-11T23:40:12.052Z

Regression seam: real CLI merge/task edit/push plus hub topic.send, as requested. Chosen rule: a landed task is complete; later discussion cannot invalidate its merge. Reopening it will refuse with instructions to create a follow-up task, which starts from dev. Cleanup must preserve unmerged work but accept a stale branch already contained in dev.

### impl-170 · 2026-10-11T23:47:30.206Z

Candidate ff5f0079b76ef9ee1747fb437716e78325bea09d pushed to origin after fetching/merging origin/dev (already up to date). C1–C3 done. Protocol regressions reproduced topic push blocking, permissive landed reopen, stale cleanup stuck pending, and Git inspection failure permitting reopen before the fixes; all pass now. Selected lifecycle/cleanup tests (10), pending/rolled-back push (1), post-topic and pending sync (2), and strict reopen tests (2) pass. npm run typecheck passes. Evidence A-1447 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1447-t-170-implementation-and-regression-evidence.md. C4 awaits the full hub suite. QA policy is none; no per-item QA request is required. Live T-165 cleanup remains Coordinator follow-up after integration/restart.

### impl-170 · 2026-10-12T00:04:06.553Z

Full suite e2b097bc at ff5f007 passed typecheck but stopped before tests because launch-recovery.test.ts was unclassified (A-1454). Fetched/merged current origin/dev fae0e78; it already contains the machine classification, so no duplicate manifest fix was needed. Candidate is merge head 058633c with unchanged T-170 implementation. Resubmitting review and exact-head full suite; C4 remains pending.

### impl-170 · 2026-10-12T00:04:55.606Z

Second suite bef10186 at 058633c again passed typecheck but failed admission on the sole remaining unclassified path, termination-ownership.test.ts (A-1457). Added its machine classification as separate commit 26a96ce89c9f28c4c518612784a883620c40511e; it spawns real processes. npm run test:shards now passes for all 123 hub files (5 free, 118 machine). origin/dev fetched/merged again (up to date), new head pushed. T-170 product diff is unchanged. Requesting exact-head review/suite again; C4 still pending.

### rev-17 · 2026-10-12T00:20:25.314Z

verdict: review
result: not clear
by: rev-17 [reviewer]
run: rev-20261012-17-T170-1
commit: 26a96ce89c9f28c4c518612784a883620c40511e

Medium — hub/test/stage-qa.test.ts:122: full-suite fixture asserts successful API reopen of a landed task, contradicting T-170's chosen documented rule. Update it to assert refusal while retaining stage invalidation coverage through controlled external tracker edits (and retain forged-verdict checks). C4 failed: A-1470 typecheck passes, hub tests 1312/1313 with this sole failure, no cancellations/skips; Neovim did not run. C1-C3 code assessment remains clear in A-1449/A-1461; no product defect identified. Re-review corrected committed head and complete exact-head full suite before final clear.

Criteria: C4 failed (Full suite A-1470 fails stage-qa.test.ts:122: fixture expects reopening a landed task to succeed, contrary to the new refusal rule; Neovim suite did not run.).

### impl-170 · 2026-10-12T00:21:31.821Z

A-1470 suite be589416 at 26a96ce passed typecheck and 1312/1313 hub tests, stopping before Neovim. Sole failure was the old stage-qa fixture expecting API reopen of a landed task. Corrected that test in 0f90c86: assert refusal preserves completed stage, then use hand-edited tracker source to retain reopen/restoration and forged-verdict invalidation coverage. Targeted test reproduced red then passed green (1/1). Fetched/merged current origin/dev b03ae7c; pushed clean candidate 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd. Product implementation unchanged. Requesting re-review/full suite at new head; C4 remains pending.

### impl-170 · 2026-10-12T01:17:33.575Z

Final full suite 7846feda-b04c-4f75-b80e-6d694f57e89a at pushed candidate 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd passed typecheck and all 1604 hub/Neovim tests, zero failures/cancellations/skips. Log A-1480: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1480-suite-7846feda-b04c-4f75-b80e-6d694f57e89a-all-at-362ff5f.log. C4 marked done; all four criteria are implemented and tested. Branch is clean. Final Reviewer verdict pending; claim retained until merge. Coordinator's live T-165 cleanup remains the documented post-integration/restart follow-up.

### rev-17 · 2026-10-12T01:17:54.816Z

verdict: review
result: clear
by: rev-17 [reviewer]
run: rev-20261012-17-T170-2
commit: 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd

No remaining findings (high/medium/low); Standards and Spec clear. C1/C3 verified by documented landed reopen refusal/follow-up rule, strict landing inspection, real CLI reopen/push and discussion/push/sync regressions. C2 amended gate verified by safe dev-contained stale cleanup preserving unrelated work and existing dirty/session/unmerged checks; live T-165 cleanup remains Coordinator follow-up excluded from gate. A-1471 obsolete stage fixture corrected with API refusal plus retained hand-edit/restoration/forged-verdict invalidation coverage (A-1473). C4 verified from A-1480: exact unchanged reviewed head, typecheck/full hub and Neovim suites pass 1604/1604, zero failures/cancellations/skips, exit 0. All C1-C4 verified at 362ff5fd42bf8069dc8750b3dcc37c8fba5ca7cd.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-12T01:32:20.683Z

Merged 88ce02b18616f0b719789ffd11d1175f855417ac onto dev.

### coord · 2026-10-12T01:32:37.045Z

Live T-165 cleanup is pending: T-170 merged at 88ce02b after the 01:32Z hub restart, so its cleanup path isn't live yet. The Coordinator removes .cland/worktrees/T-165 (branch 6cfef96, contained in dev) through cland after the next restart, and records it here.
