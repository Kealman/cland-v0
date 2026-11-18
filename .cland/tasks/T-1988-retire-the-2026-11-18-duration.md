---
id: T-1988
kind: task
title: Retire the 2026-11-18 duration allowances for T-1646 and T-1984's synthetic-tracker cases by making their fixture setup cheap, before they expire on 2026-11-25
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1882
blocked_by:
  - T-1646
  - T-1984
topic: null
branch: null
created: 2026-11-18T20:41:33.453Z
updated: 2026-11-18T20:41:33.453Z
---

## Summary

On 2026-11-18 three exact-case C-216 duration allowances were added so the hub CPU fixes could land quickly. All expire 2026-11-25, and an expired allowance fails every suite (T-1879).
- T-1646 C1: `hub/test/tracker-summary.test.ts` "ten moving branches in a 1650-item tracker …", 8.5 s (droplet 5.553 s).
- T-1646 C2: the item-summary-scale responsiveness case, 19 s (local 8.9 s, ×1.4 droplet ratio).
- T-1984 C1: `hub/test/stage-closure-component.test.ts` "unrelated freshness answers do not fan out to stage-cover dependents", 16 s (droplet 10.381 s).
Each time goes into building a 1,500–1,650-item synthetic tracker, not the asserted work.

## What to build

Build these synthetic trackers cheaply: one owned transaction with reused prepared statements (T-1807's corpus went from 8.6 s to under 1 s this way), or a shared seeded fixture per file. Keep every work-count bound, oracle and behaviour bound unchanged, then remove the three allowances.

## Acceptance criteria

- [ ] C1. Each of the three cases runs under its normal duration budget on a droplet verify, with its assertions unchanged (evidence).
- [ ] C2. The three allowances are removed from `hub/test/durations.json` before 2026-11-25 (test: the duration lint passes without them).
