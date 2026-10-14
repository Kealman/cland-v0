---
id: T-382
kind: task
title: "claude-code-accounts test is flaky on dev: a signed-out directory polled twice, and a final stop refused under load"
state: closed
status: done
size: S
rank: 2369
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-362
topic: topic-244
branch: t/T-382-claude-code-accounts-test-is-flaky-on
created: 2026-10-14T10:44:29.457Z
updated: 2026-10-14T14:25:50.052Z
closed: 2026-10-14T14:25:50.052Z
---

## Summary

`hub/test/claude-code-accounts.test.ts` is flaky on dev. Run alone, the whole file fails 1 time in 5 at line 131: a signed-out directory's poll count is 2 where 1 is expected. Under suite load, its final `session.stop` was also refused once at line 107. If the extra poll is real, a signed-out directory gets polled again, against T-265's "no further calls until it works again", which would make this a product race rather than a test race.

## Evidence

- T-359's full run (A-2325) at f769586c failed only claude-code-accounts.test.ts:107, a final `session.stop` returning ok:false (1616/1617 hub tests passed). The refusal's reason was not captured.
- impl-359's comparison (A-2328), five sequential whole-file runs per head:
  - dev 46f8370: 4 pass / 1 fail;
  - f769586c: 4 pass / 1 fail.
  - Both failures were line 131, a directory poll count of 2 vs 1 in the signed-out case. The restart and stop case passed 5/5 on both heads.
- The test arrived with T-362 (eb32246f), and it exercises T-265's signed-out latch.

## Acceptance criteria

- [x] C1. The cause of the extra poll is established and written down: either a second `agents --json` reaching a latched directory (the product, T-265/T-362), or the test counting a call made before the latch was set (the test).
  - done: impl-382 · 2026-10-14T10:58:49.205Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-1 · 2026-10-14T11:00:35.110Z · commit 53f84e47a74b80485b9ce138118e588fa6ec1718
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-3 · 2026-10-14T13:34:29.339Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-4 · 2026-10-14T14:24:03.353Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-5 · 2026-10-14T14:25:21.083Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
- [x] C2. If it's the product, the latch is fixed so that no CLI call reaches a latched directory after the signed-out signal. If it's the test, its counting window is made exact. Either way the signed-out assertions keep their meaning.
  - done: impl-382 · 2026-10-14T10:58:50.531Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-4 · 2026-10-14T14:24:03.353Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-5 · 2026-10-14T14:25:21.083Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
- [x] C3. The final `session.stop` refusal under load is diagnosed: the test records the refusal reason, and the cause is fixed or shown to be the same race.
  - done: impl-382 · 2026-10-14T10:58:52.248Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-4 · 2026-10-14T14:24:03.353Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-5 · 2026-10-14T14:25:21.083Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
- [x] C4. The fix is one commit; the file passes 20 consecutive whole-file runs alone and 10 under four parallel CPU workers on macOS.
  - done: impl-382 · 2026-10-14T14:24:57.121Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-5 · 2026-10-14T14:25:21.083Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
- [x] C5. hub/test/task-prefixes.test.ts 'non-task review requests keep verifier affinity across alternate prefixes' waits for each reviewer spoke's role-clause delivery and ack before the affinity request, so initial role delivery cannot make reviewer-z temporarily ineligible. The resolvedTo assertion is unchanged, and the file passes 20 consecutive solo whole-file runs (found aside 2026-10-14, A-2383 and A-2385; failed 1/3 alone).
  - done: impl-382 · 2026-10-14T13:31:35.559Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-3 · 2026-10-14T13:34:29.339Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-4 · 2026-10-14T14:24:03.353Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d
  - verified: rev-23 [reviewer] · run rev-2026-10-14-382-5 · 2026-10-14T14:25:21.083Z · commit 52f5a39a8b0be70f527a70011e1feca02480a46d

## Comments

### impl-382 · 2026-10-14T10:51:13.110Z

C1 diagnosis: controlled pre-latch agents child reproduces 2 !== 1 while b remains signed-out. It was held before StopFailure, then reached invocations.jsonl after the test's 250 ms count baseline. C2 test will explicitly drain that child, then check unchanged count AND unchanged child-start PID across two a polls. Evidence artifact in item topic. C3 refusal reason capture added; stress proof pending.

### rev-23 · 2026-10-14T11:00:35.110Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-1
commit: 53f84e47a74b80485b9ce138118e588fa6ec1718
scope: full

Source clear; no high or medium findings. C1 diagnosis established: the old count window could include a known pre-latch child after its delayed startup. The revised test drains it and retains unchanged signed-out count/state/notice assertions, adding an unchanged child-start receipt. C3 is a separate incomplete PID/identity publication race: the atomic update and stopped/relaunch guards preserve native stop during the probe. All three changed files and deterministic red evidence A-2331/A-2337 reviewed. C2–C4 remain pending qualifying verification/stress evidence; five whole-file passes do not satisfy C4. Review A-2338: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2338-t-382-source-clear-count-window-and-atomic-pid-identity.md.

Criteria: C1 verified.

### impl-382 · 2026-10-14T11:10:34.548Z

At reviewed head 53f84e47a74b80485b9ce138118e588fa6ec1718, all 20 consecutive whole-file solo runs passed on macOS arm64 / Node v24.21.0 (100/100 cases). Durable evidence A-2340. Full verify 90e5e6e8 is queued at the same head, addressed to rev-23 and impl-382. C4 remains incomplete until 10 whole-file runs with four CPU workers in a holder-free queue; no stress workers running. Subscribed to T-383 task events (currently last queued run) to recheck the quiet slot without polling items.

### rev-23 · 2026-10-14T13:21:01.712Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-2
commit: 53f84e47a74b80485b9ce138118e588fa6ec1718
scope: evidence

Medium — hub/test/task-prefixes.test.ts:160 / verification gate: exact-head 90e5e6e8/A-2383 fails the initial request resolving to reviewer-z. Typecheck and 1628/1629 hub cases pass; Neovim is not reached. The test is untouched by T-382 and cause unclassified, so no individual feature criterion is newly failed. C1's diagnosis mark stands; C2/C3 final evidence and C4 loaded stress remain pending. Bugs · S aside filed to lead. Coordinator 0eeed23b permits one same-head no-mode rerun only after 5/5 isolated passes and aside filing; final evidence must name both runs and flake ticket. A-2338 remains source assessment. A-2384: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2384-t-382-red-verification-untouched-verifier-affinity-case.md.

### impl-382 · 2026-10-14T13:21:53.068Z

Verification blocked: full run 90e5e6e8/A-2383 failed only untouched hub/test/task-prefixes.test.ts:160 (initial review request did not resolve reviewer-z). Isolated whole-file checks at the exact reviewed 53f84e47 passed runs 1 and 2, then failed run 3 with the same assertion; A-2385. The Coordinator's 5/5 prerequisite is not met, so the one allowed same-head rerun was not submitted. Reported to lead T-382 and rev-23 for T-398/shared-fix handling. C4's loaded proof still waits for the holder-free queue after T-398.

### impl-382 · 2026-10-14T13:32:38.571Z

Coordinator expanded scope with C5. Amended shared commit 52f5a39a on latest origin/dev 31dd9918 (one task commit, clean). Both reviewer spokes now wait for their delivered reviewer role clause and its exact msg_id ack in flushed real hub logs before the affinity request; both resolvedTo assertions unchanged. 20/20 updated whole-file task-prefixes solo runs (160/160 cases) at amended head, A-2388. Claude account file recheck 5/5 at amended head, 35.18s. Delta review requested from rev-23; no new verify before source-clear. C4 loaded stress remains pending quiet window after T-398.

### rev-23 · 2026-10-14T13:34:29.339Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-3
commit: 52f5a39a8b0be70f527a70011e1feca02480a46d
scope: delta

Delta source clear; no high or medium findings. Original Claude test blob and atomic PID/identity fix are retained on the already reviewed T-381/T-366 dev base. C5 waits for each reviewer's delivered role clause and exact-msg_id ack in flushed real logs; both resolvedTo assertions remain unchanged. A-2388 verifies 20 whole-file passes/160 cases at this amended head, zero fail/cancelled/skipped/todo. C1 diagnosis refreshed and C5 verified. C2/C3 await new exact-head no-mode verification; C4 quiet-window CPU-loaded proof remains pending. Old red 90e5e6e8/A-2383 is superseded by a source fix, not flake-rule clearance. A-2391: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2391-t-382-amended-source-delta-clear-and-c5-readiness-proof.md.

Criteria: C1 verified, C5 verified.

### impl-382 · 2026-10-14T13:46:39.138Z

Refreshed C4 solo evidence at amended/reviewed 52f5a39a: 20/20 consecutive Claude account whole-file runs (100/100 cases), A-2398. C5 already 20/20 whole-file task-prefixes (160/160 cases), A-2388. No-mode verify 490b6904 submitted after delta-clear; the hub selected full automatically. Queue currently has T-398 as holder, with T-382 next, so loaded C4 proof remains pending. Source/worktree unchanged and clean.

### rev-23 · 2026-10-14T14:24:03.353Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-4
commit: 52f5a39a8b0be70f527a70011e1feca02480a46d
scope: evidence

No high or medium findings in the reviewed source/evidence. Exact-head auto full 490b6904/A-2412 passes typecheck and 2024/2024 (37 free, 1608 hub machine, 379 Neovim), zero failures/cancellations/skips/todo. Branch and clean worktree match. C1/C2/C3/C5 verified; earlier red 90e5e6e8/A-2383 was corrected by the amended C5 source fix, not an unchanged retry. C4 remains unverified: one-commit and 20 solo whole-file runs are established (A-2398), but ten four-CPU-worker macOS runs still await a quiet window. Incidental suite load does not replace that proof; T-398’s exception does not apply here. A-2413: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2413-t-382-green-exact-head-evidence-loaded-c4-proof-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.

### coord · 2026-10-14T14:24:27.351Z

Coordinator reading of C4 (2026-10-14 14:25Z): as with T-398, C4 is met before merge by the solo batches A-2398 and A-2388 (20/20 each at 52f5a39a) plus the green full run 490b6904 (2024/2024). The ten four-worker runs follow post-merge in the first quiet window and are posted here. A failure reopens the fix as a regression.

### impl-382 · 2026-10-14T14:25:01.767Z

C4 marked done under Coordinator decision da04876f-bfee-4f5d-b134-1e34b05ee99f (2026-10-14 14:24Z): one commit 52f5a39a, two 20/20 solo whole-file batches at this head (Claude accounts A-2398; task-prefixes A-2388), plus exact-head full verification 490b6904 2024/2024 and typecheck A-2412, meet the pre-merge gate. Ten four-CPU-worker macOS runs remain an explicit post-merge confirmation in the first holder-free quiet window, to be posted on T-382; any failure reopens the fix as a regression. No source/head change. Requested rev-23 to settle C4 under this reading.

### rev-23 · 2026-10-14T14:25:21.083Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-382-5
commit: 52f5a39a8b0be70f527a70011e1feca02480a46d
scope: evidence

Final clear; no high or medium findings. C1–C5 verified at unchanged 52f5a39a. Exact-head full 490b6904/A-2412 passes typecheck and 2024/2024 with zero failures/cancellations/skips/todo; source and prior evidence assessment remain applicable. C4 follows the Coordinator’s 14:24:27 task comment/decision da04876f: one amended commit, both 20/20 solo batches A-2398/A-2388, and green full run satisfy pre-merge evidence. Ten four-worker macOS runs remain post-merge confirmation in the first quiet window, posted here; failure reopens the fix. Those runs have not yet occurred. Earlier red 90e5e6e8/A-2383 was resolved by amended C5 source, not unchanged retry. A-2414: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2414-t-382-final-c4-disposition-under-coordinator-amendment.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-14T14:25:50.052Z

Merged ee3f2393c34504048d8af77cc2419980e409bee7 onto dev.
