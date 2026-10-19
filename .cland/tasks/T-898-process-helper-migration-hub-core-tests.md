---
id: T-898
kind: task
title: "Process-helper migration: hub core tests (edges, resilience, handover, executor)"
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-636
branch: t/T-898-process-helper-migration-hub-core-tests
created: 2026-10-19T19:27:16.441Z
updated: 2026-10-19T20:11:28.080Z
closed: 2026-10-19T20:11:28.079Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/edges.test.ts | T3 | 2 | 0 | 0 | 0 | 0 | 2 | T2 + named T3 lifecycle split | Retain stdio startup, listener bind failure and daemon lock refusal in T3 with a header; move raw socket frame-size rules to T2. |
| hub/test/resilience.test.ts | T3 | 2 | 9 | 0 | 0 | 0 | 11 | T2 + named T3 lifecycle split | Retain native spoke stdin death, disconnected startup and hub-outage reconnect in T3 with a header; lower hello/ack/deadline permutations to T2 in-process transport + FakeClock. |
| hub/test/handover-integrity.test.ts | T3 | 5 | 1 | 0 | 0 | 0 | 6 | T2 + named T3 lifecycle split | Retain actual handover-committed crash/restart in a T3-header file; chain and absent-receiver rules become injected T2. |
| hub/test/executor.test.ts | T3 | 3 | 1 | 0 | 0 | 0 | 4 | T2 + named T3 lifecycle split | Retain real PATH/worker launch and live-worker recovery across restart in T3 with a header; source-contract syntax assertion can be T1. |

## Acceptance criteria

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-31 [reviewer] · run rev-20261019-898-source · 2026-10-19T19:39:12.518Z · commit 5f401d4456afd1cc10decf970081ecd9786d3cb2
  - verified: rev-31 [reviewer] · run rev-20261019-898-source-2 · 2026-10-19T19:52:49.275Z · commit 61f369d536058ac1065cc20102959e164ab1d91f
  - done: impl-898 · 2026-10-19T20:00:59.673Z
  - verified: rev-31 [reviewer] · run rev-20261019-898-final · 2026-10-19T20:05:10.600Z · commit 61f369d536058ac1065cc20102959e164ab1d91f
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-898 · 2026-10-19T20:01:01.114Z
  - verified: rev-31 [reviewer] · run rev-20261019-898-final · 2026-10-19T20:05:10.600Z · commit 61f369d536058ac1065cc20102959e164ab1d91f

## Comments

### impl-898 · 2026-10-19T19:32:36.608Z

Split lower-tier edge, resilience, handover-chain and executor-contract cases into new component/contract files; native cases retain truthful T3 headers. Component resilience 8/8 and handover chains 3/3 pass. Running serial native files and lint shrink before review.

### impl-898 · 2026-10-19T19:36:04.801Z

Source pushed at 97d038cf71c5c556f740e21b50f77f9ee5f66465, A-6432 assertion map and functional logs. Root typecheck/tiers/lint green, all 13 moved cases pass under resource enforcement and all 10 native cases pass. Coordinator load embargo: no local timing evidence claimed. Source review assigned to Reviewer; verify waits for clear source.

### rev-31 · 2026-10-19T19:39:12.518Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-898-source
commit: 5f401d4456afd1cc10decf970081ecd9786d3cb2
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: no remaining findings. Thirteen rules/contracts move to T1/T2 with in-process/fake-clock/socket seams; ten native cases retain truthful T3 headers. All owned helper/baseline changes match their scope; no production or duration allowance changes; C1 verified. Spec: assertions/input meanings remain. Review found initial pre-restart completion wait weakened live-worker adoption; corrected head observes restored running state, same local PID alive and not reported while held, then release → completion code 0 → separate report wait, retaining exactly-once/second-restart assertions. A-6432 enforced functional/native logs and A-6438 corrected adoption summary support source readiness. Local durations are not timing proof under Mac load restriction. C2 awaits exact-head mode-free task gate, all 13 moved identities 5/5 and tier-budget/resource audit; Linux T3 remains periodic/integrated evidence. See full source artifact in topic-636.

Criteria: C1 verified.

### rev-31 · 2026-10-19T19:52:48.515Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-898-runtime-1
commit: 5f401d4456afd1cc10decf970081ecd9786d3cb2
scope: evidence
findings: [{"severity":"medium","text":"Shared T-891 fixture defect: the two verify admission identities fail ordinary and all five repetitions because the fixture has no verification test command. A-6483 exits 1; 13 owned moved identities pass 5/5 but cannot establish a green task gate.","file":"hub/test/verify-tool.test.ts","line":48}]
finding_counts: {"high":0,"medium":1,"low":0}

Independent entire-log audit: ordinary 1408 pass/2 fail, repetitions 280 pass/10 fail; only the two shared verify-tool identities fail. All 13 owned moved cases pass 5/5, zero tier mismatches/owned budget rows. A-6504 lists all 11 external report-only overruns and 2 external regressions. Authorized correction is a separate new-head source pass.

Criteria: C2 failed (A-6483 mode-free task run exits 1 on the two known shared verify-tool fixture identities.).

### rev-31 · 2026-10-19T19:52:49.275Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-898-source-2
commit: 61f369d536058ac1065cc20102959e164ab1d91f
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized T-891 shared-fix delta only (+7/-1 verify-tool fixtures). Configures the test command and preserves injected candidate selection without changing assertions or T-898 migration behavior. Standards/Spec source clear; C1 reverified. C2 still requires a fresh unchanged-head green mode-free receipt and all 13 moved identities 5/5. A-6504; prior full source A-6450 remains applicable.

Criteria: C1 verified.

### impl-898 · 2026-10-19T20:01:13.865Z

Green unchanged-head run 99bec6cb at 61f369d5: A-6532, 1645 passed, zero failures/cancellations/skips. All 13 moved identities passed 5/5; no owned tier mismatch/budget failure and no new allowance. Linux c-8 lon1 lifetime 393s, cost $0.0273. C1/C2 done marks added; final Reviewer evidence verdict pending. Prior shared-failure A-6483 retained; authorized T-891 delta fixed it.

### rev-31 · 2026-10-19T20:05:10.600Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-898-final
commit: 61f369d536058ac1065cc20102959e164ab1d91f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head configured mode-free 99bec6cb-7d53-404e-ae5b-a4cf7e579a24/A-6532 green: 1645 ordinary passes, 290 load finishes pass, all 58 groups 5/5, zero tier mismatch/non-pass. 13 owned moved identities pass ordinary and 5/5 (65 repetitions): edges 1, resilience 8, handover 3, contract 1. Largest owned T2 ordinary .275076008s/repetition .352724021s; T1 .025674329s/.033478956s. Maximum owned file 1.324363925s. Shared verify-tool cases pass all repetitions; no owned budget/tier diagnostic. Prior shared red A-6483 remains retained. C1 source review retained; C2 final established with native local evidence A-6450/A-6504/A-6432/A-6438. A-6549 retains entire-log audit and known report-only rows; T3 Linux remains periodic/integrated/landing.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:11:28.079Z

Merged 10ae43506416e2f36eb03e886e96f23f3497aa3f onto dev.
