---
id: T-902
kind: task
title: "Process-helper migration: Neovim tests (sessions, items, item prefixes, agent filters)"
state: open
status: review
size: M
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-639
branch: t/T-902-process-helper-migration-neovim-tests
created: 2026-10-19T19:27:17.295Z
updated: 2026-10-19T19:47:09.794Z
---

## Summary

Part of T-775 C1 (E-677 stage 3, D63): these test files still call process helpers (startDaemon, spawnSpoke, fake harness processes) outside contract, scenario and truthful T3-header lifecycle files. Migrate their rule assertions to injected in-process seams (projectHub, inProcessSpoke, FakeClock, injected Git facts, store reopen) at T2 or T1. Keep any genuinely native lifecycle assertion in a separate T3-header lifecycle file or case. Disposition per file is from impl-775's audit A-6408.

## Files

| File | Current tier | startDaemon | spawnSpoke | fakeClaude | fakeCodex | fakeOpenCode | Total | Target | Disposition |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |
| nvim/test/sessions.test.ts | T3 | 5 | 2 | 2 | 2 | 0 | 11 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/items.test.ts | T3 | 5 | 0 | 1 | 0 | 0 | 6 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/item-prefixes.test.ts | T3 | 2 | 2 | 0 | 0 | 0 | 4 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |
| nvim/test/agents-filters.test.ts | T3 | 2 | 6 | 0 | 0 | 0 | 8 | T2 | T2 recorded-frame screen + injected hub rules; retain actual UI-launched native harness death/attach only in a T3-header seam if present |

## Acceptance criteria

- [ ] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.

## Comments

### impl-902 · 2026-10-19T19:38:57.913Z

Migrated screen/process boundaries in the working tree. Four injected T2 hub rule files retain tracker, hold, account and history assertions; native UI attach/death/stop is isolated in sessions-lifecycle.test.ts. Coordinator approved additive shared-stub support. Typecheck and tier lint are green; lint baseline shrink is limited to owned entries. Waiting for the census quiet window before recorder and timing evidence.

### impl-902 · 2026-10-19T19:47:09.794Z

Source fd8d767d7a63ab15f43399185b3e7c56e5055659 is committed and pushed to origin after merging current origin/dev. Source review is queued to the Reviewer role. All targeted rule/screen files and the retained T3 lifecycle case pass; npm run check, tier lint, T2 import-boundary guard and full recording-integrity check pass. Catalog adds 237 records without changing existing records. Assertion map A-6449; serial receipts A-6490. Awaiting source verdict before exact-head mode-free verification.
