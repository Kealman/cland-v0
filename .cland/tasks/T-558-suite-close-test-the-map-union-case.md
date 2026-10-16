---
id: T-558
kind: task
title: "suite-close test: the map-union case fails one of five load-gate repetitions after T-531"
state: open
status: backlog
size: S
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-531
topic: null
branch: null
created: 2026-10-16T01:13:33.534Z
updated: 2026-10-16T01:13:33.534Z
---

## Summary
In T-477's droplet verify e3fddbaf at e2ec7b2c (2026-10-16 ~01:08Z; logs A-3533, A-3535), T-471's load gate ran `hub/test/suite-close.test.ts:12`, 'integrated remote close collects each map before release and publishes their function union', five times: 4/5 passed. T-531's structured scp count was already present. The gate's receipt prints no failing assertion, so the failing check is unknown. Same case as T-531, so a regression of T-531, or a second flaky check in that case.

## Acceptance criteria
- [ ] C1. Reproduce the failing repetition under load, record which assertion fails and why, and fix it, keeping every assertion.
- [ ] C2. suite-close.test.ts passes 5/5 serially as a whole file on the Mac, plus the load gate's five repetitions on a droplet in the task's verify.
