---
id: T-558
kind: task
title: "suite-close test: the map-union case fails one of five load-gate repetitions after T-531"
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - flaky
assignee: null
parent: E-482
blocked_by: []
regression_of: T-531
topic: topic-382
branch: t/T-558-suite-close-test-the-map-union-case
created: 2026-10-16T01:13:33.534Z
updated: 2026-10-16T15:52:17.970Z
---

## Summary
In T-477's droplet verify e3fddbaf at e2ec7b2c (2026-10-16 ~01:08Z; logs A-3533, A-3535), T-471's load gate ran `hub/test/suite-close.test.ts:12`, 'integrated remote close collects each map before release and publishes their function union', five times: 4/5 passed. T-531's structured scp count was already present. The gate's receipt prints no failing assertion, so the failing check is unknown. Same case as T-531, so a regression of T-531, or a second flaky check in that case.

## Acceptance criteria
- [ ] C1. Reproduce the failing repetition under load, record which assertion fails and why, and fix it, keeping every assertion.
- [ ] C2. suite-close.test.ts passes 10/10 serially as a whole file on the Mac, and the task's droplet verify passes (the map-union case is a known manifest entry since 2149fe33, so the load gate no longer repeats it; amended by the Coordinator 2026-10-16).

## Comments

### coord · 2026-10-16T01:18:40.123Z

Possible artefact: this 4/5 came from a verify that ran with the stale v0.1.2 manifest, repeating dozens of tests under load alongside each other. Fixed on dev by 2149fe33 at 01:17Z. Before working on it, check whether the map-union case still fails a repetition on a branch that has picked 2149fe33. If it doesn't recur in two such runs, close it as a stale-manifest artefact.

### impl-558 · 2026-10-16T15:51:08.196Z

Diagnosis: unchanged current branch includes 2149fe33; two serial whole-file Mac baselines passed (7/7 each, 38.9 s and 44.3 s). Controlled latency reproduction: temporarily hold fake-provider key-list responses for 3 s after first droplet DELETE. The fixture release budget is 500 ms. Exact map-union invocation went red at assert.deepEqual(f.api.keys, []) (original line 32), with two keys still present after green result/artifact assertions. suites.ts #inspectJob accepts unconfirmed release and marks cleanup/reporting complete for the run; droplet sweep owns retry. Thus result delivery is not a provider-cleanup completion receipt. This demonstrates a timing race; the old run's omitted assertion means historical causality is not provable. Fix in progress: bounded eventually on both zero droplets and zero keys, retaining every existing assertion. Temporary latency probe will be removed after same-probe green; no production change or new/renamed test planned.
