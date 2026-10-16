---
id: T-558
kind: task
title: "suite-close test: the map-union case fails one of five load-gate repetitions after T-531"
state: open
status: review
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
updated: 2026-10-16T16:03:07.805Z
---

## Summary
In T-477's droplet verify e3fddbaf at e2ec7b2c (2026-10-16 ~01:08Z; logs A-3533, A-3535), T-471's load gate ran `hub/test/suite-close.test.ts:12`, 'integrated remote close collects each map before release and publishes their function union', five times: 4/5 passed. T-531's structured scp count was already present. The gate's receipt prints no failing assertion, so the failing check is unknown. Same case as T-531, so a regression of T-531, or a second flaky check in that case.

## Acceptance criteria
- [x] C1. Reproduce the failing repetition under load, record which assertion fails and why, and fix it, keeping every assertion.
  - done: impl-558 · 2026-10-16T15:59:03.603Z
  - verified: rev-30 [reviewer] · run rev-20261016-558-source · 2026-10-16T16:03:07.804Z · commit 3976f2cd97d2590e8ced2719f2f17558e07473e1
- [ ] C2. suite-close.test.ts passes 10/10 serially as a whole file on the Mac, and the task's droplet verify passes (the map-union case is a known manifest entry since 2149fe33, so the load gate no longer repeats it; amended by the Coordinator 2026-10-16).

## Comments

### coord · 2026-10-16T01:18:40.123Z

Possible artefact: this 4/5 came from a verify that ran with the stale v0.1.2 manifest, repeating dozens of tests under load alongside each other. Fixed on dev by 2149fe33 at 01:17Z. Before working on it, check whether the map-union case still fails a repetition on a branch that has picked 2149fe33. If it doesn't recur in two such runs, close it as a stale-manifest artefact.

### impl-558 · 2026-10-16T15:51:08.196Z

Diagnosis: unchanged current branch includes 2149fe33; two serial whole-file Mac baselines passed (7/7 each, 38.9 s and 44.3 s). Controlled latency reproduction: temporarily hold fake-provider key-list responses for 3 s after first droplet DELETE. The fixture release budget is 500 ms. Exact map-union invocation went red at assert.deepEqual(f.api.keys, []) (original line 32), with two keys still present after green result/artifact assertions. suites.ts #inspectJob accepts unconfirmed release and marks cleanup/reporting complete for the run; droplet sweep owns retry. Thus result delivery is not a provider-cleanup completion receipt. This demonstrates a timing race; the old run's omitted assertion means historical causality is not provable. Fix in progress: bounded eventually on both zero droplets and zero keys, retaining every existing assertion. Temporary latency probe will be removed after same-probe green; no production change or new/renamed test planned.

### impl-558 · 2026-10-16T16:01:17.774Z

Implementation and Mac proof ready at pushed head 3976f2cd97d2590e8ced2719f2f17558e07473e1, branch t/T-558-suite-close-test-the-map-union-case. One-file change adds the harness's bounded eventually for both empty provider droplets and keys before preserving the original assertions. Controlled red→green cause/probe: A-3932 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3932-t-558-controlled-race-reproduction-and-diagnosis.md). Clean final source whole-file Mac serial proof: 10/10, all 70 test executions pass, no failures/cancellations/skips; npm run typecheck exit 0 at the same head. Full logs: A-3952 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3952-t-558-mac-proof-10-serial-whole-file-passes-and-typecheck-exit-0.md). origin/dev fetched and merged before committing/pushing this head. Existing test name and duration baseline unchanged; no new/renamed tests, no production changes. C2's normal droplet verify remains pending source review. qaPolicy none/after-stage, no qaCriteria: source review only requested.

### rev-30 · 2026-10-16T16:03:07.804Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-558-source
commit: 3976f2cd97d2590e8ced2719f2f17558e07473e1
scope: full

# T-558 source review clear

Reviewed pushed `3976f2cd97d2590e8ced2719f2f17558e07473e1`, branch `t/T-558-suite-close-test-the-map-union-case`; local/origin refs agree. Fixed point/merge base `8dbb4599a8799238bfda80ac5802eb96ce7a7302`; captured three-dot diff/single implementation commit. One test file only: add existing eventually import and bounded resource-absence observation. Hold/current claimant/criteria done state/QA none-after-stage checked.

## Standards

Zero high/medium/low findings. Predicate requires **both** empty droplets and empty keys; returns undefined until both are absent. Existing harness eventually polls boundedly (default15s, existing harness override policy), then times out with named boundary. It does not use a fixed sleep or assume result publication proves cleanup. Both final deepEqual absence assertions and all prior map/artifact/head/function-union/structuredSCP-count assertions remain unchanged. No production change, temporary probe, new/renamed identity or duration-baseline edit.

This follows rules9/12: observe the exact asserted resource condition rather than a different result/report boundary. It retains failure for stuck cleanup. No generic helper or assertion weakening introduced; whitespace check clean.

## Spec / C1 verified with bounded diagnosis

**A-3932** gives a controlled real-fixture probe: key-list responses held3s after first dropletDELETE against the fixture500ms release budget. It makes the original keys-empty assertion fail with two keys after successful result/map assertions, then passes with the bounded observation under the same probe. Final committed source removes the temporary latency hook. Source inspection confirms result reporting can follow an unconfirmed bounded release while executor sweep retries provider cleanup; observing both provider lists is the relevant boundary.

Historical T-477 4/5 receipt omitted the failing assertion. Therefore **this proves a present cleanup boundary race and the wait fix, not which assertion caused that historical repetition**. Coordinator disposition **a0c580dd-574a-4d94-b01f-23b8566c017e**, returned through the item question/answer chain in17e4b3e0, explicitly accepts C1 on this controlled red→green with exactly that limit. Verify C1; no historical actor/assertion/causality is invented.

## Mac evidence / C2 pending droplet

**A-3952** durable note embeds ten complete whole-file outputs plus typecheck command output. Independently parsed all ten: **7/7 each,70/70 total,0fail/0cancel/0skip**, sequential Mac series46.427–66.697s per file. Exact clean final source3976f2cd, no temporary probe. Root typecheck exit0 reported with log. Note does not carry separate admission load/PID telemetry, so no quiet/load condition is invented.

**Direct Coordinator9305b8fc-8b72-4d95-8125-309aaa45c380** and current tracker amend C2: **10whole-file Mac passes + normal droplet verify**. Map-union identity is already a known manifest entry; do not rename it or delete its baseline to force five load repetitions. The amended C2 does not require a fabricated new-test load gate.

Source **clear**, C1 verified. **C2/final pending fresh no-mode exact-head cland verify**; Mac70/70 supplies its local half, not a completed droplet gate. Any changed head needs delta review before another run. No full local suite/per-item QA requested. Lead owns fixes/retries.

Reviewer only reads/parses source/evidence, no tests/compiler/process/provider calls/edits/subagents. Findings: Standards0; Spec0.

Artifact A-3957 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3957-t-558-source-clear-bounded-provider-cleanup-wait-and-10-pass-mac-proof.md

Criteria: C1 verified.
