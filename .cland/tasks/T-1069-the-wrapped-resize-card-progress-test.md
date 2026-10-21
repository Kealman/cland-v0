---
id: T-1069
kind: task
title: The wrapped-resize card progress test can stall 15 s before passing
state: open
status: review
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
updated: 2026-10-21T17:27:39.886Z
---

## Summary

T-1066's renamed test `nvim/test/progress-counts-component.test.ts` "release and epic cards preserve aggregate progress and open blocker counts across wrapped resizes" usually takes 0.55–0.74 s (stage covers 5551daab and 97d513e8, task run 75439bbf). In the periodic dev T3 fbdc2798 at dbb1604f it failed after 15.311 s with `Error: aggregate progress rendered for R-1 at width 72: not within 15000 ms` (A-8576, lines 8769–8775; stack at fixture.ts:59 and the test's line 100). The 72-column release card never showed the expected aggregate progress, and the timeout error dropped the observed state. The enforced 5 s new-identity duration gate also flagged the 15.3 s.

## Acceptance criteria

- [x] C1. The cause of the missed 72-column match is named in the item topic and fixed, in the product or the test, with a forced-late regression (test).
  - done: impl-1069 · 2026-10-21T17:25:23.897Z
- [x] C2. A timed-out observation fails with the observed state (the rendered card text and width) in its error message (test).
  - done: impl-1069 · 2026-10-21T17:25:23.911Z
- [ ] C3. The test passes 20 sequential repetitions under the load gate (workers 2) in a scratch clone at the task head, each under 2 s. A mode-free `cland verify` at the head is green.

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
