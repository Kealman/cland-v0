---
id: T-2051
kind: task
title: Fresh suite admissions carry positive per-test-timeout default provenance, so an unset test_timeout is load-scaled while an explicit one stays exact
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-21T08:48:57.100Z
updated: 2026-11-21T08:48:57.100Z
---

## Summary

T-2046 load-scales default test waits and keeps explicit ones exact. Its review (rev-40, M5 fact check at 879df801b) found that fresh projectConfig-backed admissions build a four-field SuiteLimits at `hub/src/hub/suites.ts` (about line 697, via `#captureConfig` at about line 451) without `testTimeoutIsDefault`. So an unset `test_timeout` is treated as exact, the same as legacy snapshots. The Coordinator accepted that conservative behaviour for T-2046 (2026-11-21 08:48Z), because this project sets `test_timeout = "120s"` explicitly and the change is hub runtime behaviour outside a test-wait task.

## What to build

Carry positive default provenance through fresh admission and config capture with the shared config parser. Legacy snapshots with unknown provenance stay exact. Handle live-hub capability under rule 19.

## Acceptance criteria

- [ ] C1. A fresh admission for a project with no `test_timeout` records the timeout as a default, and the runner load-scales it. A project with an explicit `test_timeout` stays exact (test, red before).
- [ ] C2. A legacy snapshot with no provenance field still runs with an exact timeout (test).
