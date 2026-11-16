---
id: T-1575
kind: task
title: Load gate repeats a helper file instead of the test file that registered a shared contract case
state: open
status: backlog
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-1883
blocked_by: []
topic: null
branch: null
created: 2026-11-01T00:09:14.452Z
updated: 2026-11-16T07:29:06.632Z
---

## Summary

The load gate attributes a new test to the file in whose source the `test()` call sits, and then repeats that file alone. When a shared contract helper registers cases on behalf of a `.test.ts` wrapper, the gate launches the helper, which registers nothing, and fails with `expected one passing receipt`. Found on T-1542's verify 21753a25 (A-15116): `hub/test/host-contract.ts` registers the Host contract cases for its wrapper test file.

Shared contract suites are planned for every Host implementation in E-1531, so this will recur. T-1542 works around it by registering the named cases in the wrapper.

## Acceptance criteria

- [ ] C1. The load gate repeats a new test by launching the test file that the suite run executed when the test was registered, not the source file of its `test()` call, proven by a fixture whose wrapper `.test.ts` imports a helper that registers a case.
- [ ] C2. Duration, budget and tier lines name the same launched test file for such a case.
- [ ] C3. A helper that registers cases when it is launched directly keeps today's behaviour, proven by an unchanged existing load-gate test file.
