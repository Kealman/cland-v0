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
updated: 2026-10-19T20:23:47.598Z
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

- [x] C1. (T0 lint) In T-684's process-helper baseline, every file listed here has a count of zero, unless it is a truthful T3-header lifecycle file or case that holds only native-process assertions. The lint run shows it.
  - verified: rev-31 [reviewer] · run rev-20261019-902-source-2 · 2026-10-19T20:04:31.085Z · commit 3506aba1ee105e070237729594c59ba19181dd0f
  - done: impl-902 · 2026-10-19T20:14:18.717Z
  - verified: rev-31 [reviewer] · run rev-20261019-902-final · 2026-10-19T20:14:52.314Z · commit 3506aba1ee105e070237729594c59ba19181dd0f
  - verified: rev-31 [reviewer] · run rev-20261019-902-integration-source · 2026-10-19T20:19:53.849Z · commit 743e1f94e2284a4e29adf03d06b71e9a67b1f773
  - verified: rev-31 [reviewer] · run rev-20261019-902-integration-source-2 · 2026-10-19T20:23:47.598Z · commit 9019bb4d4a86ebdf88d0636e039d0f966109b446
- [x] C2. (T1/T2) Every assertion in the listed files is kept, whether moved or retained. Each moved case passes in a mode-free task verify, including its five load repetitions, and no new duration allowance is added. Retained T3 lifecycle cases pass locally before enqueue; their Linux run is landing evidence.
  - done: impl-902 · 2026-10-19T20:14:20.597Z
  - verified: rev-31 [reviewer] · run rev-20261019-902-final · 2026-10-19T20:14:52.314Z · commit 3506aba1ee105e070237729594c59ba19181dd0f

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

### impl-902 · 2026-10-19T20:14:31.081Z

Unchanged-head mode-free verification e4cd32c3 passed: 1675/1675 with no failures/cancellations/skips. Audit A-6593 proves all 25 moved T2 identities have 1 ordinary pass and 5 distinct load repetitions (125 total), maximum 1.138463385s. C1/C2 claimant done marks recorded. Reviewer has the final evidence audit; native T3 was locally green, with Linux T3 deferred to periodic/integrated occasions by the configured tier plan.

### rev-31 · 2026-10-19T20:14:52.314Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-902-final
commit: 3506aba1ee105e070237729594c59ba19181dd0f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Same-head configured mode-free e4cd32c3/A-6587 green:1675/1675 ordinary,445/445 load finishes,89 groups5/5, zero tier mismatch/non-pass. All25 moved identities pass ordinary+5/5 (125 owned repetitions), max owned1.138463385s; prefix .807308209s ordinary closes M1 and all13 renamed clients actually repeat, closing M2. C1 source A-6546 retained; C2 assertion/catalogue/native local evidence A-6542/A-6449 unchanged. A-6595 retains full audit; known report-only notices need no aside. C1/C2 final verified; T3 Linux remains periodic/integrated/landing evidence.

Criteria: C1 verified, C2 verified.

### rev-31 · 2026-10-19T20:19:53.849Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-902-integration-source
commit: 743e1f94e2284a4e29adf03d06b71e9a67b1f773
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6606: Standards and Spec clear for the authorized tier integration. All 23 non-manifest owned blobs match prior final-clear 3506aba1; tiers retain both owned entries and dev's new frame-consumer entry, with no removed dev entries or allowance change. A-6599 local receipts remain within budgets. C1 reverified; C2 needs fresh evidence at the next published head. Coordinator update 2bdffcb8 now sequences T-903 first, then another integration/recording refresh: keep verification held at this intermediate head and request fresh source review afterward. Prior green A-6587 is not reused for the changed head.

Criteria: C1 verified.

### rev-31 · 2026-10-19T20:23:47.598Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-902-integration-source-2
commit: 9019bb4d4a86ebdf88d0636e039d0f966109b446
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6617: post-T-903 integration authorized by primary Coordinator 2bdffcb8 is clear on Standards and Spec. Both parent stub handler blocks retained; all 21 other non-map/non-main-catalogue owned blobs unchanged. Manifest/baseline preserve every dev entry and only apply owned migration reductions. Catalogue independently +237 records/+1112 nodes versus pinned dev 70f695cc, zero existing keys changed/removed; all four owned slices match. A-6612 recorder/replay/integrity/boundary/discovery controls pass. Native source/dependencies remain unchanged from prior local green A-6599. C1 reverified; C2 requires fresh same-head configured mode-free green receipt and all 25 moved identities ordinary plus actual 5/5, with zero owned tier/budget issues. All 25 keys remain absent from unchanged dev duration baseline; no allowance edit.

Criteria: C1 verified.
