---
id: T-854
kind: task
title: The stack step records the project's `[verification]` commands with `cland config set`, and no npm wording is left
state: closed
status: done
size: S
criterion_seq: 4
labels:
  - v0.1.4
  - ready-for-agent
assignee: null
parent: E-616
blocked_by:
  - T-853
topic: topic-579
branch: t/T-854-the-stack-step-records-the-project-s
created: 2026-10-19T08:10:02.748Z
updated: 2026-10-19T12:20:17.638Z
closed: 2026-10-19T12:20:17.638Z
---

## Summary

The stack becomes a rule, "Build with <stack>; checks: <commands>". On the same yes its commands go into `[verification] prepare`, `check` and `test` through `cland config set` (§3.4 step 6, §3.7, D51 decision 9). The prototype's advice to fit the npm scripts, wrap other tools in them, or add them as a criterion goes.

## What to build

- **SKILL.md §4.**
  - The rule is recorded as before.
  - Then come `cland config set verification.test "<line>"` (required: verify refuses without it), `verification.check` when the stack has a fast gate, and `verification.prepare` when its checks need an install. Each runs under POSIX `sh -c`, per D51 decision 12.
  - The Aide reads the values back with `cland config set`'s result, or by reading `config.toml`.
  - The paragraph about `npm run typecheck`/`npm test` and `pretypecheck` is deleted.
  - When a command cannot be named yet, because the project has no test runner, the first task gets a criterion to add one, and the step records the key once that task names it. Recommended: record a placeholder only if verify accepts one (open question 5).
- **EXISTING.md step 1.** The tests bullet asks the study for the commands that would serve as `prepare`, `check` and `test`, instead of whether `npm run typecheck` and `npm test` exist.
- **T2 case.** An Aide runs `config set verification.test "python3 -m unittest"`, `verification.check "python3 -m compileall -q ."` and `verification.prepare "true"`, and the hub reads each back verbatim. This is QA's toy stack from D51 decision 13.

## Acceptance criteria

- [x] C1. SKILL.md §4 records the stack rule and then `verification.test`, `verification.check` and `verification.prepare` through `cland config set`, with `test` required and the other two optional (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-854-source · 2026-10-19T11:27:54.512Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - verified: rev-30 [reviewer] · run rev-20261019-854-final · 2026-10-19T11:45:09.664Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - done: impl-854 · 2026-10-19T11:45:20.852Z
- [x] C2. No file of the onboarding skill names `npm run typecheck`, `npm test`, `pretypecheck` or another npm-specific verification line (T1 assertion in skills-onboarding.test.ts).
  - verified: rev-30 [reviewer] · run rev-20261019-854-final · 2026-10-19T11:45:09.664Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - done: impl-854 · 2026-10-19T11:45:21.510Z
- [x] C3. EXISTING.md's study asks for the project's prepare, check and test commands (source review).
  - verified: rev-30 [reviewer] · run rev-20261019-854-source · 2026-10-19T11:27:54.512Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - verified: rev-30 [reviewer] · run rev-20261019-854-final · 2026-10-19T11:45:09.664Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - done: impl-854 · 2026-10-19T11:45:22.090Z
- [x] C4. Run as an Aide against an in-process hub, the three `cland config set verification.*` lines with the python3 values are accepted and read back verbatim (T2).
  - verified: rev-30 [reviewer] · run rev-20261019-854-final · 2026-10-19T11:45:09.664Z · commit e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
  - done: impl-854 · 2026-10-19T11:45:22.784Z

## Comments

### impl-854 · 2026-10-19T11:25:56.488Z

Implementation started. E-616 decision 5 governs missing runners: first-task criterion, then record verification.test once a real command exists. Planned checks: T1 skill text guard and T2 Aide CLI round-trip against projectHub.

### rev-30 · 2026-10-19T11:27:54.512Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-854-source
commit: e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5958. Standards/Spec: no findings. Required test and optional check/prepare follow stack rule on same yes, POSIX shell/readback explicit. Missing runner uses first-task real-command criterion per E-616 decision 5, no placeholder. Study asks prepare/check/test; tour npm prescription removed. C1/C3 verified. Recursive pure guard and projectHub Aide exact-value CLI table retain existing controls; C2/C4 await same-head mode-free gate. A-5957 host checks retained; no Reviewer edits/tests. QA none.

Criteria: C1 verified, C3 verified.

### rev-30 · 2026-10-19T11:45:09.664Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-854-final
commit: e439e7adf7d2d12fc2bbc78ceb110dd8846511c8
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-5989. Full A-5987/2ae0aaa4 audited: 1509/1509 ordinary passed, zero fail/cancel/skip/TODO, zero tier-mismatch rows and all 432 groups 5/5. New recursive npm guard and exact three-command Aide CLI round-trip pass ordinarily and 5/5; prior guards/approval case retained. C1–C4 verified using A-5958 source plus this evidence. No findings; report-only diagnostics retained, T3 landing evidence deferred. Claimant done boxes were unchecked at readback; Implementer owns those marks.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-854 · 2026-10-19T12:11:45.669Z

Landing blocked: merge batch 8942325b-f26f-410d-8f50-e8c5b6fad311 (T-509/T-836/T-854), run 22fe413f-e4d1-4b68-a7d6-e3d1ba10d82d failed hub/test/resilience.test.ts::a spoke acks every deliver and hands a message re-sent under the same id to its session once. Log A-6016. Reported through lead T-854 for Coordinator triage; holding diagnosis and source changes. Reviewed head e439e7ad and its green task receipt 2ae0aaa4 unchanged.

### coord · 2026-10-19T12:20:17.638Z

Merged c15a2fbc385da697c2609ad825eff5acb2182095 onto dev.
