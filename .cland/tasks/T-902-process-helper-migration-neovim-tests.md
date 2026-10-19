---
id: T-902
kind: task
title: "Process-helper migration: Neovim tests (sessions, items, item prefixes, agent filters)"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - tests
assignee: null
parent: E-677
blocked_by: []
topic: topic-639
branch: t/T-902-process-helper-migration-neovim-tests
created: 2026-10-19T19:27:17.295Z
updated: 2026-10-19T20:04:31.085Z
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
  - verified: rev-31 [reviewer] · run rev-20261019-902-source-2 · 2026-10-19T20:04:31.085Z · commit 3506aba1ee105e070237729594c59ba19181dd0f
- [ ] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - failed: rev-31 [reviewer] · 2026-10-19T19:59:44.616Z · note Moved prefix T2 case exceeds 2s in its receipt; ten unchanged client identities would skip required five load repetitions.

## Comments

### impl-902 · 2026-10-19T19:38:57.913Z

Migrated screen/process boundaries in the working tree. Four injected T2 hub rule files retain tracker, hold, account and history assertions; native UI attach/death/stop is isolated in sessions-lifecycle.test.ts. Coordinator approved additive shared-stub support. Typecheck and tier lint are green; lint baseline shrink is limited to owned entries. Waiting for the census quiet window before recorder and timing evidence.

### impl-902 · 2026-10-19T19:47:09.794Z

Source fd8d767d7a63ab15f43399185b3e7c56e5055659 is committed and pushed to origin after merging current origin/dev. Source review is queued to the Reviewer role. All targeted rule/screen files and the retained T3 lifecycle case pass; npm run check, tier lint, T2 import-boundary guard and full recording-integrity check pass. Catalog adds 237 records without changing existing records. Assertion map A-6449; serial receipts A-6490. Awaiting source verdict before exact-head mode-free verification.

### rev-31 · 2026-10-19T19:59:44.616Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-902-source-1
commit: fd8d767d7a63ab15f43399185b3e7c56e5055659
scope: full
findings: [{"severity":"medium","text":"M1/C2: the submitted final-prefixes-rules receipt in A-6490 takes 2.038137542s for this moved T2 case, above the 2s case budget. Reduce repeated native CLI setup/execution cost while retaining migration, alias, topic/inbox/journal and reopen assertions; no allowance.","file":"hub/test/nvim-item-prefixes-rules.test.ts","line":7},{"severity":"medium","text":"M2/C2: ten migrated client cases retain known file/title identities from durations.json (both agents, first prefix, four items, three sessions). loadGateRepetitions therefore schedules zero repetitions despite the new T2 tier. Give the changed recorded-frame boundaries distinct truthful identities so every moved case can establish required 5/5; retain assertions and baseline data.","file":"nvim/test/items.test.ts","line":17}]
finding_counts: {"high":0,"medium":2,"low":0}

Standards M1: A-6490 prefix rule case is 2.038137542s >2s; reduce repeated CLI startup while preserving assertions. Spec M2: ten migrated client identities remain duration-known and would receive 0 repetitions; all moved cases require 5/5. Implementer confirmed both corrections. A-6525 preserves full assertion routing/catalogue review; four slices and +237 main records are additive/consistent, no other findings. Fresh head/source review required before verify.

Criteria: C2 failed (Moved prefix T2 case exceeds 2s in its receipt; ten unchanged client identities would skip required five load repetitions.).

### impl-902 · 2026-10-19T20:02:01.599Z

Replacement source 3506aba1 fixes both source findings (A-6525): public in-process CLI edit reduces the prefix case, and recorded-boundary titles give all 25 moved T2 identities fresh five-repetition keys. Coordinator-authorized origin/dev integration completed; catalog regenerated from dev through recorder. All targeted files, native lifecycle, fixture integrity/boundary and npm run check pass. Fresh source review requested; evidence A-6542. No verification submitted before clear.

### rev-31 · 2026-10-19T20:04:31.085Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-902-source-2
commit: 3506aba1ee105e070237729594c59ba19181dd0f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Both A-6525 findings resolved: public runTask alias edit preserves assertions with .405327458s local prefix body; all 25 moved T2 identities are independently absent from the unchanged duration baseline and qualify for 5/5. Coordinator 63e61d74 authorized integration of pinned dev 93dcac02; recorder catalogue is +237 records/+1112 nodes, zero changed/removed existing keys, all four slices match. Original assertion/native routing retained; local 25/25 and native lifecycle green, all budgets respected. A-6546/A-6542. C1 verified; C2 awaits wholly green unchanged-head mode-free receipt plus all 25 identities 5/5.

Criteria: C1 verified.
