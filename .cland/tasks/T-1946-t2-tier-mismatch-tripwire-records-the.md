---
id: T-1946
kind: task
title: T2 tier-mismatch tripwire records the fake-only fixture's positive launch-refusal controls as native exec/execFile use
state: open
status: review
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
updated: 2026-11-24T10:54:08.069Z
---

## Summary

Run e41ac1fb (A-20876, T-1528, 2026-11-17) reports tier-mismatch records for child_process.exec and execFile at hub/test/fake-only-fixture.ts:31, during a T2 test's positive guard controls. Those controls deliberately call the original promisify implementations through the installed launch refusal, and the refusal fires as intended. The advisory tripwire still counts them as native resource use, which adds noise to every report that uses the shared guard. Found by impl-1528, topic-1601.

## What to build

The tripwire tells a refused launch attempt through the fake-only guard apart from real native use, recording it as a refusal control rather than a tier mismatch.

## Acceptance criteria

- [x] C1. A positive refusal control through fakeOnlyFixture produces no tier-mismatch record, while a real unguarded exec in a T2 test still does (test).
  - done: impl-1946 · 2026-11-24T10:53:32.093Z

## Comments

### impl-1946 · 2026-11-24T10:41:17.658Z

Consumer search: installTierTripwire is installed by tier-bootstrap.mjs; reports are read by run-suite.ts, load-gate.ts, tier-tripwire-runner.test.ts. fakeOnlyFixture consumers: executor-copy-fixture.ts, executor-contract, executor-launch-boundary, executor-lease-index, host-create-admission, recording-host, suite-t3-interactions tests. Search included docs/skills, tiers and raw tier-mismatch prefix readers. Existing mismatch wire shape stays unchanged; new refusal-control prefix is ignored by mismatch readers. Confirmed test seam via Coordinator: in-process T2, fake callback/custom boundaries and actual fixture controls; no native child.
