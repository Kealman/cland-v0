---
id: T-900
kind: task
title: "Process-helper migration: CLI tests (aide claims, artifacts, GitHub import)"
state: open
status: review
size: S
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-638
branch: t/T-900-process-helper-migration-cli-tests-aide
created: 2026-10-19T19:27:16.880Z
updated: 2026-10-19T19:47:31.284Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| hub/test/aide-claims.test.ts | T3 | 1 | 2 | 0 | 0 | 0 | 3 | T2 | Claim/review permissions: projectHub + inProcessSpoke; retain native Git worktree assertions at the CLI seam. |
| hub/test/artifact-cli.test.ts | T3 | 0 | 1 | 0 | 0 | 0 | 1 | T2 | CLI artifact commands remain subprocess subjects; replace the permission-probe spoke with inProcessSpoke. |
| hub/test/import-github.test.ts | T3 | 2 | 0 | 0 | 0 | 0 | 2 | T2 | CLI is the subject; use projectHub and fake GitHub responses; retain hub-down CLI refusal in a T3-header case. |

## Acceptance criteria

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-31 [reviewer] · run rev-20261019-900-source-2 · 2026-10-19T19:47:01.422Z · commit f80390dc95d80b1a42a680758e1a85b44e7bd0ad
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - failed: rev-31 [reviewer] · 2026-10-19T19:35:21.153Z · note Moved T2 cases retain non-exempt native Git starts and submitted over-budget timings; no compliant final-source T1/T2 gate evidence yet.

## Comments

### impl-900 · 2026-10-19T19:30:24.198Z

Implemented the three owned T2 migrations with inProcessSpoke/projectHub/FakeClock and injected verdict Git facts. All original assertions preserved; hub-down CLI refusal split into truthful T3 import-github-lifecycle.test.ts; pure label mapping split to T1 import-github-unit.test.ts. Initial targeted files and typecheck green. Moved runtime test names identify their in-process seam so mode-free task verify obtains five fresh load repetitions rather than inheriting native-era identity baselines. No duration allowance added. Final serial targeted checks and lint shrink next.

### impl-900 · 2026-10-19T19:33:11.506Z

Committed/pushed 724d1d50 after fetch/merge origin/dev (already current); pre-push merge-tree clean. A-6424 contains source/criterion map, all five whole-file raw logs, 159/159 identical assertion multiset, typecheck/tiers/full lint logs. C1 helper sites zero; no duration allowance change. Source review requested through reviewer role; mode-free task verification will run only after source-clear. Retained T3 hub-down case is locally green; its Linux receipt remains landing evidence.

### rev-31 · 2026-10-19T19:35:21.153Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-900-source-1
commit: 724d1d50c45b94a10d055412dd1fe67fe44db997
scope: full
findings: [{"severity":"medium","text":"M1: Newly T2 fixtures still start native Git directly (also artifact-cli.ts gitIn and import-github.ts spawnSync). The documented exemption covers only the cland/clandWithEnv CLI subject; baseline helper removal and FakeClock do not establish the T2 resource boundary. Retain native assertions in truthful T3 cases or obtain explicit Coordinator disposition.","file":"hub/test/aide-claims.test.ts","line":13},{"severity":"medium","text":"M2: Raw submitted T2 cases take 10.302879375 s here and 4.833269833/2.292978917 s in import-github, above the 2 s budget. Disclosed concurrent load makes them functional evidence only; final-source lower-tier budget compliance remains unestablished. Preserve assertions while reducing/splitting the cases; no new allowance.","file":"hub/test/aide-claims.test.ts","line":59}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards: two medium findings, native Git outside the documented CLI exemption and measured over-budget T2 cases. Spec: no assertion-retention finding; all original assertions remain or move intact, helper baseline rows are zero, no duration allowance changes. C2 cannot be established by functional-only receipts with these resource/budget gaps. Implementer confirms no further Coordinator disposition and will revise before verification. See source audit artifact in topic-638; corrected head needs fresh source review.

Criteria: C2 failed (Moved T2 cases retain non-exempt native Git starts and submitted over-budget timings; no compliant final-source T1/T2 gate evidence yet.).

### impl-900 · 2026-10-19T19:41:36.074Z

M1/M2 revised and replacement source f80390dc95d80b1a42a680758e1a85b44e7bd0ad pushed. A-6459 supersedes A-6424 source/timing evidence: all 159 original assertions kept (174 after split preconditions), zero enforced runtime T1/T2 resource violations, all helper baseline rows empty. Native invariants now in T3 splits. Quiet-window serial pass after Coordinator notice: all 17 tests green; max T2 1.552s, T1 <0.5s, max T3 4.220s; all per-file budgets met. Typecheck/tiers/full lint green, no new allowance. Fresh source review requested; C2's mode-free Linux and 5/5 gates still pending.

### rev-31 · 2026-10-19T19:47:01.422Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-900-source-2
commit: f80390dc95d80b1a42a680758e1a85b44e7bd0ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards: M1/M2 resolved, no remaining findings. Native Git worktree/ref/HEAD/index assertions live in truthful T3 splits; T2 uses injected facts/static metadata and existing GhRunner entry while retaining documented CLI frame subjects. Missing-GitHub failure avoids the wall-clock retry. Seven baseline rows empty, no allowance change; C1 verified. Spec: original assertions/case meaning preserved across split. Independently read Coordinator quiet-window/timing dispositions b80bb557/0e1f695f and all seven raw A-6459 logs: 17 pass, slowest T2 1.551800625 s, T1 .000692333 s, native T3 4.220488042 s; all test/file budgets met, enforcement reports zero trips. C2 awaits exact-head mode-free Linux verification and all twelve moved lower-tier identities 5/5; retained T3 local proof accepted with Linux T3 remaining periodic/integrated evidence. Detailed corrected source artifact in topic-638.

Criteria: C1 verified.

### impl-900 · 2026-10-19T19:47:31.284Z

Source-clear A-6491 at unchanged f80390dc; C1 verified by Reviewer. Mode-free cland verify admitted run dc479d17-fb37-48b3-9558-396c462e33d3, reporting to topic-638, reviewing holder and claimant. Waiting idle for its exact-head Linux receipt; C2's 12 identities ×5 repetitions remain pending. Retained T3 cases are locally green and Linux T3 stays landing evidence.
