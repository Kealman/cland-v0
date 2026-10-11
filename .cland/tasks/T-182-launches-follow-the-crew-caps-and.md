---
id: T-182
kind: task
title: "Launches follow the crew: caps and singletons, idle pool reuse, per-item stop after merge, subagents in clauses"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-182
parent: T-113
blocked_by:
  - T-176
  - T-181
topic: topic-116
branch: t/T-182-launches-follow-the-crew-caps-and
created: 2026-10-10T15:38:37.088Z
updated: 2026-10-11T06:33:43.644Z
---

## Parent

T-113, slice 7 of 7. Read the epic's Contents, its choices where the spec is silent, and its Constraints, which apply to this slice.

## What to build

Caps and singletons enforced by `session.launch`; an idle pool member returned for a `keep_context` pool; `per-item` sessions stopped after their merge; `subagents` in the role clauses; the Coordinator's clause launches Leads for the levels in `leads`.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-182 · 2026-10-11T05:22:23.323Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-3 · 2026-10-11T05:23:22.739Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-4 · 2026-10-11T06:33:43.644Z
- [x] C2. Demo: a review request while a Reviewer is idle reuses it; a third Reviewer launch with `size = 2` is refused.
  - done: impl-182 · 2026-10-11T05:05:56.453Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-1 · 2026-10-11T05:11:58.747Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-2 · 2026-10-11T05:20:35.934Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-3 · 2026-10-11T05:23:22.739Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-4 · 2026-10-11T06:33:43.644Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-182 · 2026-10-11T05:05:57.483Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-1 · 2026-10-11T05:11:58.931Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-2 · 2026-10-11T05:20:36.137Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-3 · 2026-10-11T05:23:22.739Z
  - verified: rev-14 [reviewer] · run rev-20261011-182-4 · 2026-10-11T06:33:43.644Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-182 · 2026-10-11T04:55:37.437Z

Claimed on t/T-182-launches-follow-the-crew-caps-and at dev 438e53e. Implementing crew enforcement at session launch, retained pool reuse, per-item merge termination, and dynamic staffing/subagent role clauses; verification through protocol/fake-harness tests.

### impl-182 · 2026-10-11T05:00:51.785Z

Coordinator decision 2af75867-a7d1-40be-baaa-094b5777ed80: cross-item retained reuse is root-based Reviewer/QA only for this slice. Other roles reuse only matching cwd. Implementer pool launches remain capped and use each item's worktree; launch results explain why a different item needs a fresh session. Follow-up required for native worktree handoff.

### impl-182 · 2026-10-11T05:05:58.206Z

Pushed b8eba8615df6e7784b1e3994219ba812129161d6 after fetching/merging origin/dev (438e53e). Targeted crew-launch checks pass: pool reuse/cap/handoff, native Codex clause, singleton/per-item concurrency, live crew clause updates, merge stop vs never. All 8 existing session-launch tests pass; subscription crash/restart case passes after declaring its two-Reviewer crew. Typecheck passes. docs/agents/T-182-handover.md gives exact roles.toml line 46 replacement; T-211 owns cross-worktree native handoff. Requesting rev-14 review and required suite all next.

### rev-14 · 2026-10-11T05:11:59.101Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-182-1
commit: b8eba8615df6e7784b1e3994219ba812129161d6

Medium — hub/src/adapters/sessions.ts:486 and :149; hub/src/hub/merge.ts:178: await #reuse moves launch scans/admission/reservations outside resumed, and merge-stop policy scans/stop initiation are unmeasured after awaits, violating hub/README.md:403. Real memory-SQLite diagnostic confirms the first crew scan is unmeasured while later revalidation is measured.
Low (heuristic) — hub/src/adapters/sessions.ts:117 and :130: possible Duplicated Code in reuse eligibility checks risks predicate drift.
Spec: no confirmed findings. C2/C3 separately verified; C1 failed; C4 pending. Evidence A-1053 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1053-t-182-review-not-clear-at-b8eba86-measured-lifecycle-continuations.md.

Criteria: C1 failed (New launch admission and merge-stop continuations after awaits execute outside the request resumer; wrap each synchronous stretch.).

### impl-182 · 2026-10-11T05:15:17.657Z

Review correction prepared in isolated T-182-review-fix checkout while suite 5d291258 remains pinned to b8eba86. New-launch admission enters the request resumer after await reuse; merge-stop scans and each stop initiation are measured, including later stops after awaits. Reuse eligibility now shares one helper for selection/revalidation. New regression checks prove crew scans and two sequential stop initiations are measured. All 16 launch-admission tests, four crew-launch tests and typecheck pass on the corrected source. Waiting for the existing full-suite result before applying the correction to the task branch and re-requesting review/full suite.

### impl-182 · 2026-10-11T05:18:32.995Z

Pushed corrected head 03aca8f5b8cf73b530fccb7bb10bd46cc7b3ba81 after merging origin/dev da0d0c4. A-1053 measurement findings fixed: new-launch admission and sequential merge-stop initiation use resumed; shared reuse eligibility eliminates duplicated checks. Launch-admission tests 16/16 pass in the task worktree; crew-launch 4/4 and typecheck passed on identical correction before dev merge. Obsolete b8eba86 suite cancelled cleanly (exit 143, A-1056); requesting fresh review and one corrected-head full suite. C4 remains pending.

### rev-14 · 2026-10-11T05:20:36.309Z

verdict: review
result: not clear
by: rev-14 [reviewer]
run: rev-20261011-182-2
commit: 03aca8f5b8cf73b530fccb7bb10bd46cc7b3ba81

Medium — hub/src/adapters/sessions.ts:118; hub/src/hub/worktrees.ts:211 and :236: item-bound launch after awaited preparation has no outer resumer, so initial reuse candidate/process/hold/delivery scans execute unmeasured. Authorization measures only itself. Wrap the initial selection or launch initiation; test the actual item-bound caller. Independent memory Tracker/TaskWorktrees/Sessions probe confirms candidate scan false, later admission scans true.
Prior admission/merge-stop/duplication findings are fixed. Spec has no findings. C1 failed; C2/C3 separately reverified; C4 pending. T-210 exception does not apply to this head. A-1064 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1064-t-182-correction-review-not-clear-at-03aca8f-item-bound-reuse-scan.md.

Criteria: C1 failed (Actual item-bound TaskWorktrees launch calls Sessions after an await outside resumed; initial retained-pool candidate scan remains unmeasured.).

### impl-182 · 2026-10-11T05:22:23.569Z

Pushed d3092af59079b116ea098fe9f85c7fffa2421de8 after fetch/merge origin/dev (already current da0d0c4). Fixed A-1064 by measuring initial validation and reuse selection within Sessions.launch. Extended regression through actual Tracker/TaskWorktrees item-bound preparation: it failed before fix and passes afterward. All 16 launch-admission tests and hub typecheck pass. Superseded 03aca8f full suite interrupted cleanly, exit143 A-1065. Fresh review and one final full suite requested next; C4 remains pending.

### rev-14 · 2026-10-11T05:23:22.739Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-182-3
commit: d3092af59079b116ea098fe9f85c7fffa2421de8

No high, medium or low findings. Standards: initial validation/reuse selection is measured within Sessions.launch, fixing the actual item-bound caller; post-await admission and sequential merge stops stay measured, and shared eligibility resolves duplication. Spec: crew behavior/native identity/safeguards/approved cwd scope unchanged.
C1/C2/C3 verified. Real memory Tracker/TaskWorktrees diagnostic now records all candidate/admission scans measured. Actual-caller regression, invalid cwd and two awaited stops reviewed. Exact role line 46 handover A-1067 remains applicable. C4 pending complete d3092af suite; no exceptions apply. Evidence A-1068 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1068-t-182-measurement-correction-clear-at-d3092af-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-182 · 2026-10-11T06:30:59.332Z

Published 1fd66c7d7c8ec38113641739dcfb89297ef2db30 after merging dev 688f28c. A-1092's 11 failures reconciled with explicit crew fixtures; no production change. All former failing cases pass targeted (13 checks), crew-launch 4/4 and hub typecheck pass. Fixture rationale in updated handover and artifact A-1094. C4 remains unverified pending a complete current-head suite; requesting rev-14 delta review before it.

### rev-14 · 2026-10-11T06:33:43.644Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-182-4
commit: 1fd66c7d7c8ec38113641739dcfb89297ef2db30

No high, medium or low findings. Standards and Spec clear. Fixture policies preserve claim/concurrency races, assignment exclusivity, sandbox/subtree checks and deferred cleanup protections; default automatic merge stop remains independently covered. Incoming T-180 integrates without changing crew launch, merge-stop or TaskWorktrees production. Actual item-bound memory diagnostic still confirms all candidate/admission scans measured and invalid cwd refused. C1/C2/C3 reverified; C4 pending complete current-head typecheck/hub/Neovim evidence, no exceptions. A-1094 reports former failures passing targeted; full-package clearance is not inferred. Evidence A-1095 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1095-t-182-fixture-and-t-180-integration-clear-at-1fd66c7-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.
