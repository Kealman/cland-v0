---
id: T-2064
kind: task
title: Under load the merge tests merge before the reviewed task's ready status and review freshness settle, so merge-policy and merge-recovery-native fail with review-pending or merge-not-ready on macOS
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
regression_of: T-2055
found_by: cover
topic: null
branch: t/T-2064-under-load-the-merge-tests-merge-before
created: 2026-11-23T18:41:27.464Z
updated: 2026-11-23T18:41:54.857Z
---

## Summary

macOS epic cover 857f8e7c (2026-11-23, dev 40f68c7d9, A-22674, local darwin arm64, peak load 7.1) failed three T3 cases:
- `hub/test/merge-policy.test.ts › queue-enabled reviewed documentation lands immediately with its review receipt`, with `review-pending: T-1: review is still checking freshness; try again`;
- `merge-policy.test.ts › enqueue refuses a conflicting queued member immediately with its item and files`, which got `review-pending` where it expected `merge-conflict`;
- `hub/test/merge-recovery-native.test.ts › a close write failure reports merged follow-up failure; retry closes and prunes without a second commit`, with `merge-not-ready: T-1: status backlog; ready required`.

Both files pass at load about 3 on the same Mac and commit (26/26 and 12/12), and they passed on Linux batches and covers. The cause is timing: since T-2050 (ready waits for a completed same-head receipt) and T-2055 (merge admission requires ready and a receipt), these fixtures call merge before the asynchronous review-freshness and ready transitions have settled.

## What to build

Make each case wait for the task's observable ready state, and for review-freshness settlement, through the public seam before it merges. That's an owner wait with a named setup bound, not a fixed delay. Alternatively, have the fixture create the state synchronously. Check whether `review-pending … try again` right after a fresh verdict is also a production papercut for a CLI `cland merge`. If it is, report it as a separate finding; keep this item to the tests unless the fix is trivial. Search every merge-path test that merges right after a verdict (rule 20), the T2 and T3 merge and merge-queue files included.

## Acceptance criteria

- [ ] C1. The three named cases pass 5/5 on macOS under an added CPU load of about 7, and still pass on Linux (evidence).
- [ ] C2. Every merge-path test that merges right after a verdict waits on the observable ready or freshness state instead of racing it, listed in the item (test).
