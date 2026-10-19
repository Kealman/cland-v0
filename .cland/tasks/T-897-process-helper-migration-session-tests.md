---
id: T-897
kind: task
title: "Process-helper migration: session tests"
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
topic: topic-635
branch: t/T-897-process-helper-migration-session-tests
created: 2026-10-19T19:27:16.282Z
updated: 2026-10-19T20:31:47.042Z
closed: 2026-10-19T20:31:47.042Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/session-launch.test.ts | T3 | 0 | 1 | 2 | 0 | 0 | 3 | T2 | Role/brief/env launch rule tables become T2 fake adapters and inProcessSpoke; retain one native contract proof. |
| hub/test/session-resume.test.ts | T3 | 0 | 0 | 1 | 1 | 0 | 2 | T2 + named T3 lifecycle split | Retain native persisted conversation resume in the harness contract/T3-header seam; injected refusal fallback and role/claim restoration rules in T2. |
| hub/test/session-async-processes.test.ts | T3 | 1 | 0 | 0 | 3 | 0 | 4 | T2 + named T3 lifecycle split | Keep native CLI/log and process-spawn instrumentation in a T3-header lifecycle seam; move pure dispatch/log timing rules to injected T2. |
| hub/test/task-worktrees.test.ts | T3 | 0 | 3 | 2 | 0 | 0 | 5 | T2 | Worktree rules use injected Git facts/adapters and inProcessSpoke; retain actual native first-turn worktree placement and prune/stop boundary in T3-header lifecycle seam. |
| hub/test/claude-code-sessions.test.ts | T3 | 0 | 2 | 10 | 0 | 0 | 12 | T2 | Split rule permutations to injected T2; retain hook-process ordering, PID resume identity, TERM escalation and held-hook reaping in T3 with a header or the Claude contract. |

## Acceptance criteria

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-30 [reviewer] · run rev-20261019-897-source-corrected · 2026-10-19T19:59:51.322Z · commit 36cc8be8c31d2e0af88df82e20cb4abb44a22aad
  - verified: rev-30 [reviewer] · run rev-20261019-897-compatibility-source-corrected · 2026-10-19T20:14:45.420Z · commit 46514ac31324309411af8d742dd0684a2fdc2a00
  - done: impl-897 · 2026-10-19T20:23:09.293Z
  - verified: rev-30 [reviewer] · run rev-20261019-897-final · 2026-10-19T20:23:10.621Z · commit 46514ac31324309411af8d742dd0684a2fdc2a00
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-897 · 2026-10-19T20:23:09.918Z
  - verified: rev-30 [reviewer] · run rev-20261019-897-final · 2026-10-19T20:23:10.621Z · commit 46514ac31324309411af8d742dd0684a2fdc2a00

## Comments

### impl-897 · 2026-10-19T19:35:26.734Z

Implementation in progress: authorized native-default TaskWorktrees Git-operation seam committed separately as 917fb602. All five original files now have injected T2 cases and named T3 splits. Functional T2 checks green for launch, resume, Claude rule groups and seven worktree policy/budget cases; cleaning lint/imports and assertion map. No timing evidence claimed during Coordinator's high-load window; retained T3 local runs wait for quiet window.

### impl-897 · 2026-10-19T19:45:34.245Z

Committed/pushed 5917d81ccaf033319660947c0cab9b240859ffbd after pre-first-review origin/dev integration and clean merge-tree. Source review requested. A-6478 contains final assertion map, root check/tier/lint logs and exact-head serial targeted receipts for all five injected T2 and five retained T3 files (all pass, no skips). Authorized standalone native-default TaskWorktrees seam is 917fb602; Coordinator approved native territory contract disposition in 44e04850. No allowance added. Awaiting source verdict before mode-free verify; no per-item QA required.

### rev-30 · 2026-10-19T19:52:46.811Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-897-source
commit: 5917d81ccaf033319660947c0cab9b240859ffbd
scope: full
findings: [{"severity":"medium","text":"M2/C2: the original public hub.status requests.slow assertion was replaced by guard.counters.slow. This no longer detects missing or stale public status counter wiring. Restore the actual hub.status request/returned-field assertion; the connected UI and injected guard already exist.","file":"hub/test/session-async-processes.test.ts","line":86},{"severity":"medium","text":"M3/C2: fresh Codex resume no longer asserts a different returned harnessSessionId. Omitting resumeConversation in a spawn request does not prove the returned session uses a new conversation; FakeHarness currently aliases conversation identity to the stable cland sessionId. Use distinct scripted conversation IDs and retain the returned-ID inequality while preserving stable cland identity/model/cwd/brief.","file":"hub/test/session-resume.test.ts","line":71},{"severity":"medium","text":"M1/C2: 13 migrated top-level identities retain exact keys present in dev duration tests, so loadGateRepetitions returns 0 and the required five task repetitions will be skipped. Give reworked migrated cases fresh descriptive identities (including generated names/nested ownership as applicable), without deleting baselines or changing shared load policy, before verification.","file":"hub/test/session-launch.test.ts","line":47}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear A-6503. Standards seam/native-default construction/helper retirement sound; all10localfiles35/35 pass and no allowance change. C2 has3medium Spec findings:13known moved keys skip load repetitions; public status counter check replaced by internal guard; returned fresh Codex conversation identity no longer differs in the proof. Restore these assertions and fresh migrated identities, request new source review before verify. C1sourcecondition established; native Linux periodic/integrated and QA none.

Criteria: C2 failed (M1:13 migrated identities remain known and skip five task repeats; M2 public status counter assertion lost; M3 returned fresh Codex conversation-ID inequality lost.).

### impl-897 · 2026-10-19T19:56:25.373Z

A-6503 M1–M3 corrected and pushed as 36cc8be8c31d2e0af88df82e20cb4abb44a22aad; fresh source review requested. A-6520 holds 5/5 serial T2 file passes (22 tests/subtests), npm run check green, and actual-reporter identity audit: 20 moved top-level cases, zero known baseline keys, all eligible for five repetitions under unchanged policy. Public hub.status requests.slow assertion and returned fresh Codex conversation-ID inequality restored. Native source/proofs unchanged; no dev merge after first review or baseline/policy/allowance edits. Mode-free verification awaits source clearance.

### rev-30 · 2026-10-19T19:59:51.322Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-897-source-corrected
commit: 36cc8be8c31d2e0af88df82e20cb4abb44a22aad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear; A-6503 M1–M3 resolved. A-6526 records both axes and independent raw reporter/baseline audit: all twenty migrated top-level identities are fresh and eligible for five repetitions; raw local 22/22. Public hub.status requests.slow and distinct returned Codex conversation assertions restored. C2 remains pending exact-head mode-free Linux ordinary plus all twenty five-repetition receipts, overall green/no owned budget or resource trip. Local native evidence remains A-6478, not task T3. QA none.

Criteria: C1 verified.

### rev-30 · 2026-10-19T20:09:41.763Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-897-native-probe-failed
commit: 36cc8be8c31d2e0af88df82e20cb4abb44a22aad
scope: evidence
findings: [{"severity":"medium","text":"M4/C2: the migrated T2 stop/status rule emits child_process.spawn via doctor/report.ts and hub/lock.ts startedProbe (A-6556:47642). Inject the fixture process/probe facts to eliminate native ps while retaining the real hub.status returned requests.slow assertion, stop/log assertions and tripwire; fresh source and exact-head verification required.","file":"hub/test/session-async-processes.test.ts","line":61}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear on owned resource boundary, A-6565. A-6556 functionally passes 1670/1670; all twenty moved ordinary cases +100 repetitions pass within budgets, but one owned T2 child_process.spawn mismatch escapes through startedProbe. This is not a covered budget aside. M1–M3 remain resolved; keep public status assertions and eliminate native probe via fixture facts, then fresh source review before replacement mode-free verification. C2 failed; QA none.

Criteria: C2 failed (Owned T2 stop/status case spawns native ps (A-6556:47642) despite functionally green ordinary/five repetitions; fixture correction required.).

### impl-897 · 2026-10-19T20:13:47.910Z

M4 fixed and pushed at 46514ac31324309411af8d742dd0684a2fdc2a00; fresh source review requested. A-6586 records a deterministic fixture-only suite-owner reproduction under enforcing tripwire (red exact ps stack, then green with existing verification.compatibility facts), all five T2 files passing with resource mode enforce/no trips, unchanged twenty-key 5-repeat eligibility, and npm run check green. All public status/stop/log assertions retained; no production/native/tier/baseline/allowance changes. Prior 1ff894a8/A-6556 is functional green but not completion evidence due M4; replacement mode-free verify waits for source clearance.

### rev-30 · 2026-10-19T20:14:45.420Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-897-compatibility-source-corrected
commit: 46514ac31324309411af8d742dd0684a2fdc2a00
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

M4 corrected source clear, A-6594. Existing compatibility injection and fixture-only lock path eliminate native owner probe without changing public stop/status/log assertions, production or tripwire. A-6586 red reproduces exact enforced native spawn; targeted green and all five resource-enforced files raw22/22 pass. Independent reporter/baseline audit retains twenty fresh top-level identities eligible for five repetitions. C1 verified; C2 awaits replacement exact-head overall green, twenty ordinary +100 repetition passes within budget and no owned resource mismatch. Native A-6478 unchanged; QA none.

Criteria: C1 verified.

### rev-30 · 2026-10-19T20:23:10.621Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-897-final
commit: 46514ac31324309411af8d742dd0684a2fdc2a00
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final current-head clear, A-6615. Independent raw A-6613/20a35d22: 1670/1670, zero fail/cancel/skip/TODO, all82 load groups5/5 and zero resource mismatch. All20 exact migrated keys have one ordinary +5 passing repetitions (100); max .564749115 s<T2 2 s, no owned budget row. Stop/status max .082484790 s, prior native ps mismatch absent. Source A-6526/A-6594 resolves M1–M4 while preserving public assertions and native splits; unchanged local native proofs A-6478 retained. C1/C2 verified. No new allowance; native Linux T3 periodic/integrated, QA none.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-19T20:31:47.042Z

Merged 9e3ca0dbafc774191bffb65bbafaac8c8b778a37 onto dev.
