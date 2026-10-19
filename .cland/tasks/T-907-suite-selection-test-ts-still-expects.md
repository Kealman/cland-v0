---
id: T-907
kind: task
title: suite-selection.test.ts still expects project-hub.test.ts at T4 after T-901 moved it to T2
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-901
topic: topic-645
branch: t/T-907-suite-selection-test-ts-still-expects
created: 2026-10-19T20:10:25.668Z
updated: 2026-10-19T20:28:47.953Z
closed: 2026-10-19T20:28:47.953Z
---

## Summary

hub/test/suite-selection.test.ts "a remote fixture diff retains the T4 harness self-tests" fails on dev since T-901 (ab53036f). It still asserts that hub/test/project-hub.test.ts is T4, but T-901 moved that file to T2 and split its native transport cases into project-hub-lifecycle.test.ts at T3. The case is T2, so the T1-only batch did not run it; impl-667 found it at 20:10Z.

## Acceptance criteria

- [x] C1. (T2) The case's T4 harness self-test list matches the manifest: remote-fixture-lifecycle, prepared-project and account-fixture-isolation, without project-hub. Each still waits for an occasion and stays in occasion verification. hub/test/suite-selection.test.ts passes 96/96 on dev.
  - done: impl-907 · 2026-10-19T20:16:11.249Z
  - verified: rev-31 [reviewer] · run rev-20261019-907-final · 2026-10-19T20:20:03.637Z · commit a40759fc9579182ca8bf1bf0dbcb5e83de123bf4

## Comments

### impl-907 · 2026-10-19T20:10:51.818Z

Implementing the assigned one-line shared fix: remove project-hub from the T4 fixture expectation only. Targeted suite-selection tests and root typecheck precede source review; no QA policy applies.

### rev-31 · 2026-10-19T20:12:48.911Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-907-source
commit: a40759fc9579182ca8bf1bf0dbcb5e83de123bf4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

One-line source clear: removes only project-hub from the T4 expectation list, matching exact manifest T2/T3 split. Remaining three T4 fixtures retain tier/exclusion/occasion inclusion assertions; no product, allowance or other assertion changes. A-6583/A-6582. Final C1 awaits unchanged-head configured mode-free receipt plus original local96/96 stdout; changed file is manifestT3, so task gate must not be claimed as its execution. No task-head full run requested.

### impl-907 · 2026-10-19T20:15:14.556Z

Source review clear at a40759fc. Repeated targeted suite-selection test once at unchanged reviewed head to replace the earlier run that overlapped the pre-review fast-forward: 96/96 pass, exit 0, 35.773s; complete raw stdout and identical initial/final HEAD in A-6596. Mode-free verify e51c815b-5a64-48fa-b5c8-dbca1b31095d admitted; awaiting hub result.

### rev-31 · 2026-10-19T20:20:03.637Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-907-final
commit: a40759fc9579182ca8bf1bf0dbcb5e83de123bf4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6607 independently audits same-head configured mode-free e51c815b/A-6601: 513/513 ordinary, 305/305 repeated test finishes, all 61 groups 5/5, no non-pass, tier mismatch or budget diagnostics; exit 0. Separate fixed-head A-6596 supplies complete 96/96 suite-selection execution, matching initial/final SHA and exit 0; changed case passes in 1.864421375s, file 35.773239167s. This replaces the earlier mixed-head local run as fixed-head evidence. Source A-6583 retains the three true T4 self-tests and their occasion assertions while removing only the stale project-hub entry. C1 final verified. The configured task gate does not execute this T3 file; Linux T3 remains periodic/integrated evidence.

Criteria: C1 verified.

### impl-907 · 2026-10-19T20:24:22.978Z

Landing batch T-717 + T-907 failed run e3751df8-cbf1-4bcc-a87d-80b6b5b62bad in hub/test/verification-commands.test.ts :: recorded commands compose configured batch tiers with periodic T3 (A-6620). Reported shared-defect candidate to lead T-907; holding diagnosis/head changes pending Coordinator's shared fix. Reviewed task head a40759fc and its green task verification remain unchanged.

### coord · 2026-10-19T20:28:47.953Z

Merged dbff8532be1b7988cd7cc35696376e13e1174973 onto dev.
