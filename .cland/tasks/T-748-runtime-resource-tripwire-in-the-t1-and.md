---
id: T-748
kind: task
title: "Runtime resource tripwire in the T1 and T2 phases: a test that really spawns, binds or opens a socket fails by name"
state: open
status: in progress
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-456
branch: t/T-748-runtime-resource-tripwire-in-the-t1-and
created: 2026-10-17T17:29:45.529Z
updated: 2026-10-17T17:30:27.217Z
---

## Summary

Static analysis can't decide a test's real tier when fixtures choose native or fake paths by option. T-744's reachable census (2026-10-17) would put 283 of 314 files at T3, while T-719's runtime census shows projectHub with fake probes starts zero children. The exact check is at runtime: in the T1 and T2 phases, the runner traps the resource entry points and fails a test that uses one its tier forbids.

## What to build

The T1 and T2 phase workers install a tripwire before loading test files:
- **T1:** child_process spawn, exec and fork, plus net and http(s) listen and connect, fail.
- **T2:** child_process fails, except cland's own CLI subprocess through the documented helper.
Tripped calls fail the test with file, test name, resource and stack, and the run reports a tier-mismatch line. T3 and T4 are untouched. During the report-only week, a trip is reported, not failed. It goes hard together with the D53 budgets. It runs alongside T-684's static refusals for new files.

## Acceptance criteria

- [ ] C1. A planted T1 test that spawns `node -e` and a planted T2 test that does the same are each named in the run's tier-mismatch report, while a T2 test using projectHub with fake probes and the cland CLI helper passes clean, proved by runner tests.
- [ ] C2. An integrated cover at the merge head lists every current T1/T2 file that trips. The review request lists them, each routed to a fix or a retag.
