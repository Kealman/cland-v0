---
id: T-219
kind: task
title: "Delete an artifact from the browser: x with confirmation, a human-only delete frame"
state: closed
status: done
criterion_seq: 4
labels:
  - ready-for-agent
assignee: impl-219
parent: T-115
blocked_by:
  - T-195
topic: topic-132
branch: t/T-219-delete-an-artifact-from-the-browser-x
created: 2026-10-11T08:59:55.948Z
updated: 2026-10-11T14:07:22.774Z
---

## What to build

Spec §3.6 says `x` in the Artifacts browser deletes an artifact after a confirmation. T-193 and T-194 expose no deletion: there's no `artifact.delete` frame, tool or CLI. T-195 ships the browser without `x`. This item adds the missing deletion end to end.

## Acceptance criteria

- [x] C1. A UI protocol frame for deleting an artifact. Only the human may use it, and agent sessions get no tool for it. It removes the file and updates the index, and the browser and topic chips see an event.
  - done: impl-219 · 2026-10-11T11:46:11.399Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T219-r4 · 2026-10-11T14:06:55.327Z
- [x] C2. `x` in the Artifacts browser asks for confirmation and deletes through that frame. Cancelling the confirmation leaves the artifact untouched.
  - done: impl-219 · 2026-10-11T11:30:38.585Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T219-r4 · 2026-10-11T14:06:55.327Z
- [x] C3. A deleted artifact's chip in topic history renders as deleted instead of failing to open.
  - done: impl-219 · 2026-10-11T11:41:29.938Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T219-r4 · 2026-10-11T14:06:55.327Z
- [x] C4. Protocol tests cover the refusal for agent sessions, the index and event update, and a delete of a moved artifact. A Neovim test covers confirm and cancel. `cland suite all` passes.
  - done: impl-219 · 2026-10-11T14:06:37.281Z
  - verified: rev-15 [reviewer] · run rev-20261011-15-T219-r4 · 2026-10-11T14:06:55.327Z

Deferred from T-195 (impl-195b's question in topic-125, 2026-10-11).

## Comments

### impl-219 · 2026-10-11T11:23:20.069Z

Claimed in the provisioned T-219 worktree at dev 1697ced. Implementing human-only UI deletion, moved-artifact handling, browser confirmation and deleted topic chips with targeted protocol/Neovim regression tests.

### impl-219 · 2026-10-11T11:29:20.993Z

Implemented at 91d06f9. Protocol deletion tests (3) and browser confirm/cancel test pass; 26 artifact lifecycle regressions pass and typecheck passes. Local two-axis review is running before the final full suite. No per-item QA is required (qaPolicy scope none).

### impl-219 · 2026-10-11T11:32:58.923Z

Final implementation head 6a1873324c3797a00f87575f128ece4ab1b40c5d pushed to origin. Local Standards review: zero documented violations; possible result-type name smell fixed. Local Spec review found protocol validator fallthrough and moved deletion recovery gap; both fixed, recheck reports no remaining concrete issue. Targeted protocol 4/4, lifecycle 27/27, browser confirm/cancel 1/1 and Neovim artifacts 9/9 pass. origin/dev fetched and merged (already current). Implementation artifact A-1220 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1220-t-219-implementation-and-verification.md. C1-C3 marked done; C4 awaits full suite.

### rev-15 · 2026-10-11T11:35:55.532Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T219
commit: 6a1873324c3797a00f87575f128ece4ab1b40c5d

Standards:
High — hub/src/hub/artifact-lifecycle.ts:325: routine prune treats valid notes.md.retained folder contents as notes.md's deletion backup and unlinks them after EEXIST, violating §3.6 human/Aide lifetime. Use durable delete intent/owned backup storage.
Spec:
High — hub/src/hub/artifact-lifecycle.ts:325: the same recovery path deletes/substitutes unrelated files without a delete request.
Medium — hub/src/hub/artifact-lifecycle.ts:314: move can commit before old-source unlink fails; later deletion removes only destination, and tombstoned moved/folder cleanup skips the original hard link forever. Remove verified leftover originals while preserving different files recreated at old paths.
Medium — nvim/lua/cland/thread.lua:329: live attachment-only chips are not refreshed; merge compares singular artifact but ignores artifacts arrays (:891). With creation outside retained history, fileDeleted lookup never rerenders that block. Update affected attachment blocks and cover an already-open thread.
C1/C3 failed; C2 confirmed/cancel behavior established. C4 final full suite pending. Detailed review A-1221 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1221-t-219-review-not-clear-at-6a18733.md. No Reviewer edits or tests.

Criteria: C1 failed (Recovery infers ownership from .retained filenames and deletes unrelated folder contents; deleting a moved artifact after failed move housekeeping leaves original stored bytes.), C3 failed (An already-open attachment-only chip stays unmarked after deletion because Thread:merge ignores artifacts-array changes.).

### impl-219 · 2026-10-11T11:41:48.474Z

Addressed review not-clear rev-20261011-15-T219 at new pushed head 862479887146d0764026b0aec43b744b80c585f2: durable indexed intent with UUID backup storage outside artifact folders, verified old hardlink cleanup preserving independent recreated files, and live attachment-only Thread.merge updates. Regression coverage passes: lifecycle 34/34, protocol 4/4, attachment-only real Neovim 1/1; typecheck passes. Local Standards recheck zero documented violations, local Spec recheck no blockers. Full repair artifact A-1225 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1225-t-219-review-repairs-at-8624798.md. origin/dev fetched/merged before final suite (already current).

### rev-15 · 2026-10-11T11:43:56.938Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T219-r2
commit: 862479887146d0764026b0aec43b744b80c585f2

Standards:
Medium — hub/src/hub/artifact-lifecycle.ts:217: immediate rollback blindly renames backup over resolved.path. A save after the backup rename can recreate that path; failed tombstone write then overwrites the independent bytes. Preserve both files and durable intent on conflict, as recovery already does at :256.
Spec:
Medium — hub/src/hub/artifact-lifecycle.ts:217: same rollback loses supported external-editor edits (§3.6) after failed deletion. Regression should recreate live content after backup rename, reject tombstone commit, and verify neither copy is overwritten.
All three previous findings resolved: durable private backup intent removes .retained collision, inode-verified cleanup handles file/folder leftover links and preserves independent old-path files, artifacts-array merge refreshes live attachment-only chips. C2/C3 established; C1 fails on rollback conflict. C4 fresh full suite pending; prior-head run excluded. Review artifact in topic-132. No Reviewer edits or tests.

Criteria: C1 failed (Failed tombstone commit blindly restores backup over a live path recreated by an editor, losing independent human bytes.).

### impl-219 · 2026-10-11T11:46:28.236Z

Fixed review r2 rollback conflict at pushed head 6ae107ace199856e5615327845a22140ce1207c8. Immediate rollback shares durable recovery; independent editor saves and backups survive conflicts, file restoration is exclusive, and same-inode restore housekeeping retries safely. Lifecycle suite file 36/36 passed. Local Standards and Spec affected-path rechecks found no blockers, Spec independently ran both new regressions (2/2). A-1228: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1228-t-219-rollback-repair-at-6ae107a.md. origin/dev fetched and merged, already current. Full suite submission awaits the previous queued/running job result; no final C4 evidence yet.

### impl-219 · 2026-10-11T12:12:28.597Z

Coordinator requested shared moved-draft load-race fix. Cherry-picked T-171 commit 7eb519c as 5b8d821, fetched and merged latest origin/dev (T-199), and pushed integrated head 3f9ce55e369eab65e8bd2ffac1d5790f248114b5. Verified the old queued suite recorded 6a18733; cancelled its worker with SIGTERM as instructed. Interrupted result is A-1245 (exit 143, no completed suite evidence). Re-requesting review and full cland suite all at the integrated head. T-219 implementation itself remains code-clear from rev-15 at 6ae107a.

### rev-15 · 2026-10-11T13:01:32.505Z

verdict: review
result: not clear
by: rev-15 [reviewer]
run: rev-20261011-15-T219-r3
commit: 3f9ce55e369eab65e8bd2ffac1d5790f248114b5

Standards: code clear; no new findings, A-1229/A-1250 remain applicable.
Spec: C1–C3 remain established; earlier deletion/rollback findings resolved.
Medium — qa/cases/PANELS-012.lua:33 (nvim/test/qa.test.ts:96): exact-head full suite97d22e38 fails screen assertion in work contains Work review. A-1264 shows T-12 in REVIEW with clipped title Work re… for Reviewer and state title Work review; root cause/reproducibility not established. QA case/runner have no task-owned diff.
Typecheck passes; hub1226/1226, Neovim273/274, total1499/1500, sole PANELS-012 failure, zero cancelled/skipped/todo, raw exit1, peakload15.18. Task-specific protocol/lifecycle/deletion/confirm-cancel coverage passes, but C4 full gate does not. No applicable acceptance exception established. Follow-up artifact records full evidence; no Reviewer edits/tests.

Criteria: C4 failed (Exact-head full suite97d22e38 exits1: PANELS-012 fails Work review screen assertion at qa/cases/PANELS-012.lua:33; Neovim273/274.).

### impl-219 · 2026-10-11T13:04:07.488Z

Coordinator-approved canonical PANELS-012 test-only timing fix committed separately as d114dc0c9628ac54dc71ab71ec7695bdaad77527. Changed only the wait condition to Work review, preserving all assertions/timeouts/width. Original failure reproduced1/6 on untouched dev4846a44; fix passed12/12 targeted repetitions. A-1266: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1266-t-219-canonical-panels-012-timing-repair.md. Fetched/merged latest origin/dev b1add76 and pushed integrated head4a360d549a7da73ede45d878a6929d1f996918f9. C4 awaits new full suite.

### impl-219 · 2026-10-11T14:06:37.441Z

Final full cland suite all d98b795b-1edb-490d-9651-dd152dc18d32 passed at exact pushed head4a360d549a7da73ede45d878a6929d1f996918f9: exit0,1501/1501 passed, no failures/skips/cancellations. C4 marked done. Durable log A-1281: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1281-suite-d98b795b-1edb-490d-9651-dd152dc18d32-all-at-4a360d5.log. Rev-15's code-clear assessment at this head is A-1267; final review verdict pending. All acceptance criteria are implemented; claim retained for the supervising merge.

### rev-15 · 2026-10-11T14:06:55.327Z

verdict: review
result: clear
by: rev-15 [reviewer]
run: rev-20261011-15-T219-r4
commit: 4a360d549a7da73ede45d878a6929d1f996918f9

Standards: clear; no unresolved findings. Parallel final-head A-1267 establishes unchanged deletion repair through integration and wait-only canonical PANELS-012 fix with all assertions/timeouts/width retained.
Spec: clear. C1 human-only UI delete protocol/index/events and safe owned backups/moved-source cleanup/rollback established; prior .retained ownership and editor-save overwrite findings resolved. C2 x confirm/cancel preserves bytes on cancel. C3 deleted history and live attachment-only chips refresh safely. C4 exact-head full suited98b795b/A-1281: typecheck pass, hub1227/1227, Neovim274/274, total1501/1501, rawexit0, zero failures/cancelled/skipped/todo. Protocol agent-refusal/index/events/moved-delete, lifecycle safety regressions, Neovim confirm/cancel/attachment-chip and canonical PANELS-012 all pass. No exception needed. AllC1–C4 checked; prior r3 C4 failure superseded by fresh passing evidence. No high/medium findings remain. Final artifact records details; Reviewer made no edits or ran tests.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-11T14:07:22.774Z

Merged 405165dcc2738518bf4e491c821d9c6a69b2b5d2 onto dev.
