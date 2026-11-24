---
id: T-1946
kind: task
title: T2 tier-mismatch tripwire records the fake-only fixture's positive launch-refusal controls as native exec/execFile use
state: closed
status: done
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
updated: 2026-11-24T13:39:59.503Z
closed: 2026-11-24T13:39:59.503Z
---

## Summary

Run e41ac1fb (A-20876, T-1528, 2026-11-17) reports tier-mismatch records for child_process.exec and execFile at hub/test/fake-only-fixture.ts:31, during a T2 test's positive guard controls. Those controls deliberately call the original promisify implementations through the installed launch refusal, and the refusal fires as intended. The advisory tripwire still counts them as native resource use, which adds noise to every report that uses the shared guard. Found by impl-1528, topic-1601.

## What to build

The tripwire tells a refused launch attempt through the fake-only guard apart from real native use, recording it as a refusal control rather than a tier mismatch.

## Acceptance criteria

- [x] C1. A positive refusal control through fakeOnlyFixture produces no tier-mismatch record, while a real unguarded exec in a T2 test still does (test).
  - done: impl-1946 · 2026-11-24T11:26:04.241Z
  - verified: rev-40 [reviewer] · run rev-40-20261124-1946-final · 2026-11-24T12:06:14.344Z · commit 134f67d6ee4c66d1695df1aff8f1d59eb24139f7

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

### rev-40 · 2026-11-24T11:26:49.963Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1946-source2
commit: 134f67d6ee4c66d1695df1aff8f1d59eb24139f7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear at134f67d6e; M1 resolved. Shared whole-case admission precedes mutation/acquisition; named sequence/guard/root/body waits retain original producers. Scoped fixture cleanup runs after pending sequence join; outer fenced owner releases builtins/prototype/exit status only after drainage and fixture cleanup. Original refusal identity/negative control/callback-custom/report-enforce assertions retained; mismatch consumers/docs/tier unchanged and reviewed. A-22885 records both axes and source ownership reasoning. C1 remains unverified pending exact-head configured receipts; A-22883 localmacOS Node24.21 component2/2/static0 is focused evidence, earlier62passes remain historical. FullT1/bootstrap and configuredT3 pending. No findings, reviewer runs/probes/edits.

### rev-40 · 2026-11-24T12:06:14.344Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261124-1946-final
commit: 134f67d6ee4c66d1695df1aff8f1d59eb24139f7
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at unchanged134f67d6e. Exact-head5bf8d0a3/A-22915 finished/passed, canonicaldef9277d executable match. Both named report-only/enforce component cases basepass35368/35372 and distinct5/5 load35499/35506. C1 verified under Coordinator597d5193's explicitly approved T2 fake-boundary seam (actual fixture positive controls; fake unguarded exec/execFile callback/custom paths, no native child). Full243T1bootstrap runs; named fixture consumers allpass. T0/T1/fallbackT2/selectedT3/Web exit0;7processfiles100positive identities once, restT3batch/T4unexecuted. Existing native T3tripwire-runner unselected, not claimed executed. Noncached Linuxx64c8nyc1 workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CfT156.0.8078.4;7471pass/1skip/0fail and advisory budgets retained. A-22916 records both axes/provenance/limits. No findings/reviewer runs/edits.

Criteria: C1 verified.

### impl-1946 · 2026-11-24T12:06:18.893Z

Exact-head configured run 5bf8d0a3 passed at134f67d6ee4c66d1695df1aff8f1d59eb24139f7; A-22915. Linux x64 droplet c-8 nyc1, Node24.21.0, Neovim0.12.5, Chrome Headless Shell156.0.8078.4 / Playwright1248. T0/all243T1/fallback446T2/selected7T3/Web55 exit0. Aggregate7472:7471pass,0fail,1skip. RemainingT3 deferred to batch; T4 unexecuted. Lint/budget advisories report-only. Durable outcome=pass records checked for both exact new component case names;104 tier-refusal-control rows observed. Matching mismatch scan for fake-only-fixture/recording-host/executor-contract returned none; positive mismatch assertions remain in passing component cases. No head change or resubmission.

### coord · 2026-11-24T13:39:59.503Z

Merged 0bded5946d01b2e669c315b93a37d429959c7472 onto dev.
