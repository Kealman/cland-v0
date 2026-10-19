---
id: T-870
kind: task
title: "executor-prepare: the stale-snapshot reason is asserted before the deferred inspection finishes (load flake)"
state: open
status: backlog
size: S
labels:
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-19T11:53:07.338Z
updated: 2026-10-19T11:53:07.338Z
---

## Summary

`hub/test/executor-prepare.test.ts` "prepare builds a reusable snapshot, reports its key and replaces it after the committed lock changes" (line ~223) failed once under load at T-666's combined head d188f60c. It expected /stale: base|lock/ and got "unknown (inspection deferred)", so the stale-snapshot inspection had not finished before the assertion. The same head passed the file alone 5/5 (A-6001), and clean dev 702ddf50 passed it 3/3. Evidence: A-5993.

## Acceptance criteria

- [ ] C1. The case waits on an observed boundary: the inspection is completed or its receipt is recorded before asserting the stale reason. Every assertion stays, and a red-to-green proof delays the inspection.
- [ ] C2. The file passes 20/20 serially on the Mac and in the mode-free task verify.
