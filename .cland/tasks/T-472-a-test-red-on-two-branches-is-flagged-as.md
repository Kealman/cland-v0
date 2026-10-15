---
id: T-472
kind: task
title: A test red on two branches is flagged as a shared dev defect, so it is not chased per branch
state: open
status: planned
size: S
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-470
topic: null
branch: null
created: 2026-10-15T09:13:16.499Z
updated: 2026-10-15T19:07:10.114Z
---

## Summary

Retrospective A-2783, STOP 4: 8 shared fixes were copied into 22 branches, and several implementers chased the same flake separately. When the same test fails in task runs on two different branches, the hub raises one notice to the Coordinator as a shared-defect candidate.

## What to build

The hub keeps the failing test identities of each task verify result for 72 hours. A second distinct branch failing the same `file::test` raises a `shared-defect` notice to the Coordinator, with both runs and logs and the test's last-changing commit. The Implementer clause says to hold rather than diagnose a test so flagged.

## Acceptance criteria

- [ ] C1. Two task runs on different branches failing the same test produce exactly one `shared-defect` notice naming both runs, and the same branch failing twice does not.
- [ ] C2. The notice names the commit that last changed the test.
- [ ] C3. The Implementer and Coordinator clauses describe the notice and the shared-fix path.
