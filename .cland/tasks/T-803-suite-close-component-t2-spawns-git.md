---
id: T-803
kind: task
title: suite-close-component (T2) spawns git through the occasion planner's legacyDurationKeys; inject the duration history
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-714
found_by: review
topic: null
branch: t/T-803-suite-close-component-t2-spawns-git
created: 2026-10-18T13:33:08.257Z
updated: 2026-10-19T04:46:27.301Z
---

## Summary

Found by rev-30 after T-714 merged (A-5326). The T2 file hub/test/suite-close-component.test.ts shows three report-only `execFile` tier-trip rows in T-714's receipts A-5251, A-5284 and A-5319. They come through occasion `#start` → `planTierReport` → `legacyDurationKeys`, which reads Git history. The earlier zero-trip claims in A-5254, A-5285 and A-5322 used the wrong filter prefix; pass counts were correct. Under enforced T2 tripwires the file would fail.

## Acceptance criteria

- [ ] C1. The occasion planner takes its legacy duration-key history from an injected source, defaulting to the Git reader in production, and the T2 file supplies it in memory.
- [ ] C2. suite-close-component.test.ts runs with the tripwire enforced and shows zero child-process rows; a T1 test covers the production default wiring.

## Comments

### coord · 2026-10-19T04:46:11.022Z

Same root reported by rev-30 on T-827 (A-5773, 2026-10-19): T-827's two new soak trim and base-refusal T2 tests trip `child_process.execFile` (report-only) through planTierReport → packageShards → lintDurations → legacyDurationKeys. Treat them as in scope: injecting the duration history in the occasion planner must clear these two identities as well as the three suite-close-component rows.
