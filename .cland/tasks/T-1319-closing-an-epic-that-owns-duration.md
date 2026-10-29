---
id: T-1319
kind: task
title: Closing an epic that owns duration allowances strands them with a closed owner and turns the next full run red
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: null
branch: null
created: 2026-10-26T01:52:55.592Z
updated: 2026-10-29T15:59:05.213Z
---

## Summary

Closing an epic that still owns duration allowances in hub/test/durations.json leaves those allowances with a closed owner. The next full run on a tree whose tracker shows the epic closed fails shard planning: `lintDurations` throws "duration allowance has closed owner". On 2026-10-26 this turned the macOS release cover d1dfed4b (A-12230) red, after E-1282 and E-1284 were closed during the run. The Coordinator re-owned the seven allowances to E-880 (3a488be5), and both release covers had to rerun.

## What to build

Make `task close` on an epic refuse, or name the allowances it owns with the command to re-own them, while hub/test/durations.json lists that epic as an allowance owner. Keep the existing allowance lint unchanged.

## Acceptance criteria

- [ ] C1. Closing an epic that owns a duration allowance is refused with a reason naming each owned allowance key and the re-own step, and closing it succeeds once no allowance names it (test).
