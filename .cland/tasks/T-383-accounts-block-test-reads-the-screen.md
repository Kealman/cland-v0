---
id: T-383
kind: task
title: Accounts-block test reads the screen before both account rows land (sessions.test.ts:274 under load)
state: open
status: ready
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
updated: 2026-10-14T17:53:27.797Z
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
  - verified: rev-26 [reviewer] · run rev-20261014-383-source-2 · 2026-10-14T16:09:00.968Z · commit be11ca8e3bc84fa039deee6564d9769180b35528
  - verified: rev-26 [reviewer] · run rev-20261014-383-final-1 · 2026-10-14T17:53:24.627Z · commit be11ca8e3bc84fa039deee6564d9769180b35528
- [x] C2. The fix is one test-only commit, so it can be cherry-picked into every live branch.
  - done: impl-383 · 2026-10-14T10:55:45.958Z
  - verified: rev-26 [reviewer] · run rev-20261014-383-source-1 · 2026-10-14T10:56:38.587Z · commit 5df9301a5162d8029476c30f1f43058351d1dab9
  - verified: rev-26 [reviewer] · run rev-20261014-383-source-2 · 2026-10-14T16:09:00.968Z · commit be11ca8e3bc84fa039deee6564d9769180b35528
  - verified: rev-26 [reviewer] · run rev-20261014-383-final-1 · 2026-10-14T17:53:24.627Z · commit be11ca8e3bc84fa039deee6564d9769180b35528
- [x] C3. sessions.test.ts passes 20 consecutive targeted runs under four parallel CPU workers on macOS, run only while the verify queue has no holder.
  - done: impl-383 · 2026-10-14T17:52:56.964Z
  - verified: rev-26 [reviewer] · run rev-20261014-383-final-1 · 2026-10-14T17:53:24.627Z · commit be11ca8e3bc84fa039deee6564d9769180b35528

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

### impl-383 · 2026-10-14T16:05:46.564Z

At be11ca8e3bc84fa039deee6564d9769180b35528: sessions.test.ts passed 4/4 (11.4s). All ten test files imported by T-398/T-382 passed as separate node --test invocations, one at a time: ask-chain, claude-code-accounts, lead-handover, lead-permissions, lead-routing, session-archive, session-holds, stage-qa, task-prefixes, verifier-routing. Head pushed; delta review follows. No verification submission until Coordinator's hub-back post (e0ef4928).

### rev-26 · 2026-10-14T16:09:00.968Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-383-source-2
commit: be11ca8e3bc84fa039deee6564d9769180b35528
scope: delta

No high/medium findings. T-398 and T-382 shared patches match their originals; native observer readiness, signed-out poll accounting and atomic PID/identity publication preserve the tested contracts. nvim/test/sessions.test.ts is unchanged from source-clear 5df9301a; T-383 remains one test-only commit with assertions/timeouts intact. C1/C2 renewed. A-2442 targeted imported files pass; C3 remains pending accepted current-head execution under Coordinator bad298c4/15:57:08, with twenty four-worker stress runs deferred post-merge to the first quiet window. Earlier 780a0e28/A-2435 remains failed. Evidence A-2443: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2443-t-383-delta-source-clear-at-be11ca8e-shared-readiness-and-pid-identity-fixes.md.

Criteria: C1 verified, C2 verified.

### impl-383 · 2026-10-14T17:13:53.152Z

Replacement droplet verification ba071efd/A-2466 at reviewed be11ca8e failed two untouched hub tests before Neovim: executor-safety.test.ts:182 (missing cland-same-live key, then asynchronous image-900/image-901 cleanup ENOENT) and request-guard.test.ts:76 (622ms against 187ms baseline). Linux c-8 lon1, lifetime 1439s, cost $0.0999; 1624 pass, 2 fail, 3 skip. Reported both finds and blocked status to lead; no additional verification run. Targeted sessions and all imported files were green. Await shared-fix/verification decision.

### rev-26 · 2026-10-14T17:14:04.033Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261014-383-evidence-2
commit: be11ca8e3bc84fa039deee6564d9769180b35528
scope: evidence

Medium — hub/test/executor-safety.test.ts:182: live cland-same-live key absent; preservation assertion false. Medium — hub/test/request-guard.test.ts:76: other-client latency622ms against187ms baseline fails the existing bound. Accepted receipt ba071efd/A-2466 is failed: Linux c-8 lon1,1629tests/1624pass/2fail/3skip, Neovim never starts. Both files are outside T-383/shared delta; no cause is inferred and no unrelated criterion is failed. Source C1/C2 clear A-2443 retained; C3 remains pending. No retry authorized; lead has stopped for Coordinator instructions. Evidence A-2468: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2468-t-383-verification-not-clear-at-be11ca8e-linux-hub-failures-stop-before-neovim.md.

### impl-383 · 2026-10-14T17:52:58.274Z

C3 premerge reading is met: solo targeted sessions.test.ts passed 4/4 at be11ca8e; same-head accepted local full verification 64076084/A-2479 passed 2007/2007, 0 skipped, including Neovim. This local run supersedes red droplet ba071efd under human decision 7df2bdac. The Coordinator's 15:57:08 comment still requires 20 consecutive macOS sessions.test.ts runs under four CPU workers postmerge in the first quiet window; those remain to be recorded here, and any failure reopens as a regression.

### rev-26 · 2026-10-14T17:53:24.627Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261014-383-final-1
commit: be11ca8e3bc84fa039deee6564d9769180b35528
scope: evidence

No high/medium findings. Accepted same-head local auto/full 64076084/A-2479 passes both typechecks and2007/2007 (37free,1592hub machine,378Neovim), zero fail/cancel/skip/todo; account screen cases execute and pass. Human/Coordinator7df2bdac explicitly directs this local result to supersede red droplet ba071efd/A-2466; no Linux green claim. Source C1/C2 A-2443 retained. C3 verified under Coordinator15:57:08 premerge reading: solo sessions4/4 plus green full at reviewed head. Twenty four-worker macOS runs remain due postmerge in first quiet window; failure reopens regression. Earlier failed/cancelled receipts retained. Evidence A-2480: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2480-t-383-final-review-clear-at-be11ca8e-same-head-local-full-passes.md.

Criteria: C1 verified, C2 verified, C3 verified.
