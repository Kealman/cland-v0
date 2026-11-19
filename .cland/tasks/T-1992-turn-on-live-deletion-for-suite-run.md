---
id: T-1992
kind: task
title: Turn on live deletion for suite-run retention once run-reference pins exist, with the configurable age floor and its help and fixture migration
state: open
status: planned
size: S
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-1883
blocked_by:
  - T-1957
  - T-1991
topic: null
branch: null
created: 2026-11-19T01:26:36.765Z
updated: 2026-11-19T13:02:04.805Z
---

## Summary

Split from T-1957 (2026-11-19). T-1957 ships retention in report mode (rule 27): it computes and logs what it would retire, but deletes nothing. Once run-reference pins exist, this item turns on live deletion, behind the configurable age floor (default 7 days).

## What to build

Enable deletion through T-1957's guarded deletion owner, respecting pins, the retirement claim and the age floor. Add the floor's configuration key with its parser, help text and frozen-fixture migration (rule 41). Before switching, replay T-1957's report-mode logs from the live machine to confirm what would be retired (rule 27).

## Acceptance criteria

- [ ] C1. The report-mode replay artifact lists the would-retire counts and classes from the live logs, and the first live sweep retires no run that is pinned or younger than the floor (artifact plus test).
- [ ] C2. The age-floor key parses, is documented in help, and its frozen fixtures are migrated (test).
- [ ] C3. A live sweep on a fake root of 50,000 runs keeps `task.view` answering within a named bound (test, native slot).
- [ ] C4. Retention also classifies run directories under `.cland/run/suites` that the hub's run index doesn't know (about 91,000 of 96,758 on 2026-11-19), using a positive absence receipt from the index plus the age floor, never a guess from the name. It retires them through the same guarded owner, on a fake root with indexed and unindexed runs, with a control that an unindexed but referenced run is kept (test).
- [ ] C5. Before the first live sweep, runs referenced only by pre-existing criterion verification marks (which `retainsSuiteRun` in tracker/index-db.ts doesn't query today) are backfilled into pins or indexed keep protection. A fixture with a criterion-only reference shows that run kept (test).
