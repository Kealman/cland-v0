---
id: T-693
kind: task
title: opencode-adapter.test.ts becomes OpenCode's contract file without the cross-adapter duplicates
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - tests
assignee: null
parent: E-677
blocked_by:
  - T-691
  - T-686
topic: null
branch: null
created: 2026-10-16T19:59:35.909Z
updated: 2026-10-16T20:00:52.048Z
---

## Summary

`opencode-adapter.test.ts` (62.3 s, 17 tests; 24 fake-binary sites) is the OpenCode frame family, but it also re-proves hub-side behaviour other adapters prove: the launch brief after the role clause (×2), the shared-artifact envelope, the Lead's clause and claim (report-slice3 anti-pattern 10), and runs approval-snapshot edges through the binary.

## What to build

`opencode-adapter.test.ts` is tagged `{ "tier": "T3", "contract": "opencode" }` with T-691's checklist steps, one test each. The cross-adapter duplicates go, because T-691's composition file proves the hub's part once in-process. Approval-snapshot edges run on a scripted SSE transport double in a T1 or T2 file.

## Acceptance criteria

- [ ] C1. `opencode-adapter.test.ts` is the `opencode` contract entry, with its header mapping each checklist step to one test.
- [ ] C2. Manifest seconds of the touched and new files fall from 62.3 s (A-3877) to 45 s or less, and fake-binary call sites from 24 to 14 or less.
- [ ] C3. An audit maps every removed duplicate to the test that proves the same behaviour and every moved assertion to its new place, with no behaviour claim dropped.
- [ ] C4. Each touched file passes 5/5 serially as a whole file on the Mac and once in the task's droplet verify.

## Blocked by

T-686.
