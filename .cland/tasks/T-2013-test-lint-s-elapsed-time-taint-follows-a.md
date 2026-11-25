---
id: T-2013
kind: task
title: Test lint's elapsed-time taint follows a bounded setup wrapper into unrelated result fields, refusing non-timing assertions
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2073
blocked_by: []
topic: topic-1770
branch: t/T-2013-test-lint-s-elapsed-time-taint-follows-a
created: 2026-11-19T19:55:40.939Z
updated: 2026-11-25T08:20:27.988Z
closed: 2026-11-25T08:20:27.988Z
---

## Summary

The test lint's elapsed-time taint follows a generic bounded setup wrapper into every field its result returns. In T-1695, a helper returning `within(..., setupDeadline - performance.now())` caused four wall-clock-assertion refusals for `launch.ok`, `sent.ok`, `held.job` and `rows.every(status === 'running')` in host-survival-native, none of which compares elapsed time (impl-1695, full lint 2, 2026-11-19). T-1695 keeps four reasoned lint comments in the meantime.

## What to build

Narrow the taint so a deadline that only bounds acquisition doesn't taint unrelated result data, while true elapsed-time assertions are still detected.

## Acceptance criteria

- [x] C1. A regression shows a value returned through a deadline-bounded setup wrapper isn't flagged, and an assertion comparing measured elapsed time still is (test).
  - done: impl-2013 · 2026-11-25T02:58:33.675Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2013-final · 2026-11-25T07:45:25.998Z · commit 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34
- [x] C2. T-1695's four reasoned comments in host-survival-native can be removed with lint still passing (test).
  - done: impl-2013 · 2026-11-25T02:44:37.476Z
  - verified: rev-41 [reviewer] · run rev-41-20261125-2013-final · 2026-11-25T07:45:25.998Z · commit 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34

## Comments

### impl-2013 · 2026-11-25T02:38:10.910Z

Consumer search (rule 20): lintTestSource/testLintFacts and wall-clock-assertion references cover test-lint-policy, merge-test-lint, suite selection/shards/candidate/suites, territory, daemon, worker/runner, lint-tests, harness/component fixture; tests: test-lint, test-lint-policy, test-lint-worker/warmer, suite-tiers, suite-protocol, suite-admission-cost/native, suite-dry-run. Docs/skills/QA and frozen JSON searched. No finding wire shape, policy mode, cache contract or tier changes: only function-value taint propagation narrows. Existing policy/worker/CLI consumers need no migration. T-1928 diff read; cache changes deliberately not taken. Red T1 on base 073a7a2f4 plus new regression: 42 pass, 1 fail with four wall-clock-assertion findings. Green after fix: 43/43 macOS local Node 24.21.0; native host-survival not executed.

### rev-41 · 2026-11-25T02:45:57.845Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2013-source1
commit: 38f6899f009220c5271e78477743834ee8c57020
scope: full
findings: [{"severity":"medium","text":"Skipping all function subtrees during initializer taint drops immediately invoked elapsed-producing calls: `const elapsed = (() => performance.now() - started)(); assert.ok(elapsed < 1000)` loses its prior wall-clock-assertion finding.","file":"hub/src/test-lint.ts","line":193}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. M1 medium at test-lint.ts:193/204: blanket function-subtree skipping in variable initializer analysis drops a real elapsed IIFE result. With `const started = performance.now(); const elapsed = (() => performance.now() - started)(); assert.ok(elapsed < 1000);`, elapsed is no longer marked and no inner assertion exists to detect independently. Prior traversal marked it. Preserve invoked elapsed results while excluding function identities, and add public-seam positive controls alongside the four wrapper-result negatives. This is source reasoning; no Reviewer test was run. Standards no separate findings; C1 failed, C2 remains unverified. Authored A-23195 local T1/static evidence does not cover this regression or configured/native execution. Full review A-23197: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23197-t-2013-source-not-clear-elapsed-producing-call-loses-taint.md. Corrected head needs fresh source review before verification.

Criteria: C1 failed (Function-subtree skipping also suppresses a real elapsed-producing IIFE result and its assertion alias; new positives cover direct subtraction/inner assertions only.).

### rev-41 · 2026-11-25T02:52:03.355Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2013-source2
commit: 7c535a636df15be94e501f90d189b813aebe9430
scope: full
findings: [{"severity":"medium","text":"Immediate-only call traversal still drops a named local elapsed producer: `const measure=()=>performance.now()-started; const elapsed=measure(); assert.ok(elapsed<1000)` loses the prior finding because the function identity is skipped and its Identifier callee is not followed.","file":"hub/src/test-lint.ts","line":200}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear. Prior IIFE instance resolved; M1 remains for named bound elapsed producers. `const started=performance.now(); const measure=()=>performance.now()-started; const elapsed=measure(); assert.ok(elapsed<1000);` was caught before the item, but measure is now skipped and Identifier call targets are excluded by the literal-only condition at200, leaving elapsed unmarked. Add public-seam bound producer/result-alias positives while retaining all wrapper negatives, IIFEs and inner assertion controls. Source reasoning only; no Reviewer execution. C1 failed, C2 unverified. A-23204 authored correction evidence covers the IIFE but not this call form. Standards/Spec A-23207: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23207-t-2013-source-correction-still-misses-named-elapsed-calls.md. Fresh corrected committed source review before verification.

Criteria: C1 failed (IIFE instance fixed, but a named local elapsed-producing function call and its result alias still lose a previously supported true elapsed assertion finding.).

### rev-41 · 2026-11-25T02:58:25.652Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2013-source3
commit: 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source round3 clear; no findings. Applied stated bar: both reported immediate/named elapsed-call regressions and aliases are resolved; four T-1695 setup negatives, direct/inner positives retained. Returned-value/lexical-alias traversal separates incidental deadlines and guards recursion. Coordinator b378a5cc/a23988f9 authorized keeping disk exemptions for old-hub admission; new C2 test reads actual source, counts exactly four targeted comments, strips them in memory and requires clean lint. Host-survival file is byte-identical to base; physical removal remains a follow-up after restart. Standards/Spec A-23210: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23210-t-2013-source-round-3-clear-at-71ff8ded2.md. Authored A-23209 local macOS T1/static results are not configured proof; C1/C2 remain unverified pending exact-head configured regression/lint receipts. Task still has prior C1 failed/unchecked; lead should restore done. Earlier failed controls retained. No Reviewer execution.

### impl-2013 · 2026-11-25T04:45:20.905Z

Verification run 7cfc747a-515f-4b8a-a704-636acc28724f at source-clear head 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34 is incomplete, exit 143 (A-23258). Structured result.json cause: run timeout 75m; secondary diagnostic: package closure incomplete; machine deletion required. Completed 9308 tests: 9296 pass, 0 fail, 12 skipped, not a full pass. Linux x64 droplet, Node 24.21.0, workers 2, lifetime 4623s, cost $0.3211. Coordinator ordered hold pending human run-limit decision ask b8a314e1 / T-2100; no resubmission. No source changes or dev merge after review.

### rev-41 · 2026-11-25T04:46:24.099Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261125-2013-evidence1
commit: 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence incomplete, not clear; no code findings or criterion failures asserted. Retained result.json owner records deadlineExpired:true/code143/cause `run timeout 75m; secondary diagnostic: package closure incomplete; machine deletion required`, closure incomplete/nativeExit143. Exact head/tree6794f076 checked. Structured complete tier receipts T0/T1/T2 only; printed hub T3 command exit0 is partial package evidence, nvim/ui identity remains in flight, Web has no completion, T4 unexecuted. Both exact new lint identities have paired base+5/5 load passes and target file cleanup passes, retained as partial positives; C1/C2 remain done/unverified, not admitted as complete passing-round proof. Coordinator e89adee9 no-resubmission hold pending human run-limit decision/T-2100 remains in force. Linux x64 c-8fra1 Node24.21/Neovim0.12.5, two workers;browser null,12 prerequisite skips/cache unknown, unavailable machine metrics not zero. A-23259: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23259-t-2013-evidence-incomplete-after-75-minute-run-timeout.md. Preserve source-clear A-23210 and all timeout/secondary/partial receipts; no Reviewer execution, source change or retry requested.

### rev-41 · 2026-11-25T07:45:25.998Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2013-final
commit: 71ff8ded24f1e5d40cfd5e1a7891bc21475e1a34
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear. Human/Coordinator-authorized unchanged-head retry638ac98b/A-23321 passed; exact tree6794f076 matches source. Structured complete exit0 T0/T1/T2/T3/Web receipts independently checked. Both exact new identities (setup wrapper deadlines do not taint acquired result fields; host survival setup assertions lint clean without their four exemptions) have paired base+5/5 and passing file cleanup; all44 base test-lint cases pass. C1/C2 verified. C2 proves exact-four removal in memory per Coordinator compatibility decision; physical disk removal remains separate post-restart follow-up. Previously unfinished Neovim ui identity now passes. Earlier7cfc747a/A-23258/A-23259 remains failed75m timeout/code143 with closure diagnostic/partials retained, not reclassified. Fallback all T2/254 selected T3 once/Web complete; other T3 integrated/batch evidence,T4 unexecuted. Linux x64 c-16fra1,4workers,Node24.21/Neovim0.12.5,Chrome for Testing156.0.8078.4 Headless Shell1248;12 prerequisite skips/cache unknown/report-only advisories. Lifetime2587288ms(~2587s),cost$0.3593455556(~$0.3593),machine accounting. A-23323: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23323-t-2013-final-review-clear-at-71ff8ded2-after-authorized-c-16-retry.md. No Reviewer execution or cross-machine speedup claimed.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-25T08:20:27.988Z

Merged 09c8a70bf0324bcdf8571114956f2fb8697805be onto dev.
