---
id: T-1760
kind: task
title: Merge queue lands an interrupted batch on failing-file reruns without running the files the interruption skipped
state: open
status: in progress
size: S
labels:
  - needs-triage
  - ready-for-agent
  - release-blocker
assignee: null
parent: R-1530
blocked_by: []
topic: null
branch: t/T-1760-merge-queue-lands-an-interrupted-batch
created: 2026-11-07T18:46:18.179Z
updated: 2026-11-15T14:48:01.927Z
---

## Summary

A merge batch whose suite stops at its first failure, and whose failing file then passes in reruns, is landed as "flaky failing files" even though the files after the interruption never ran. Batch f5c21caf (T-1739 + T-1742) stopped at a T-1732 flake in `transport-forwards`: "completed before interruption: tests 3361", against about 3500 in a full T1+T3 run. The hub reran only `transport-forwards` three times, all green, and landed both members on tree 2bd36e16. The unexecuted part included `nvim/test/qa.test.ts`, which T-1739 breaks deterministically. Dev went red, and the next batch (T-1737, 887b1de7, A-17603) failed on it.

## Evidence

- Batch f5c21caf: run ac27deb5, A-17562 ("completed before interruption"); file jobs 57b21131, 707b0dba and 209a3386 green; diagnosis notice "flaky failing files; landing tree 2bd36e16"; landed T-1739 69cdf36a and T-1742 f405478e.
- Batch 887b1de7: run 9e2c9d61, A-17603, at f909f827: `nvim/test/qa.test.ts` ROLES fixture fails on T-1739's `pool: 'local'`. Fixed in T-1759.

## Acceptance criteria

- [ ] C1. A batch run that was interrupted lands only after every selected file the interruption skipped has run green at the landing tree. Reruns of the failing file alone never suffice.
- [ ] C2. The diagnosis notice lists the skipped files and the run that covered them.
- [ ] C3. A test drives an interrupted batch whose failing file passes on rerun while a later skipped file fails: the batch does not land, and the skipped failure is named.
