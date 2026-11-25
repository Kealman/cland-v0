---
id: T-2045
kind: task
title: Suite summary pass count (9,397) disagrees with raw base pass finishes (9,400); 18 output-control passes have no retained start (A-22307)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-21T03:04:36.183Z
updated: 2026-11-25T13:02:27.326Z
---

## Summary

In T-1901's full run 66f497e2 at 895ad0152 (A-22307), rev-35's final audit (A-22309) found an accounting mismatch. 3 base and 15 load-gate output-control tests have pass finishes with no retained start event. The summary reports 9,397 passes, while the raw base pass finishes number 9,400. The exact cause is unknown. Reported as an aside outside T-1901's review bar on 2026-11-21.

## Acceptance criteria

- [ ] C1. The cause of the mismatch is named from the A-22307 log (missing start events, double-counted finishes, or load-gate repetitions folded into base), and the suite summary's pass count is reconciled to the raw events, or the difference is labelled in the summary (test).
