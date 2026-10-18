---
id: T-803
kind: task
title: suite-close-component (T2) spawns git through the occasion planner's legacyDurationKeys; inject the duration history
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-714
found_by: review
topic: null
branch: null
created: 2026-10-18T13:33:08.257Z
updated: 2026-10-18T13:33:08.257Z
---

## Summary

Found by rev-30 after T-714 merged (A-5326). The T2 file hub/test/suite-close-component.test.ts shows three report-only `execFile` tier-trip rows in T-714's receipts A-5251, A-5284 and A-5319. They come through occasion `#start` → `planTierReport` → `legacyDurationKeys`, which reads Git history. The earlier zero-trip claims in A-5254, A-5285 and A-5322 used the wrong filter prefix; pass counts were correct. Under enforced T2 tripwires the file would fail.

## Acceptance criteria

- [ ] C1. The occasion planner takes its legacy duration-key history from an injected source, defaulting to the Git reader in production, and the T2 file supplies it in memory.
- [ ] C2. suite-close-component.test.ts runs with the tripwire enforced and shows zero child-process rows; a T1 test covers the production default wiring.
