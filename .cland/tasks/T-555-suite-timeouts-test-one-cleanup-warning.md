---
id: T-555
kind: task
title: "suite-timeouts test: 'one cleanup warning' not seen within 15000 ms under load (Mac)"
state: open
status: in progress
size: XS
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
topic: topic-381
branch: t/T-555-suite-timeouts-test-one-cleanup-warning
created: 2026-10-16T01:06:48.258Z
updated: 2026-10-16T15:48:29.382Z
---

## Summary
In T-533's local verify bbfee74e at 77659eb0 (2026-10-16 ~01:05Z, Mac, peak load about 15–20; log A-3523), `hub/test/suite-timeouts.test.ts:179` failed with "one cleanup warning: not within 15000 ms". T-533 doesn't touch the file. No E-482 ticket names this case yet.

## Acceptance criteria
- [ ] C1. The case waits on the cleanup warning's own receipt, not a fixed 15 s window shared with slow teardown, or records why 15 s is the contract. The root cause goes in the commit, and every assertion stays.
- [ ] C2. suite-timeouts.test.ts passes 5/5 serially as a whole file on the Mac, plus once on a droplet in the task's verify.
