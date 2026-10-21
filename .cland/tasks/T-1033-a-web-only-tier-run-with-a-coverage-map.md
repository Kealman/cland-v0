---
id: T-1033
kind: task
title: A Web-only tier run with a coverage map crashes reducing an absent raw directory
state: open
status: in progress
size: S
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
regression_of: T-991
topic: topic-784
branch: t/T-1033-a-web-only-tier-run-with-a-coverage-map
created: 2026-10-21T05:59:43.464Z
updated: 2026-10-21T06:00:34.690Z
---

## Summary

On a local stage run, the Web phase passes its test and then exits 1. `run-suite.ts` reduces coverage for the Web tier even though it captured none, so `readdir` of the raw coverage directory throws ENOENT. Every macOS stage cover is red until this is fixed.

## What to build

`hub/test/run-suite.ts` captures V8 coverage only for `hub/` test arguments (`capture` at about line 169). The separate `--tier Web` process still reaches `reduceCoverage` (about line 281) with a `coverageRaw` directory it never created. It then fails with `ENOENT: no such file or directory, scandir '<suite>/coverage-map.json.raw'` from `reduceCoverage` (`hub/src/suite-coverage.ts:144`). A tier that captured no coverage files leaves the map as it is, or appends nothing under `CLAND_COVERAGE_APPEND`, and the phase exits with its tests' code. Linux droplet runs never hit this, because their Web phase is not run until T-993.

Evidence: macOS stage cover ed78ee36 at 8f9e38c0 (A-8146): T1–T4 exit 0 with 3,473 of 3,473 passed, then Web exit 1 after its one test passed.

## Acceptance criteria

- [ ] C1. A `--tier Web` run with coverage recording and no `hub/` test files exits with its tests' code and leaves the existing coverage map intact (test).
- [ ] C2. A hub tier run still writes its coverage map as before (the existing coverage tests pass unchanged).
