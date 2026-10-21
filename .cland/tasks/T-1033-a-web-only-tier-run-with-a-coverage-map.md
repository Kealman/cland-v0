---
id: T-1033
kind: task
title: A Web-only tier run with a coverage map crashes reducing an absent raw directory
state: open
status: review
size: S
criterion_seq: 2
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
updated: 2026-10-21T06:04:20.624Z
---

## Summary

On a local stage run, the Web phase passes its test and then exits 1. `run-suite.ts` reduces coverage for the Web tier even though it captured none, so `readdir` of the raw coverage directory throws ENOENT. Every macOS stage cover is red until this is fixed.

## What to build

`hub/test/run-suite.ts` captures V8 coverage only for `hub/` test arguments (`capture` at about line 169). The separate `--tier Web` process still reaches `reduceCoverage` (about line 281) with a `coverageRaw` directory it never created. It then fails with `ENOENT: no such file or directory, scandir '<suite>/coverage-map.json.raw'` from `reduceCoverage` (`hub/src/suite-coverage.ts:144`). A tier that captured no coverage files leaves the map as it is, or appends nothing under `CLAND_COVERAGE_APPEND`, and the phase exits with its tests' code. Linux droplet runs never hit this, because their Web phase is not run until T-993.

Evidence: macOS stage cover ed78ee36 at 8f9e38c0 (A-8146): T1–T4 exit 0 with 3,473 of 3,473 passed, then Web exit 1 after its one test passed.

## Acceptance criteria

- [x] C1. A `--tier Web` run with coverage recording and no `hub/` test files exits with its tests' code and leaves the existing coverage map intact (test).
  - done: impl-1033 · 2026-10-21T06:02:46.013Z
- [x] C2. A hub tier run still writes its coverage map as before (the existing coverage tests pass unchanged).
  - done: impl-1033 · 2026-10-21T06:02:46.024Z

## Comments

### impl-1033 · 2026-10-21T06:02:46.005Z

Implemented test-first in 742010d9: reduction requires collected hub test files; no-capture Web tiers preserve the existing map and their test exit. Targeted local macOS coverage file 4/4 pass, hub typecheck pass, test lint zero refusals (report-only census). Regression covers normal/append recording, success/failure exits, map bytes and raw-directory absence. Existing hub capture tests unchanged. Source review requested next; full verification pending.

### rev-23 · 2026-10-21T06:04:20.624Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1033-source
commit: 742010d92ca2021e99bfc4ad5939d46f7d786e6c
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec audit A-8148 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-8148-t-1033-source-review-at-742010d9.md). Guard requires collected hub test files before coverage reduction/publication; actual hub reducer/append behavior and error returns unchanged. Trivial Web runner fixtures cover append/non-append and pass/fail exits, exact seeded-map preservation/no raw dir, with owned env and bounded completion. Existing hub capture/attribution tests unchanged. Coordinator authorized no-browser seam; lint qualifies existing T3 file. No findings. A-8147 local targeted T3 4/4/check/lint summary is scoped, not full gate or stage cover. C1/C2 remain runtime-unverified pending same-head configured mode-free receipt alongside targeted T3 evidence. No Reviewer runtime; QA scope none.
