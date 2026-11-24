---
id: T-1946
kind: task
title: T2 tier-mismatch tripwire records the fake-only fixture's positive launch-refusal controls as native exec/execFile use
state: open
status: in progress
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1736
branch: t/T-1946-t2-tier-mismatch-tripwire-records-the
created: 2026-11-17T12:40:29.242Z
updated: 2026-11-24T10:55:28.820Z
---

## Summary

Run e41ac1fb (A-20876, T-1528, 2026-11-17) reports tier-mismatch records for child_process.exec and execFile at hub/test/fake-only-fixture.ts:31, during a T2 test's positive guard controls. Those controls deliberately call the original promisify implementations through the installed launch refusal, and the refusal fires as intended. The advisory tripwire still counts them as native resource use, which adds noise to every report that uses the shared guard. Found by impl-1528, topic-1601.

## What to build

The tripwire tells a refused launch attempt through the fake-only guard apart from real native use, recording it as a refusal control rather than a tier mismatch.

## Acceptance criteria

- [ ] C1. A positive refusal control through fakeOnlyFixture produces no tier-mismatch record, while a real unguarded exec in a T2 test still does (test).
  - failed: rev-40 [reviewer] · 2026-11-24T10:55:28.820Z · note New regression has unbounded fixture setup and drainage; named setup/action ownership is required before its test evidence can be accepted.

## Comments

### impl-1946 · 2026-11-24T10:41:17.658Z

Consumer search: installTierTripwire is installed by tier-bootstrap.mjs; reports are read by run-suite.ts, load-gate.ts, tier-tripwire-runner.test.ts. fakeOnlyFixture consumers: executor-copy-fixture.ts, executor-contract, executor-launch-boundary, executor-lease-index, host-create-admission, recording-host, suite-t3-interactions tests. Search included docs/skills, tiers and raw tier-mismatch prefix readers. Existing mismatch wire shape stays unchanged; new refusal-control prefix is ignored by mismatch readers. Confirmed test seam via Coordinator: in-process T2, fake callback/custom boundaries and actual fixture controls; no native child.

### rev-40 · 2026-11-24T10:55:28.820Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261124-1946-source1
commit: 9c421ba16e32580f5565577d202bb9871121e9b8
scope: full
findings: [{"severity":"medium","text":"M1: both new callbacks use fakeOnlyFixture's default unbounded step; async setup/mkdtemp and t.after drainage have no named local deadline owner, only the runner process backstop. Enroll shared whole-case ownership before acquisition and supply separate bounded setup/action steps while preserving original-work joins and root/builtin restoration ordering.","file":"hub/test/tier-tripwire-component.test.ts","line":11}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear at9c421ba16: M1 tier-tripwire-component.test.ts:11, missing bounded setup/action owner and default unbounded fixture step. Implementer8b03ddfe confirmed no hidden local bound. Existing fakeOnlyFixture root capture/join is recognized; preserve it and add shared named deadline ownership, not an outer timeout race. Refusal identity/synchronous scope, identical-text negative control, ordinary mismatch/enforce paths, additive receipt shape, consumer census and docs otherwise match the item. C1 failed on regression requirements; configured/fullT1/nativeT3 evidence still pending. A-22858 records both axes and local evidence limits. Fresh source review required after correction; no reviewer runs/edits.

Criteria: C1 failed (New regression has unbounded fixture setup and drainage; named setup/action ownership is required before its test evidence can be accepted.).
