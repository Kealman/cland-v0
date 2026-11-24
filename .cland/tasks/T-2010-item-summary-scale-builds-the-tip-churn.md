---
id: T-2010
kind: task
title: item-summary-scale builds the tip-churn fixture at module scope, so name-filtered runs of other cases enrol it
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: null
branch: null
created: 2026-11-19T17:03:39.453Z
updated: 2026-11-24T09:00:00.363Z
---

## Summary

`hub/test/item-summary-scale.test.ts` awaits `trackerFileCase` at module scope, and `hub/test/tip-churn-file-fixture.ts` acquires, seeds and warms its churn hub before `run()` selects its single consumer. So a name-filtered load-gate run of a different case in that file still builds the unrelated churn fixture. That breaks rule 38's "a test-only gate selects exactly one thing" and wastes setup time. This is a static observation by T-2004's reviewer on 2026-11-19; nothing was measured. It's separate from T-1995, which covers the churn fixture's `finally` masking errors, and from T-2005, frame cost.

## What to build

Make the churn fixture lazy: acquire, seed and warm it only inside the selected consumer's case, under its whole-caller owner, so name-filtered runs of other cases never build it.

## Acceptance criteria

- [ ] C1. A name-filtered run of another `item-summary-scale` case records zero churn-fixture acquisitions, shown by a counter control that fails on the current code (test).
- [ ] C2. The churn consumer's own case still passes, with its fixture owned and joined (test).
