---
id: T-903
kind: task
title: "Process-helper migration: Neovim tests (artifacts, crew, inbox requests, needs-you)"
state: open
status: review
size: M
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-641
branch: t/T-903-process-helper-migration-neovim-tests
created: 2026-10-19T19:27:17.818Z
updated: 2026-10-19T19:44:35.317Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| nvim/test/artifacts.test.ts | T3 | 4 | 4 | 0 | 0 | 0 | 8 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/crew.test.ts | T3 | 1 | 0 | 0 | 0 | 0 | 1 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/inbox-requests.test.ts | T3 | 1 | 1 | 1 | 0 | 0 | 3 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/needs-you.test.ts | T3 | 1 | 1 | 1 | 0 | 0 | 3 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |

## Acceptance criteria

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.

## Comments

### impl-903 · 2026-10-19T19:34:22.495Z

Implementation split into recorded-frame Neovim screens and injected hub-rule files. Added Coordinator-authorized additive artifact/prompt stub handlers and notified T-902 about the ordinary artifact.list moved-id filter. Initial typecheck and injected needs-you cases green. Local recorder held by its <15 load guard; continuing static checks until load settles.

### impl-903 · 2026-10-19T19:34:59.266Z

Split into recorded-frame screens and injected hub-rule files. Added Coordinator-authorized additive artifact/prompt stub block; T-902 notified of isolated artifact.list moved-id filter. Initial typecheck and injected needs-you checks pass. Full local census currently blocks recorder/timing evidence by Coordinator quiet-window instruction; static checks continue.

### impl-903 · 2026-10-19T19:44:35.317Z

Source pushed for first review at 591082767c74134a17d50a079cf503be87b6d96a after fresh origin/dev integration and clean merge-tree. Recorded slices cover all 14 screens; serial replay of all 8 owned files passed 26/26 with no skips at load <15, preserved in A-6474. Assertion map A-6452. Typecheck/tiers pass at final head; root check passed before final dev integration. 15 process-helper calls + crew wait retired, baseline all zero, no allowance. Reviewer request queued for the next free live verifier; holding exact-head mode-free verify until source clear.
