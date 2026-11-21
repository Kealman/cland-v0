---
id: T-2056
kind: task
title: Enqueue timing check refuses a literal test name in a file that also has dynamic test names ("new timing identity unknown in base source")
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
regression_of: T-2035
topic: topic-1711
branch: t/T-2056-enqueue-timing-check-refuses-a-literal
created: 2026-11-21T19:30:46.579Z
updated: 2026-11-21T19:31:24.493Z
---

## Summary

`checkEnqueueTimings` in `hub/src/hub/enqueue-timings.ts` (landed with T-2035, d20f53b65) throws `merge-budget: new timing identity unknown in base source` whenever a passing sample of 4 s or more comes from a file whose base source reads as `dynamic`. It throws before testing the file's literal patterns. On 2026-11-21 this refused T-2053's enqueue (green verify 62d3caed, clear verdicts) for `hub/test/login-capacity.test.ts::capacity selection bounds decoded rows and indexed query work over retained metadata`. That name is a literal `test('…')` in dev, and the base parse matches it (15 patterns, matched true). The file reads as dynamic only because of its other `for (…) test(label + …)` cases. T-2053 doesn't touch the file. Any item whose verify happens to run such a test slowly can't enqueue. The Coordinator found it at enqueue.

## What to build

Test the base patterns first. A sample that matches a literal base pattern is known, whether or not the file has dynamic cases. Refuse as unknown only when no pattern matches and the source is dynamic. Keep every other path unchanged: new identities in non-dynamic files still need allowances, and a missing receipt still refuses.

## Acceptance criteria

- [ ] C1. A 4 s or slower passing sample whose name matches a literal pattern in a base file that also has dynamic test names is known, and the enqueue proceeds (test, red before).
- [ ] C2. A 4 s or slower sample in a dynamic file that matches no base pattern still refuses with `new timing identity unknown in base source` (test).
