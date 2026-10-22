---
id: T-1095
kind: task
title: The Items help dialog's last rows stay below the window after T-1074's keys
state: open
status: ready
size: XS
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by: []
regression_of: T-1074
topic: topic-838
branch: t/T-1095-the-items-help-dialog-s-last-rows-stay
created: 2026-10-22T06:41:51.812Z
updated: 2026-10-22T06:56:08.768Z
---

## Summary

E-416 stage "views and messages" QA run qa-s2-2026-10-22-1 (dev 918951c2, real Chrome, cland QA profile, existing window size) found that the Items help dialog's last two rows ("Show archived roots / A" and "Enter card or return to tree / Enter") stay below the visible window after PageDown, End and native scrolling; captures end at "Hide done items / D", and clicking the last row fails as offscreen. All 32 labels are in the accessibility tree. web/src/Palette.module.css gives `.dialog` a 12vh top margin and `.results` a bounded height, but the help list `.keys` has no bound, so T-1074's ten new rows push the dialog past the viewport.

## Acceptance criteria

- [x] C1. In a Headless Shell window of 1280×720 and of 1024×600, every row of the Items help dialog can be brought into view by keyboard scrolling (PageDown/End) and the last row is visible after End; the dialog itself stays inside the viewport (Web test).
  - done: impl-1095 · 2026-10-22T06:46:47.348Z
  - verified: rev-26 [reviewer] · run rev-20261022-1095-final-1 · 2026-10-22T06:56:08.661Z · commit 864d1f96f6126c780be1f1e7908bff463186b272
- [x] C2. Styling stays in CSS Modules with tokens only, and the typecheck colour and contrast guard passes (typecheck).
  - done: impl-1095 · 2026-10-22T06:46:47.489Z
  - verified: rev-26 [reviewer] · run rev-20261022-1095-final-1 · 2026-10-22T06:56:08.661Z · commit 864d1f96f6126c780be1f1e7908bff463186b272

## Comments

### impl-1095 · 2026-10-22T06:46:14.853Z

Test-first regression on dev 918951c2: native PageDown/End fails `last Items help row visible after End: not within 3000 ms` at both 1280×720 and 1024×600. Red log A-8972; traces A-8973/A-8974. Help-only CSS now sets border-box, max-height 76vh and overflow:auto. Local macOS arm64 targeted web/test/palette.test.ts: 11 pass, no skips; new top-level test 1.416 s, complete file wall 3.534 s. Root npm run typecheck passes, including colour/contrast/hooks guards. Targeted evidence only; no suite/budget-gate receipt yet. Per-item QA absent by after-stage policy; source review next, then mode-free verification at exact reviewed head.

### rev-26 · 2026-10-22T06:48:56.814Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1095-source-1
commit: 864d1f96f6126c780be1f1e7908bff463186b272
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear,full audit A-8978. Help-only data-keys-help selector uses border-box/max-height76vh/nativeoverflow with existing12vh top margin; palette unaffected. Module/tokens retained,no listener/dependency. New existing-Web-file regression checks both requested viewport sizes,all32 actual rendered rows,last exact row after nativeEnd,dialog bounds,Home and bounded observedPageDown with final seen32 assertion. Standards0;Spec0. A-8972 red/A-8975 localDarwinarm64 green11/11 and traces are supporting pre-verification evidence,not exact committed-head Linux proof; original typecheck/lint receipts/provenance requested without rerun. C1/C2 remain pending same-head configured Web/check gates; no final-ready/stageQA claim. Any changed head requires new source review.

### impl-1095 · 2026-10-22T06:53:25.605Z

Configured verification run 47bcfb0a-e754-4572-afe8-e0492e28a113 at unchanged reviewed/pushed head 864d1f96 passed: 791 pass, 0 fail/skip. A-8983 preserves host npm run check stdout (typecheck, colour/contrast, build, lint), all T1, selected T2 phase and Web. Runtime Linux x64 droplet c-8 lon1 cland-v0-3c1aa35c, Node24.21.0; lifetime170s/cost$0.0118; budgets/lint/ratchet report-only; no T3/T4 receipt. New regression parent 2.537756788s (1280×720 1.049460575s; 1024×600 1.117506465s), below ≥4s Linux allowance trigger. Host check reused remotely only after effective candidate-tree match aee32111ce622645311cb6927bc5a831b7768ec9. Reviewer has same-head receipt for final settlement. After-stage QA remains with Coordinator; no merge performed.

### rev-26 · 2026-10-22T06:56:08.661Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261022-1095-final-1
commit: 864d1f96f6126c780be1f1e7908bff463186b272
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8986 audits unchanged reviewed head and A-8983/run47bcfb0a exit0. Both actual viewport subcases pass (1280×720 1.049460575s; 1024×600 1.117506465s; parent2.537756788s), establishing C1 with source-reviewed all32/native-scroll/final-row/bounds assertions. Original host npm run check includes passing typecheck/colour/contrast/build/static checks, establishing C2; remote host gate aee32111 reused, not repeated. 791 passes, no fail/cancel/skip; actual T1/Web complete, web-only T2 phase has no T2 tests. Linux x64 c8lon1 droplet,170s/$0.0118; generic lint/budget/ratchet report-only. No broadT2/T3/T4/load-repetition/stageQA claim. Standards0;Spec0.

Criteria: C1 verified, C2 verified.
