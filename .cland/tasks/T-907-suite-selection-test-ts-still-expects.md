---
id: T-907
kind: task
title: suite-selection.test.ts still expects project-hub.test.ts at T4 after T-901 moved it to T2
state: open
status: in progress
size: XS
labels:
  - v0.1.4
assignee: null
parent: C-325
blocked_by: []
regression_of: T-901
topic: topic-645
branch: t/T-907-suite-selection-test-ts-still-expects
created: 2026-10-19T20:10:25.668Z
updated: 2026-10-19T20:10:51.818Z
---

## Summary

hub/test/suite-selection.test.ts "a remote fixture diff retains the T4 harness self-tests" fails on dev since T-901 (ab53036f). It still asserts that hub/test/project-hub.test.ts is T4, but T-901 moved that file to T2 and split its native transport cases into project-hub-lifecycle.test.ts at T3. The case is T2, so the T1-only batch did not run it; impl-667 found it at 20:10Z.

## Acceptance criteria

- [ ] C1. (T2) The case's T4 harness self-test list matches the manifest: remote-fixture-lifecycle, prepared-project and account-fixture-isolation, without project-hub. Each still waits for an occasion and stays in occasion verification. hub/test/suite-selection.test.ts passes 96/96 on dev.

## Comments

### impl-907 · 2026-10-19T20:10:51.818Z

Implementing the assigned one-line shared fix: remove project-hub from the T4 fixture expectation only. Targeted suite-selection tests and root typecheck precede source review; no QA policy applies.
