---
id: T-787
kind: task
title: "merge-recovery test: the task worktree still exists after the retried rejected-push merge (Linux, line 325)"
state: closed
status: done
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
regression_of: T-503
topic: topic-486
branch: t/T-787-merge-recovery-test-the-task-worktree
created: 2026-10-18T08:30:15.199Z
updated: 2026-10-18T09:08:33.689Z
closed: 2026-10-18T09:08:33.689Z
---

## Summary

`hub/test/merge-recovery.test.ts`, "a rejected push with failed rollback remains landed and retry restores the root tree before publication completes", failed in integrated cover c232753a (A-5092) at dev a08e40ec on Linux. At line 325 `existsSync(work.path)` was still true after the final retry merge returned. T-503 fixed this exact race at line 50 (the retry reports success before deferred session cleanup removes the worktree) by waiting with `eventually`. This test's last assertion never got the same wait.

## Acceptance criteria

- [x] C1. The final worktree assertion of the rejected-push test waits on an observed removal with the existing eventually helper, as T-503 did at line 50. Every other assertion stays, and the commit records the race.
  - done: impl-787 · 2026-10-18T09:07:39.898Z
  - verified: rev-30 [reviewer] · run rev-20261018-787-final · 2026-10-18T09:07:59.645Z · commit ab37c586899d98af50d9df4045d3a44b62b96829
- [x] C2. No other `existsSync(work.path)` false assertion right after a merge retry in merge-recovery.test.ts is left without the wait.
  - verified: rev-30 [reviewer] · run rev-20261018-787-source · 2026-10-18T09:04:14.505Z · commit ab37c586899d98af50d9df4045d3a44b62b96829
  - done: impl-787 · 2026-10-18T09:07:40.544Z

## Comments

### impl-787 · 2026-10-18T09:00:05.430Z

C1/C2: found and guarded all three remaining false existsSync(work.path) assertions after merge retry using the existing eventually removal predicate; all assertions retained. These checks observe deferred cleanup after merge success, not just publication/closure. Beginning five serial Mac runs, then fetch/lint/typecheck before source review.

### rev-30 · 2026-10-18T09:04:14.505Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-787-source
commit: ab37c586899d98af50d9df4045d3a44b62b96829
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5099. All three remaining immediate removal assertions gain existing bounded eventually waits observing the exact worktree absence; every original assertion remains unchanged. Exhaustive source inspection confirms no unwaited false work.path assertion after retry; C2 verified. Commit records deferred-cleanup boundary and original Linux race. No fixture/production/timeout changes. C1 source requirements inspected clear, final runtime confirmation awaits exact-head droplet. A-5098 reported5/5 Mac and static checks retained; no reviewer execution.

Criteria: C2 verified.

### impl-787 · 2026-10-18T09:07:23.178Z

Exact reviewed-head verification green: run 0e2e6544-4f5e-4522-9dfe-8da6781a7fa2, head ab37c586899d98af50d9df4045d3a44b62b96829, mode-free selection hub-selected. Linux x64 droplet c-8 lon1; 32 passed, 0 failed/skipped; suite 34.95s, machine lifetime 119s, cost $0.0083. Durable receipt A-5100. Reviewer received same-head result for final verdict; claim retained.

### rev-30 · 2026-10-18T09:07:59.645Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-787-final
commit: ab37c586899d98af50d9df4045d3a44b62b96829
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear, A-5101. A-5100 accepted auto/hub-selected exit0,32/32 passes, no failure/cancellation/skip, Neovim smoke complete. All11 top-level merge-recovery identities have positive timing/reporter receipts, including all three corrected retries; no scoped trips. Source A-5099 preserves every assertion and records the deferred-cleanup race. C1 verified, C2 remains current; claimant done marks restored. Report-only duration diagnostic disclosed, no reviewer execution.

Criteria: C1 verified.

### coord · 2026-10-18T09:08:33.689Z

Merged 958efae59cf38937cd5803318b7ecc149e1ff4d5 onto dev.
