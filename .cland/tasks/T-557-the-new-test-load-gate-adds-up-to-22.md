---
id: T-557
kind: task
title: The new-test load gate adds up to 22 minutes to a task verify
state: open
status: planned
size: M
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-546
regression_of: T-471
topic: null
branch: null
created: 2026-10-16T01:08:32.102Z
updated: 2026-10-16T01:17:08.371Z
---

## Summary
T-471's load gate repeats every test new to the manifest five times "alongside phase" in the task's verify. On 2026-10-16, T-477's droplet verify e3fddbaf ran 2,659.68 s, of which "load gate extra wall 1311.47s" was repetitions. T-469's c7b31aef and T-527's 62859e0a were still in their repetitions 47 minutes after admission. With six remote slots and about 15 implementers, this alone backed the queue up to five waiters at 01:08Z, one waiting 47 minutes. It also works against E-387's goal of a 3–5 minute typical task verify.

## Acceptance criteria
- [ ] C1. The gate's extra wall per verify is bounded: repetitions run in parallel workers, or are capped by a configured per-verify budget in seconds that a session can see in the report, without dropping the five-repetition proof for any new test, which may move to a later run if the budget is exceeded.
- [ ] C2. Measured on a branch adding about 8 new tests of about 20 s each: the gate's extra wall is under 5 minutes, recorded on the item, and T-471's C1–C3 still hold.

## Comments

### coord · 2026-10-16T01:17:08.371Z

Most of the extra wall seen tonight was caused by a stale manifest, not by the gate's design. hub/test/durations.json still had its v0.1.2 baseline (A-2714), so every test added in v0.1.3 counted as new, and every task verify repeated dozens of them. Fixed on dev by the stage-close refresh 2149fe33 (01:17Z, from A-3493). T-557 stays open for the genuine case: a task that adds many slow new tests. Re-measure C2 after branches have picked 2149fe33.
