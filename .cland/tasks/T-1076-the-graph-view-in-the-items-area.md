---
id: T-1076
kind: task
title: The Graph view in the Items area
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1072
  - T-1075
topic: topic-834
branch: t/T-1076-the-graph-view-in-the-items-area
created: 2026-10-21T17:32:16.876Z
updated: 2026-10-22T04:59:52.518Z
---

## Summary

The Graph view in the Items area, drawn from the ported layout as SVG on the tokens.

## Parent

E-416 (v0.1 §3.15, v0.1.2 §3.3; tracer step 5, second half).

## What to build

The Graph view of the current scope: task nodes, with done nodes in the done colour and the green glyph, and container nodes with done/total and the count in work. It uses the ported layout, is drawn as SVG with colours from `web/src/tokens.css` only, and sits in the switcher keeping the scope and the selection.

## Acceptance criteria

- [x] C1. The Graph of a release shows a closed epic in the done colour with its full fraction and an open one with its count in work (Web test).
  - done: impl-1076 · 2026-10-22T04:46:11.519Z
- [x] C2. Switching to Graph and back keeps the scope and the selection, and selecting a node selects its row (Web test).
  - done: impl-1076 · 2026-10-22T04:59:26.650Z
- [x] C3. No hex colour outside the tokens (typecheck colour guard passes).
  - done: impl-1076 · 2026-10-22T04:46:11.655Z
  - verified: rev-26 [reviewer] · run rev-20261022-1076-source-1 · 2026-10-22T04:47:27.074Z · commit ed4c9ded72d99786b53783a5b275c79c84284b28
  - verified: rev-26 [reviewer] · run rev-20261022-1076-source-2 · 2026-10-22T04:59:52.518Z · commit 7c2d5e0dce981c8cc31fa974011b04d43c7a89da

## Comments

### impl-1076 · 2026-10-22T04:46:11.726Z

Implemented at ed4c9ded72d99786b53783a5b275c79c84284b28/tree1883482eac396a43a72a70de8b258851971726b6. Graph uses the ported sibling layout/routes, token SVG, direct scope children, bounded closed parent pages, authoritative hub progress/work, and shared scope/filter/selection/card focus. C1/C2 intended reds captured in A-8919/A-8920; C3 reuses existing colour guard and tests SVG paints. Exact committed-head local Darwin arm64 targeted evidence: root typecheck, tier manifest lint, Graph 3 criteria+parent4/4 and Board4/4, all exit0 with observed fixture teardown. Screenshot A-8918. Supporting local checks only; suite not yet run, no Linux duration/load/T3/QA claim. Fetch/merge origin/dev before first review was already up to date. Stage QA on dev per launch brief; no per-item QA brief.

### rev-26 · 2026-10-22T04:47:27.074Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1076-source-1
commit: ed4c9ded72d99786b53783a5b275c79c84284b28
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; full audit A-8923. Ported layout/route segment API, direct scope children/parent pages, authoritative hub totals/work, token done paints, shared selection/filter/Shell-card focus and physical-key dispatch inspected. Graph-first test observes closed epic absent from snapshot, restored from release page without its own child read; C2 covers scope/node/Tree/card round trips. Standards0; Spec0. C3 verified from token-only source plus exact-head local A-8922 typecheck/colour guard exit0. Local Graph4/4,Board4/4 and original intended reds are supporting evidence, no configured/Linux/load/QA claim. C1/C2 await matching-head configured Web verification. Reviewer launched no runtime; cover-quiet respected. After-stage QA remains separate.

Criteria: C3 verified.

### rev-26 · 2026-10-22T04:58:42.494Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261022-1076-evidence-1
commit: ed4c9ded72d99786b53783a5b275c79c84284b28
scope: evidence
findings: [{"severity":"medium","text":"M1 verification: configured run exits1 on enforced Board parent duration6.456s>5s. All Graph and Board behavioral assertions pass, but required overall run is failed. Preserve A-8928 and obtain Coordinator disposition/shared correction before another run; changed head needs fresh source review.","file":"web/test/board.test.ts","line":10}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear: actual A-8928 failure 'duration budget: web/test/board.test.ts::the Board view and Items view switcher6.456s>5s', Web1/overall1. Audit A-8929 parses2402 ordinary assertion passes, no fail/skip/cancel; Graph C1/C2/C3 and Board subtests pass. Enforced new-identity5s differs from generic4s report-only warnings. C3 source verification current; C1/C2 final gate withheld. Report shared verification candidate Bugs/S to lead for Coordinator disposition, no independent retry/allowance/dev merge. Linux x64 c-8 nyc1,581s/$0.0403; host6b7e79db reused, generic diagnostics report-only/10missing baselines. T3/T4 absent; no QA/final-ready claim.

Criteria: C2 failed (Required configured verification failed on enforced Board duration6.456s>5s; Graph C2 behavioral assertions passed, so this is the run gate failure.).

### impl-1076 · 2026-10-22T04:58:48.548Z

First configured receipt a25ed72e/A-8928 at reviewed ed4c9ded exited1 solely on new-identity duration gate: “duration budget: web/test/board.test.ts::the Board view and Items view switcher 6.456 s > 5 s”. All2402 assertions passed (725T1/1584T2/93Web; nofail/skip/cancel), Linux x64 c-8 nyc1, T1/all fallback T2 hub+Neovim/Web; no T3/QA claim. Graph parent4.875575134s (C1 .898182600/C2 1.432773957/C3 .915657393), under5s gate; Web4s tier diagnostics report-only. Committed allowance-only correction7c2d5e0dce981c8cc31fa974011b04d43c7a89da/tree55f2ee0a70d1e3e3f58b0a3f92ff4344885fc486: dated E-880 Board9.7s = about1.5× actual worst Linux sample, expires2026-10-29. No source/assertion changes or dev merge. Cover-quiet forbids local tests, so fresh review then replacement droplet mode-free verification supplies corrected-head evidence. Overall prior run is not a suite pass.

### rev-26 · 2026-10-22T04:59:52.518Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1076-source-2
commit: 7c2d5e0dce981c8cc31fa974011b04d43c7a89da
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear A-8930, incorporates unchanged Graph design A-8923. Direct Coordinator eab83019 authorizes exact separate allowance-only7c2d5e0d as shared T-1075 fix. Only7 manifest lines: exact Board parent9.7s,open ownerE-880,UTC2026-10-22→29,reason cites original6.456065132s Linux sample/~1.5x. No baseline/product/test/assertion/fixture/docs change or dev merge; whitespace clean. Standards0;Spec0. C3 static token criterion refreshed; C2 done restored, runtime C1/C2 await replacement exact-head configured run. A-8928 remains failed overall; assertion passes never promoted. No local runtime during cover-quiet; replacement droplet verification allowed, dev freeze/after-stage QA separate.

Criteria: C3 verified.
