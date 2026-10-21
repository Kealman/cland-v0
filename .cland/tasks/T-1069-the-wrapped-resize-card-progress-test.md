---
id: T-1069
kind: task
title: The wrapped-resize card progress test can stall 15 s before passing
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-1066
topic: topic-814
branch: t/T-1069-the-wrapped-resize-card-progress-test
created: 2026-10-21T17:17:45.962Z
updated: 2026-10-21T17:43:11.431Z
closed: 2026-10-21T17:43:11.431Z
---

## Summary

T-1066's renamed test `nvim/test/progress-counts-component.test.ts` "release and epic cards preserve aggregate progress and open blocker counts across wrapped resizes" usually takes 0.55–0.74 s (stage covers 5551daab and 97d513e8, task run 75439bbf). In the periodic dev T3 fbdc2798 at dbb1604f it failed after 15.311 s with `Error: aggregate progress rendered for R-1 at width 72: not within 15000 ms` (A-8576, lines 8769–8775; stack at fixture.ts:59 and the test's line 100). The 72-column release card never showed the expected aggregate progress, and the timeout error dropped the observed state. The enforced 5 s new-identity duration gate also flagged the 15.3 s.

## Acceptance criteria

- [x] C1. The cause of the missed 72-column match is named in the item topic and fixed, in the product or the test, with a forced-late regression (test).
  - done: impl-1069 · 2026-10-21T17:25:23.897Z
  - verified: rev-23 [reviewer] · run rev-20261021-1069-final · 2026-10-21T17:38:20.714Z · commit cc3e9ab0af978f4f6ac17ddadaaee062184858ad
- [x] C2. A timed-out observation fails with the observed state (the rendered card text and width) in its error message (test).
  - done: impl-1069 · 2026-10-21T17:25:23.911Z
  - verified: rev-23 [reviewer] · run rev-20261021-1069-final · 2026-10-21T17:38:20.714Z · commit cc3e9ab0af978f4f6ac17ddadaaee062184858ad
- [x] C3. The test passes 20 sequential repetitions under the load gate (workers 2) in a scratch clone at the task head, each under 2 s. A mode-free `cland verify` at the head is green.
  - done: impl-1069 · 2026-10-21T17:37:23.846Z
  - verified: rev-23 [reviewer] · run rev-20261021-1069-final · 2026-10-21T17:38:20.714Z · commit cc3e9ab0af978f4f6ac17ddadaaee062184858ad

## Comments

### impl-1069 · 2026-10-21T17:25:23.887Z

C1: A-8576:8769–8775 actually reports `Error: aggregate progress rendered for R-1 at width 72: not within 15000 ms`, finish8252 outcome fail15.310656838s. Historical state is unavailable; deterministic scratch reconstruction records setup's manual left90 before160→260 resize. Explorer.sync then uses50-column responsive right slot because beside118−72<80; width72 is impossible despite correct selected/drawn R-1 and aggregate text. Steady removes left panel; deliberate72/42 assertions remain. C2: one-second scoped-tree/card observations retain counts, selected/drawn identity, physical width and buffer text; helper checks elapsed deadline after async observation, waitScreen checks after predicate. Fake Date forces ready at100/101ms vs100 bound (red missing rejection before fix, green rejection afterward). Source cc3e9ab0; local scratch10/10 targeted+check0, not C3/suite evidence.

### rev-23 · 2026-10-21T17:27:39.886Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1069-source
commit: cc3e9ab0af978f4f6ac17ddadaaee062184858ad
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8580, Standards0/Spec0. Exact origin cc3e9ab0/tree166efb83 against fixed dbb1604fd8ab9f21a4f1a5858117d99e9e4932ac; six-file diff/check clean. Geometry cause is deterministic reconstruction, not historical state proof: forced flush preserves left90, responsive right-slot forces50 despite requested72; Steady removes that precondition. Exact72/42 widths, counts, selected/drawn identity, actual buffer PROGRESS text, wrapping and final value/closed-child assertions retained. Scoped explorer readiness excludes matching Items-panel text. One-second observations retain JSON width/text/state on failure; eventually and waitScreen reject ready results at/past deadline. Four pure fake-Date T1 tests cover100/101ms late, diagnostics and99ms timely; correct tier registration, unchanged stub-client T2 boundary/cleanup, README updated. A-8578 original local Darwin working-overlay red/green10/10/check0 is development support, no committed-head/C3 pass; lint132/59 report-only. C1/C2 run-dependent and unverified until same-head evidence. C3 awaits20 sequential workers2 scratch target passes each<2s and green mode-free. Source clear permits unchanged-head verification; no full-run request or Reviewer runtime. QA none; Coordinator alone lands.

### impl-1069 · 2026-10-21T17:37:23.861Z

C3 complete at unchanged source-reviewed/pushed cc3e9ab0/tree166efb83. A-8581/A-8582 contain20 sequential fresh-process workers2 load-gate passes at exact clean scratch-clone head, local Darwin arm64/Node24.21.0/Neovim0.12.5; min0.5378585s/max0.939845042s, start1m loads1.4355–2.3159<15, original manifests report-only; receipt parser checks nonoverlap and each<2s. Mode-free1ee63d7c auto exit0 (A-8584) at identical head: fallback all T1 and all T2 across hub+Neovim plus Web; reported2328 pass/zero failures/skips/cancellations. Linux x64 c-8 lon1 droplet, Node24.21.0/Neovim0.12.5, workers2 (Web4), lifetime484s/cost$0.0336; ordinary target0.717042171s at A-8584:12183. Four new T1 helper identities each load-gated5/5; existing target identity not newly gated remotely, covered by local20. Host typecheck gate773e1371 reused, not repeated on droplet. Existing lint/duration/resource/ratchet warnings report-only retained; no enforcing budget, T3/T4/integrated/QA claim. All C1–C3 done; final Reviewer evidence settlement requested; Coordinator owns landing after freeze.

### rev-23 · 2026-10-21T17:38:20.714Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-1069-final
commit: cc3e9ab0af978f4f6ac17ddadaaee062184858ad
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-8585, Standards0/Spec0; C1–C3 verified at unchanged origin cc3e9ab0/tree166efb83. Source A-8580 retains exact72/42/counts/selection/drawn/buffer/wrapped progress assertions; geometry cause is reconstructed, not a historical trace. A-8578 forced geometry red records actual50-column card and full text; exact-head Linux forced-clock100/101ms late-result and failed-state diagnostic tests pass, each new helper5/5. A-8581/A-8582 audited raw20 distinct starts/finishes, matched IDs/no overlap, local Darwinarm64 scratch exact clean head, workers2/four5-repeat runner rounds, starts1m1.4355–2.3159<15; every target0.5378585–0.939845042s<2. Four ordinary full-file runs24pass. A-8584 mode-free1ee63d7c exit0:Linuxx64c8lon1 T1/allfallbackT2hub+nvim/Web5files;2328ordinarytest/356filepasses+20helperloadtest/filepasses, nofail/skip/cancel. Existing target ordinary12183=0.717042171s, no remote target5/5 claimed. Host773e1371 reusednotremote,T2workers2/Web4,life484s/$0.0336estimated. Lint132/59,5missingbaselines,duration/resource/ratchet report-only; Web overages retained, no enforcing-tier-budget/T3/T4/integrated/QA claim. QA none; Coordinator owns landing after freeze. No Reviewer runtime.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-10-21T17:43:11.431Z

Merged d53ec832b9a162d49a87f0851b5c2e88d9067de1 onto dev.
