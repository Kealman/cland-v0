---
id: T-910
kind: task
title: spawn-census.test.ts still expects session-async-processes.test.ts as a census gap after T-897 migrated it
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-897
found_by: cover
topic: topic-652
branch: t/T-910-spawn-census-test-ts-still-expects
created: 2026-10-19T21:22:03.444Z
updated: 2026-10-19T21:46:55.325Z
closed: 2026-10-19T21:46:55.325Z
---

## Summary

The periodic dev T3 run at dd8ee908 (A-6718) fails `hub/test/spawn-census.test.ts::census records all spawn methods once…`. Its `knownGaps(repo)` assertions still name files that the process-helper migration (T-895–T-903) moved out of the census gap list, `hub/test/session-async-processes.test.ts` first among them (T-897). T3 does not run in merge batches, so this reached dev and now blocks the stage covers.

## What to build

The test derives its known-gap expectations from the same source of truth as `knownGaps`, or names files that are still gaps by construction (a fixture), so a migration can't make it stale again. Check all three named files: `cli-imports`, `session-async-processes` and `claude-code-sessions`.

## Acceptance criteria

- [x] C1. `hub/test/spawn-census.test.ts` passes at the head, and the assertion no longer depends on which real files the migration has moved.
  - verified: rev-30 [reviewer] · run rev-20261019-910-source · 2026-10-19T21:24:43.178Z · commit 58002cc9be8aca8da61332c74cf93cae4649cbeb
  - done: impl-910 · 2026-10-19T21:41:57.441Z
  - verified: rev-30 [reviewer] · run rev-20261019-910-final · 2026-10-19T21:42:12.285Z · commit 58002cc9be8aca8da61332c74cf93cae4649cbeb
- [x] C2. The task's mode-free verify includes the T3 file (named by dry-run selection or run as a targeted file), with the receipt in the report.
  - done: impl-910 · 2026-10-19T21:41:58.022Z
  - verified: rev-30 [reviewer] · run rev-20261019-910-final · 2026-10-19T21:42:12.285Z · commit 58002cc9be8aca8da61332c74cf93cae4649cbeb
- [x] C3. The periodic run's duration-budget failure for hub/test/task-worktrees-lifecycle.test.ts::cland session launch --item starts the Implementer in the worktree… (6.984 s > 5 s, A-6718) is resolved by a faster case or a durations.json allowance with a reason, and a T3 run of that file reports no budget failure.
  - verified: rev-30 [reviewer] · run rev-20261019-910-source · 2026-10-19T21:24:43.179Z · commit 58002cc9be8aca8da61332c74cf93cae4649cbeb
  - done: impl-910 · 2026-10-19T21:41:58.619Z
  - verified: rev-30 [reviewer] · run rev-20261019-910-final · 2026-10-19T21:42:12.285Z · commit 58002cc9be8aca8da61332c74cf93cae4649cbeb

## Comments

### impl-910 · 2026-10-19T21:23:06.619Z

Reproduced the stale knownGaps failure locally (spawn-census: 1 pass, 1 fail, 0.465 s). All three named files now lack NODE_OPTIONS/sandbox-exec markers. Replaced assertions against migrated repository files with controlled hub/nvim fixtures for both gap markers plus clean-test/non-test exclusions; removed the remaining real-file assertion from the sandbox case. Coordinator-added C3 uses a dated E-677 allowance at A-6718's observed 6.984 s for the T-896 lifecycle identity; the native CLI/Git/harness case stays inside T3's 10 s tier budget.

### rev-30 · 2026-10-19T21:24:43.179Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-910-source
commit: 58002cc9be8aca8da61332c74cf93cae4649cbeb
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-6725. Controlled hub/nvim marker fixtures plus clean-test/non-test negatives remove all real-file gap assumptions while preserving native census assertions. Direct Coordinator allowance approval read; exact migrated key/reason6.984 s, seven-day E-677 allowance. Independent A-6724 census2/2 and A-6722 lifecycle3/3, zero fail/cancel/skip/TODO or budget/resource failure; launch5.527300708 s, legacy report-only5 s comparison disclosed. C1/C3 verified as qualified targeted host evidence. C2 retains targeted census portion but awaits exact-head mode-free overall green. No Linux T3/full census claim; QA none; no Reviewer execution.

Criteria: C1 verified, C3 verified.

### impl-910 · 2026-10-19T21:41:51.180Z

Exact reviewed head 58002cc9be8aca8da61332c74cf93cae4649cbeb passed mode-free verify 0f8108db-ab84-43b4-b207-8988496da6bd, A-6735: exit 0, 1892/1892 pass, zero fail/cancel/skip/TODO. Linux x64 c-8 lon1, 977 s executor lifetime, $0.0678. Duration manifest edit caused all-T2 fallback; T3 is excluded by the queue-enabled task plan, so C2 uses the same-source local T3 census receipt A-6724 (2/2 pass) and C3 lifecycle receipt A-6722 (3/3 pass, no duration-budget failure). Source clear A-6725; awaiting Reviewer final evidence verdict.

### rev-30 · 2026-10-19T21:42:12.285Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-910-final
commit: 58002cc9be8aca8da61332c74cf93cae4649cbeb
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear, A-6736. Independently audited A-6735/0f8108db at exact source-clear head: 1892/1892, zero fail/cancel/skip/TODO, all 301 load groups 5/5, zero tier/resource mismatch or owned budget failure. Queue task excludes T3; C2 combines this mode-free green with its expressly permitted targeted census receipt A-6724 (2/2, explicit T3 target, zero failures/budget failure). A-6722 retains 3/3 lifecycle T3 passes and no duration-budget failure under the reviewed exact-key allowance. Source A-6725 plus these receipts settle C1–C3. Targeted native receipts are local Mac evidence; no Linux T3 or full repository census claim. Known report-only diagnostics need no new aside. QA none; no Reviewer tests.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-19T21:46:55.325Z

Merged 9db188d678d8e2ece1cd017ee216de63ebbf266b onto dev.
