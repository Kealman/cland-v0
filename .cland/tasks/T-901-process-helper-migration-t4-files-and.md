---
id: T-901
kind: task
title: "Process-helper migration: T4 files and the T4 lifecycle exemption"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-640
branch: t/T-901-process-helper-migration-t4-files-and
created: 2026-10-19T19:27:17.118Z
updated: 2026-10-19T20:06:58.371Z
closed: 2026-10-19T20:06:58.371Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/prepared-project.test.ts | T4 | 2 | 0 | 0 | 0 | 0 | 2 | T2 hub seam + native Git T4 | Currently T4 (correction to A-6398). Real Git clone/ref/index/hook isolation stays native; replace hub-state checks with projectHub to remove startDaemon, retaining T4 native Git workload unless a bounded CLI component split qualifies. |
| hub/test/project-hub.test.ts | T4 | 0 | 1 | 1 | 0 | 0 | 2 | T2 + T3 lifecycle split | Currently T4 (correction to A-6398). Split injected adapter timing to T2 with FakeClock; retain real cross-process transport/cleanup leak detection in a T3-header harness lifecycle test. |
| hub/test/orphan-servers-perf.test.ts | T4 | 1 | 0 | 0 | 0 | 0 | 1 | T4 policy decision | Currently T4, not T3. Preserve resistant-process timing/deadline assertions in T4. Needs explicit policy disposition for T4 lifecycle exemption or safe bounded T3 lifecycle extraction; do not retag soak to hit C1. |

Coordinator policy (2026-10-19): a T4 soak file whose assertions measure real processes (orphan-servers-perf's resistant-process deadlines) keeps them under a truthful T4 lifecycle header, which the process-helper lint exempts like T3 headers. Hub-state checks inside prepared-project and project-hub still move to injected seams.

## Acceptance criteria

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - done: impl-901 · 2026-10-19T19:32:33.686Z
  - verified: rev-30 [reviewer] · run rev-20261019-901-source · 2026-10-19T19:45:15.753Z · commit 1c1496a09b4466b6b41593e005e298ba90c43f32
  - verified: rev-30 [reviewer] · run rev-20261019-901-final · 2026-10-19T19:55:48.281Z · commit 1c1496a09b4466b6b41593e005e298ba90c43f32
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-901 · 2026-10-19T19:53:39.675Z
  - verified: rev-30 [reviewer] · run rev-20261019-901-final · 2026-10-19T19:55:48.281Z · commit 1c1496a09b4466b6b41593e005e298ba90c43f32

## Comments

### impl-901 · 2026-10-19T19:30:26.282Z

Migration implemented: prepared-project keeps native Git T4 assertions with projectHub for state; project-hub adapter timing now uses production environment wiring, injected execFile and FakeClock at T2; four native transport/leak checks moved intact to project-hub-lifecycle at T3. T4 lifecycle exemption has a red/green policy regression. Initial targeted cases pass; finishing static checks, baseline shrink and retained native receipts.

### rev-30 · 2026-10-19T19:45:15.753Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-901-source
commit: 1c1496a09b4466b6b41593e005e298ba90c43f32
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, standards/spec no findings, A-6476. C1 verified under recorded Coordinator T4 lifecycle policy; T4 exemption only applies to declared T4 headers and keeps wait/tier rules. Independent exact-body checks confirm native transport/leak split and unchanged prepared/orphan assertions. New T2 adapter clock proof retains production env wiring and passes quiet .258765667s; orphan raw 2/2 green A-6453, T2 raw A-6455. C2 awaits exact-head mode-free gate and new policy/adapter identities' 5/5 load receipts. Preserve original prepared/lifecycle/policy stdout as durable evidence without rerunning solely to transcribe. T3/T4 Linux remains periodic/integrated/stage evidence, no task claim; QA none.

Criteria: C1 verified.

### impl-901 · 2026-10-19T19:53:54.706Z

Reviewed head 1c1496a09b4466b6b41593e005e298ba90c43f32 passed mode-free run 2352a121-21ee-4b15-a91e-135a2f78fc18 (A-6510): 1,634 passes, zero failures/cancellations/skips. Both migrated timing and T4 policy identities have ordinary passes plus five positive load-gate receipts each (A-6510 lines 39311, 42429). C1/C2 claimant done marks recorded; no source changes or new duration allowances. Droplet Linux x64 c-8 lon1, 381s lifetime, $0.0265. Original local stdout/provenance A-6484 and quiet native orphan receipt A-6453 preserved. T3/T4 remain periodic/integrated/stage evidence per queue policy. Final evidence review pending.

### rev-30 · 2026-10-19T19:55:48.281Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-901-final
commit: 1c1496a09b4466b6b41593e005e298ba90c43f32
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear A-6519 at unchanged1c1496a0. RawA6510 exact-head2352a121audited1634/1634 zero fail/cancel/skip/TODO,47groups5/5,noownedbudget/resource. Policyordinary.005296502s/repsmax.311887876s<T1.5; adapterordinary.200298977s/repsmax.278595946s<T2 2. Original native/policy stdoutA6484hashesmatchprovenance and all1+4+32pass; quietT4A6453retained. C1/C2verified acrossA6476andcurrentreceipts. Linux381s/$0.0265; retainedT3/T4Linuxperiodic/integrated/stage, QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:06:58.371Z

Merged ab53036f0b16babf71e210552475ad23b0f99f54 onto dev.
