---
id: T-897
kind: task
title: "Process-helper migration: session tests"
state: open
status: review
size: M
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-635
branch: t/T-897-process-helper-migration-session-tests
created: 2026-10-19T19:27:16.282Z
updated: 2026-10-19T19:45:34.245Z
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

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.

## Comments

### impl-897 · 2026-10-19T19:35:26.734Z

Implementation in progress: authorized native-default TaskWorktrees Git-operation seam committed separately as 917fb602. All five original files now have injected T2 cases and named T3 splits. Functional T2 checks green for launch, resume, Claude rule groups and seven worktree policy/budget cases; cleaning lint/imports and assertion map. No timing evidence claimed during Coordinator's high-load window; retained T3 local runs wait for quiet window.

### impl-897 · 2026-10-19T19:45:34.245Z

Committed/pushed 5917d81ccaf033319660947c0cab9b240859ffbd after pre-first-review origin/dev integration and clean merge-tree. Source review requested. A-6478 contains final assertion map, root check/tier/lint logs and exact-head serial targeted receipts for all five injected T2 and five retained T3 files (all pass, no skips). Authorized standalone native-default TaskWorktrees seam is 917fb602; Coordinator approved native territory contract disposition in 44e04850. No allowance added. Awaiting source verdict before mode-free verify; no per-item QA required.
