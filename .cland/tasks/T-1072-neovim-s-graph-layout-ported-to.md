---
id: T-1072
kind: task
title: Neovim's graph layout ported to TypeScript under a differential test
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
topic: topic-815
branch: t/T-1072-neovim-s-graph-layout-ported-to
created: 2026-10-21T17:32:16.423Z
updated: 2026-10-21T18:39:04.510Z
---

## Summary

Port Neovim's layered graph layout (`nvim/lua/cland/graph_layout.lua`) to TypeScript under a differential test against the Lua. This is the largest piece of E-416, split out ahead of the Graph view.

## Parent

E-416 (Graph view choices; tracer step 5, first half).

## What to build

A pure TypeScript layout module in `web/` with no layout library. It produces the same layers, order and edge routes as the Lua for the same input. A differential test drives the Lua through headless Neovim on the QA graph fixture (`qa/cases/GRAPH-001.items.json`) and on a copy of the live tracker, and compares the outputs.

## Acceptance criteria

- [x] C1. The differential test reports zero differences between the TypeScript and Lua layouts on `qa/cases/GRAPH-001.items.json` (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1072-final · 2026-10-21T18:37:29.807Z · commit 2650632c699e894c5df4e12c5851ea095d51d758
  - done: impl-1072 · 2026-10-21T18:39:04.474Z
- [x] C2. The same test reports zero differences on every epic and release of a copy of the live tracker (test).
  - verified: rev-23 [reviewer] · run rev-20261021-1072-final · 2026-10-21T18:37:29.807Z · commit 2650632c699e894c5df4e12c5851ea095d51d758
  - done: impl-1072 · 2026-10-21T18:39:04.510Z
- [x] C3. The module has no new dependency and no DOM access (lint or test).
  - done: impl-1072 · 2026-10-21T18:13:17.225Z
  - verified: rev-23 [reviewer] · run rev-20261021-1072-source · 2026-10-21T18:16:14.807Z · commit d2c0f908d4c74eb46b9bdc7d8dc21c3300726564
  - verified: rev-23 [reviewer] · run rev-20261021-1072-source-3 · 2026-10-21T18:27:57.389Z · commit 2650632c699e894c5df4e12c5851ea095d51d758
  - verified: rev-23 [reviewer] · run rev-20261021-1072-final · 2026-10-21T18:37:29.807Z · commit 2650632c699e894c5df4e12c5851ea095d51d758
  - verified: rev-23 [reviewer] · run rev-20261021-1072-merge-source · 2026-10-21T18:38:56.926Z · commit 8815a4b9857f969afa3e88bc907d43354b9f7cf0

## Comments

### impl-1072 · 2026-10-21T18:10:24.778Z

Test-first seam: headless production Lua versus pure TypeScript geometry. Initial intended red was `Error: graph layout port pending` after fixing binary resolution; GRAPH-001 now passes exact layers/order, diagnostics, positions and h/v/port segments in both orientations (targeted macOS run, working tree, ~31 ms test time). Next: scratch live-tracker differential and adversarial topology/rank cases. No suite receipt claimed.

### rev-23 · 2026-10-21T18:16:14.807Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1072-source
commit: d2c0f908d4c74eb46b9bdc7d8dc21c3300726564
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8604, Standards0/Spec0. Exact origin d2c0f908/tree0e809c2e, fixed basee616887357be105d30684dec508b0291994b1ca4,8files/diffcheck clean. Compared Lua cycle/reduction/rank/dummy ordering, barycentre/transpose, weighted/extra-gap/legal rows, track DP/fallback, horizontal/vertical routing/ports and bounded fit-window recuts; no mismatch found. Null-prototype dictionaries/literal tests, independent unchanged production Lua oracle and exact ordered geometry comparisons retained; every epic/release enumerated after scratch copy, including empty/closed. T1 literal/T3 real binary declarations appropriate; sealed fixtureEnvironment and synchronous child completion precede root deletion. C3 verified: zero imports/DOM/new dependency; ECMAScript-only lib/types[] strict compile gate integrated into web typecheck, README accurate. C1/C2 run-dependent unverified: A-8603 is summary only; preserve original targeted stdout, command/exit and actual execution head/tree/platform durably, no transcription rerun, alongside forthcoming same-head mode-free receipt. Source clear permits unchanged-head verify. No queued/Linux/T3/Web/final pass claimed; afterstage affected QA separate/no per-item brief. No Reviewer runtime.

Criteria: C3 verified.

### impl-1072 · 2026-10-21T18:24:47.781Z

Unchanged head d2c0f908: mode-free verification a22fe2ed-1e00-4d28-829b-f3d095ceb495 completed exit 0 on Linux x64 droplet c-8 lon1; T1, all fallback T2 across both packages, and Web; 2331/2331 pass with zero skipped/cancelled. A-8610 durable log. Duration/test-lint gates in report mode (reported unrelated overages remain diagnostics); host typecheck gate reports provenance 23f2c079, not a repeated target-head check. Separate target-head local macOS typecheck/build/static and targeted T1/T3 differential stdout are recorded in A-8603/A-8605. T3 absent from this task run and configured batch tiers, deferred to periodic/integrated occasions; stage QA separate. Droplet lifetime 438s, cost $0.0304. Waiting for Reviewer final C1/C2 criterion settlement; no merge requested.

### rev-23 · 2026-10-21T18:26:36.921Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261021-1072-source-2
commit: d2c0f908d4c74eb46b9bdc7d8dc21c3300726564
scope: full
findings: [{"severity":"medium","text":"The documented direct oracle creates its scratch root and spawnSyncs Neovim without awaiting shared test-support/admission.ts. findNvim is only a path resolver; neither guarded fixture entry point is used. docs/agents/tests.md:1149 requires targeted node --test runs to obey cover-quiet admission. Await the shared guard before allocation/launch, preserving geometry assertions and inputs, then request fresh source review.","file":"nvim/test/web-graph-layout.test.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear; A-8611, Standards1medium/Spec0. My earlier source pass missed the native oracle's cover-quiet admission gap (M1 at test22/launch29). This is a missing control path, not evidence of an actual quiet-period overlap. Fix with the shared neutral admission guard before scratch allocation/Neovim launch, no equality/corpus weakening; fresh source review before replacement verify. A-8605 original exact-head Darwin targeted7/7 supports functional GRAPH-001/all67containers/1080copied/adversarial/wrapping parity; no geometry failure found. A-8610 queued mode-free remains green:2331ordinarytest/357filepasses+15literal-loadtest/filepasses, all3newT1identities5/5, actual Linuxx64c8lon1 T1/allT2hub+nvim/Web5files; no remoteT3oracle. Host23f2c079 reusednotremote, lint132/59,duration/ratchet report-only,2missingbaselines/Weboverages retained. No fabricated runtime or failed-criterion assertion: C3 prior source proof stands; C1/C2 final marks pending corrected source/evidence. Afterstage affected QA separate. No Reviewer runtime.

### rev-23 · 2026-10-21T18:27:57.389Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1072-source-3
commit: 2650632c699e894c5df4e12c5851ea095d51d758
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-8613, Standards0/Spec0. Exact origin2650632c/treebcc71262, one-file correction since d2c0f908/no dev merge. M1 fixed by async compare awaiting neutral assertTestAdmission before allocation/input copies/native launch; all4test callbacks return its Promise. Rejections/failures remain test-owned; no bypass/guard/assertion weakening. Production geometry, oracle corpus/comparisons, cleanup and no-DOM compile gate unchanged; original full/parity audit A-8604 retained, C3 reverified. A-8612 original corrected committed-head Darwin targeted T3 4/4exit0 includes GRAPH-001/all67epic-release graphs from1080copied items/adversarial/wrapping, separately labelled support. C1/C2 final marks await replacement same-head mode-free plus this targeted receipt; A-8610 stays historical green at oldhead. Source clear permits unchanged-head verification. Affected afterstageQA separate; no Reviewer runtime.

Criteria: C3 verified.

### impl-1072 · 2026-10-21T18:36:19.819Z

Corrected source 2650632c699e894c5df4e12c5851ea095d51d758 has replacement mode-free receipt 522c30cf-adac-4fb7-b172-b8a7b7f07cd0/A-8616: exit 0, 2331/2331 tests, zero fail/skip/cancel, Linux x64 droplet c-8 lon1, T1/all fallback T2 hub+Neovim/Web. Test-lint and duration budgets remain report mode with diagnostics; no budget-enforce pass claimed. Host typecheck gate provenance 857aef1a reused/not repeated remotely. Targeted corrected-head macOS T3 differential receipt A-8612 remains separate (4/4, GRAPH-001 + all 67 epic/release graphs from 1080 copied items). T3 deferred to periodic/integrated occasions, not this task receipt; after-stage QA separate. Droplet lifetime 451s, estimated cost $0.0313. Head unchanged; awaiting final Reviewer settlement. No merge performed.

### rev-23 · 2026-10-21T18:37:29.807Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1072-final
commit: 2650632c699e894c5df4e12c5851ea095d51d758
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8617, Standards0/Spec0, C1–C3 verified at unchanged origin2650632c/treebcc71262. A-8612 corrected committed-head local Darwin targeted T3 4/4exit0: independent unchanged Lua exact equality on GRAPH-001/all67epic-release sibling graphs from1080copied items/adversarial/wrapping, both orientations. C3 no-DOM/dependency/strict compile seam and resolved shared-admission guard retained fromA-8613. A-8616/522c30cf samehead mode-free exit0:2331ordinarytest/357filepasses+15loadtest/filepasses, three newT1identities5distinctpasses+explicit5/5. Actual Linuxx64c8lon1 T1/allfallbackT2hub+nvim/Web5files; T3oracle not run remotely, targeted local proof separately labelled. Host857aef1a reusednotremote,T2workers2/Web4,life451s/$0.0313estimated. Lint132/59,2missingbaselines,duration/resource/ratchet report-only, Web4s-budget overages retained. NoT4/integrated/stage/afterstageQA claim; affected afterstageQA separate/no per-item brief. HistoricalA-8610 not substituted; no Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified.

### rev-23 · 2026-10-21T18:38:56.926Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1072-merge-source
commit: 8815a4b9857f969afa3e88bc907d43354b9f7cf0
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear; A-8619, Standards0/Spec0. Exact origin8815a4b9/tree4dbe7ba1, parents accepted2650632c/incoming6e1a68e5; Coordinator5249110e independently confirmed authorizes merge. Entire delta two docs6add/5delete: incoming AGENTS keymap pointer and verbatim T-1080 Browser tests paragraph, then unchanged Graph geometry guidance; combined diff/check clean. Every production/oracle/test/config/admission/dependency blob unchanged. C3 source reverified; previous source/final A-8613/A-8617 and local targeted oracleA-8612 cover unchanged dependencies, no documentation-only T3 rerun requested. A-8616 remains prior-head receipt; no merged-head runtime claimed. Refresh stale C1/C2 claimant marks and submit unchanged-head mode-free as Coordinator requested; final evidence awaits result. Afterstage affected QA separate; no Reviewer runtime.

Criteria: C3 verified.
