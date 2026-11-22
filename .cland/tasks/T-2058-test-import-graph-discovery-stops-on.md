---
id: T-2058
kind: task
title: Test import-graph discovery stops on suite-remote-budget.test.ts ("indirect require") because a callback parameter is named `require`, so targeted T1 selection falls back to unknown files
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
created: 2026-11-21T23:48:00.358Z
updated: 2026-11-21T23:48:00.358Z
---

## Summary

The shared test import-graph scanner (`importingTests` and the suite import parser) reports `Error: incomplete import graph: indirect require [hub/test/suite-remote-budget.test.ts]`. The cause is a callback parameter named `require` in that file, not a real dynamic import. impl-2050 (T-2050) and impl-2055 (T-2055) both hit it on 2026-11-21, so they had to select unknown-scan T1 files conservatively instead of the precise reachable set. Batch interaction reports list similar fallbacks too: vm loader, non-literal specifier, createRequire base, eval and an unresolved `yaml` specifier.

## What to build

Make the scanner tell a locally bound identifier named `require` apart from the CommonJS `require` (scope-aware), or rename the parameter in the test if that's the narrower fix. Keep refusing real indirect requires loudly (rule 41).

## Acceptance criteria

- [ ] C1. The import-graph scan of `hub/test/suite-remote-budget.test.ts` completes with no `incomplete import graph` error, and a real indirect `require` in a fixture source still reports it (test).
