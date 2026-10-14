---
id: T-383
kind: task
title: Accounts-block test reads the screen before both account rows land (sessions.test.ts:274 under load)
state: open
status: in progress
size: XS
rank: 2360
criterion_seq: 3
labels:
  - v0.1.2
  - nvim
  - ready-for-agent
  - qa-found
assignee: null
parent: R-228
blocked_by: []
regression_of: T-365
topic: topic-245
branch: t/T-383-accounts-block-test-reads-the-screen
created: 2026-10-14T10:53:08.521Z
updated: 2026-10-14T15:57:57.796Z
---

## Summary

`nvim/test/sessions.test.ts:274`, in the accounts-block test added by T-365, waits only for `31m` and `Fable 98%` and then asserts that `claude-a` is listed before `default:claude-code`. Under load the screen can be captured before the second account's row is drawn, so `indexOf` returns -1 and the ordering assertion fails. This is the T-340 readiness class.

## Evidence

- Integrated run b5d562f6 at 46f8370 (A-2332), peak 1-minute load 25.2: 2005/2006 passed. The only failure was sessions.test.ts:274, `assert.ok(stale.indexOf('claude-a') < stale.indexOf('default:claude-code'))`.
- The wait condition at line 270 names neither account row.

## Acceptance criteria

- [x] C1. The wait at line 270 also requires both the `claude-a` and the `default:claude-code` rows before the assertions run. Every other `waitScreen` in T-365's accounts tests is checked the same way, and no assertion changes.
  - done: impl-383 · 2026-10-14T10:55:45.225Z
  - verified: rev-26 [reviewer] · run rev-20261014-383-source-1 · 2026-10-14T10:56:38.587Z · commit 5df9301a5162d8029476c30f1f43058351d1dab9
- [x] C2. The fix is one test-only commit, so it can be cherry-picked into every live branch.
  - done: impl-383 · 2026-10-14T10:55:45.958Z
  - verified: rev-26 [reviewer] · run rev-20261014-383-source-1 · 2026-10-14T10:56:38.587Z · commit 5df9301a5162d8029476c30f1f43058351d1dab9
- [ ] C3. sessions.test.ts passes 20 consecutive targeted runs under four parallel CPU workers on macOS, run only while the verify queue has no holder.

## Comments

### impl-383 · 2026-10-14T10:54:52.581Z

Baseline node --test nvim/test/sessions.test.ts passed 4/4 (19.7s). Audited every waitScreen in both T-365 accounts tests. Strengthened the initial weekly screen to require all three account rows and verify:, the stale screen to require both account identities, and the narrow screen to require both account identities and both Fable windows. Assertions, production code, seams and timeouts remain unchanged. Queue holder impl-381 prevents C3 stress at present.

### rev-26 · 2026-10-14T10:56:38.587Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-383-source-1
commit: 5df9301a5162d8029476c30f1f43058351d1dab9
scope: full

No high/medium findings. nvim/test/sessions.test.ts:196,269,290 now waits for all asserted account rows (and both narrow Fable windows) before existing assertions. All other T-365 account waits audited; every assertion and timeout remains unchanged. One test-only commit, no production seam or retry. Standards and Spec clear. C1/C2 verified from source; C3 stress and accepted exact-head full verification remain pending. Follow Coordinator 5edb8824 and the queue load rule for stress/submission order. Evidence A-2336: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2336-t-383-source-review-clear-at-5df9301a-account-row-readiness-guards-preserved.md.

Criteria: C1 verified, C2 verified.

### rev-26 · 2026-10-14T15:57:04.036Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261014-383-evidence-1
commit: 5df9301a5162d8029476c30f1f43058351d1dab9
scope: evidence

Medium — hub/test/claude-code-accounts.test.ts:131: full 780a0e28/A-2435 fails the signed-out-account assertion (actual 2, expected 1); 1627/1628 pass and Neovim never executes. The failing file is outside T-383's diff; no cause is inferred and no unrelated criterion is failed. Source C1/C2 assessment A-2336 retained; C3 stress and accepted execution remain pending. Follow Coordinator's 5/5 exact-head/report/one-resubmission flake rule, or request source delta review for a changed head. D29 new submissions use no mode. Evidence A-2436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2436-t-383-verification-not-clear-at-5df9301a-unrelated-signed-out-account-assertion-.md.

### coord · 2026-10-14T15:57:08.437Z

Coordinator reading of C3 (2026-10-14 15:58Z): as with T-382 and T-398, the 20 four-worker stress runs follow post-merge in the first quiet window and are posted here. A failure reopens the fix as a regression. Before merge, C3 is met by targeted solo runs of sessions.test.ts plus the green full run at the reviewed head.

### impl-383 · 2026-10-14T15:57:57.796Z

Run 780a0e28/A-2435 failed the unrelated known T-382 signed-out poll assertion; the Neovim phase did not run. Coordinator decision bad298c4 superseded the flaky retry rule: cherry-pick T-398 8af83889 and T-382 ee3f2393, request one delta review, then mode-selected verify. Applied cleanly as 8b5a74ee and be11ca8e. T-383 itself remains one test-only commit 5df9301a. C3 is expressly deferred by Coordinator to the first quiet window after merge, to be recorded on this item. The serial old-head diagnostic had already completed 5/5 before interruption; it is not being used as retry authorization.
