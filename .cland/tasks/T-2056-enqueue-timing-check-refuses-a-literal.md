---
id: T-2056
kind: task
title: Enqueue timing check refuses a literal test name in a file that also has dynamic test names ("new timing identity unknown in base source")
state: closed
status: done
size: XS
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
regression_of: T-2035
topic: topic-1711
branch: t/T-2056-enqueue-timing-check-refuses-a-literal
created: 2026-11-21T19:30:46.579Z
updated: 2026-11-21T23:07:43.115Z
closed: 2026-11-21T23:07:43.115Z
---

## Summary

`checkEnqueueTimings` in `hub/src/hub/enqueue-timings.ts` (landed with T-2035, d20f53b65) throws `merge-budget: new timing identity unknown in base source` whenever a passing sample of 4 s or more comes from a file whose base source reads as `dynamic`. It throws before testing the file's literal patterns. On 2026-11-21 this refused T-2053's enqueue (green verify 62d3caed, clear verdicts) for `hub/test/login-capacity.test.ts::capacity selection bounds decoded rows and indexed query work over retained metadata`. That name is a literal `test('…')` in dev, and the base parse matches it (15 patterns, matched true). The file reads as dynamic only because of its other `for (…) test(label + …)` cases. T-2053 doesn't touch the file. Any item whose verify happens to run such a test slowly can't enqueue. The Coordinator found it at enqueue.

## What to build

Test the base patterns first. A sample that matches a literal base pattern is known, whether or not the file has dynamic cases. Refuse as unknown only when no pattern matches and the source is dynamic. Keep every other path unchanged: new identities in non-dynamic files still need allowances, and a missing receipt still refuses.

## Acceptance criteria

- [x] C1. A 4 s or slower passing sample whose name matches a literal pattern in a base file that also has dynamic test names is known, and the enqueue proceeds (test, red before).
  - verified: rev-35 [reviewer] · run rev-35-2056-evidence-1 · 2026-11-21T20:43:24.525Z · commit 678931704b9dd47c410cb42ada5bf01178424b09
  - done: impl-2056 · 2026-11-21T21:09:01.163Z
  - verified: rev-35 [reviewer] · run rev-35-2056-evidence-2 · 2026-11-21T22:31:03.606Z · commit b2b66069bfd16036aa57ff4e9066db9fa4c10385
- [x] C2. A 4 s or slower sample in a dynamic file that matches no base pattern still refuses with `new timing identity unknown in base source` (test).
  - verified: rev-35 [reviewer] · run rev-35-2056-evidence-1 · 2026-11-21T20:43:24.525Z · commit 678931704b9dd47c410cb42ada5bf01178424b09
  - done: impl-2056 · 2026-11-21T21:09:01.312Z
  - verified: rev-35 [reviewer] · run rev-35-2056-evidence-2 · 2026-11-21T22:31:03.606Z · commit b2b66069bfd16036aa57ff4e9066db9fa4c10385
- [x] C3. A 4 s or slower passing sample in a dynamic file that matches no base pattern, but whose identity already has a duration baseline or an allowance in the base `hub/test/durations.json`, is not refused as unknown and goes on to the existing allowance policy. Example: `claude-code-remote.test.ts`'s ternary-named "Claude TERM-resistant SessionEnd hook is captured and killed by native birth", with a 15.69 s allowance (test, red before).
  - done: impl-2056 · 2026-11-21T21:09:01.422Z
  - verified: rev-35 [reviewer] · run rev-35-2056-evidence-2 · 2026-11-21T22:31:03.606Z · commit b2b66069bfd16036aa57ff4e9066db9fa4c10385

## Comments

### impl-2056 · 2026-11-21T19:32:21.203Z

C1 red reproduced before source fix: targeted public merge-queue timing test failed with `AssertionError [ERR_ASSERTION]: merge-budget: merge-budget: new timing identity unknown in base source: hub/test/new.test.ts::slow case` (false !== true). After minimal ordering change it passed. Fake Git/source + durable disposable fixture timing receipts; no real Git/network/executor launch. Consumer search: checkEnqueueTimings only production caller is hub/src/hub/merge.ts; timing refusal text only producer is hub/src/hub/enqueue-timings.ts; tests: merge-queue.test.ts public admission and enqueue-timing-policy.test.ts pure policy. sourceTestIdentities shared parser remains unchanged; duration source/budget consumers unaffected. Searched hub/src, hub/test (all tiers), nvim, docs and shipped skills for function, refusal, and enqueue-timing names. No wire shape, help, config or role change; existing missing-proof, allowance and changed-receipt paths retained.

### rev-35 · 2026-11-21T19:35:52.460Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2056-source-1
commit: 678931704b9dd47c410cb42ada5bf01178424b09
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear678931704b9dd47c410cb42ada5bf01178424b09 against fixedbasec1aea0c611e55dd38efd7de2d9d27594c1dddb95, Gittree9b2e45bba5848f215bd05b08f58377516cda2464. Existing base-pattern match now precedes dynamic-source refusal; unmatched dynamic remains refused, non-dynamic allowance/missing-proof/final receipt-change paths unchanged. Two mixed modes exercise public merge at exactly4s and durable FIFO success/empty refusal, inside existing owned bounded fixture; all six old modes retained. Shared parser/policy and wire shape unchanged; runtime/per-file docs match. C1/C2 checked but unverified pending actual exact-head configured receipt. A-22566 preserves authored local C1red/green and T2/T1/check limits; no Reviewer execution. Audit A-22567 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22567-t-2056-source1-mixed-literal-timing-identity-ordering-clear.md. Hold releases for Coordinator-granted window and one mode-free verify at this exact head; no full run requested.

### impl-2056 · 2026-11-21T20:42:13.436Z

Same reviewed head 678931704 verification 8b7b84f6 completed exit 0 (A-22572): T0, T1, T2, selected T3 importers and Web all have exit-0 receipts; T4 not run, remaining T3 belongs to merge batch. Recorded generated identities `enqueue refuses absent or mismatched Linux proof independently of manifest timings`, `new passing Linux identities at four seconds require an allowance with measured headroom`, and `enqueue requires durable exact-head Linux timing proof and allowances before mutation` each have structured suite timing outcome pass. Linux x64 droplet c-8 ams3, Node 24.21.0, Neovim 0.12.5; Web Chrome Headless Shell 1248, Google Chrome for Testing 156.0.8078.4. Budget checks report-only with over-budget advisories; not enforce-mode budget proof. Hub-reported lifetime 3825 s / cost $0.2656, not a test-only wall time. Clean worktree; no head changes. Final Reviewer settlement pending.

### rev-35 · 2026-11-21T20:43:24.525Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2056-evidence-1
commit: 678931704b9dd47c410cb42ada5bf01178424b09
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear:8b7b84f6/A-22572 autoexit0 at678931704b9dd47c410cb42ada5bf01178424b09, runtimetree6e9cd8476335bd54609e288ea28051867cf2db85 distinct Gittree9b2e45bba5848f215bd05b08f58377516cda2464. Required public admission case has matched start/pass finish1.792130433s; full merge-queue51/51 and pure timing-policy2/2 pass with file receipts. Reviewed eight-mode loop retains mixedliteral success+durableFIFO and mixedunknown refusal+emptyFIFO at exactly4s; C1/C2 verified with A-22566 red-before history. Required existing identities baseonly, no repetitions claimed. ActualT0/all243T1/all444T2/239selectedT3/all55Web green;34T3deferredbatch,18T4unexecuted. Producer9308tests/9296pass/12skip/0fail/cancel,17provenanceskipreceipts separate,missingreasons0. Linuxc8ams3 Node24.21.0/Nvim0.12.5 HeadlessShell1248/Chrome156.0.8078.4,workers2; budget/ratchet/lintadvisoriesreport-only, enqueueadmissiongate separately exercised. Selectedduration239files1911passingidentities2415.325s phasewall excludeswait/baseonly;lifeaccountnotwall/cache:nullunknown. Audit A-22573 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22573-t-2056-final-evidence-mixed-source-c1-and-c2-clear.md. No Reviewer execution/edit/submission or duplicate/full-run request.

Criteria: C1 verified, C2 verified.

### impl-2056 · 2026-11-21T21:08:43.172Z

C3 red-before-fix reproduced using the real for/ternary title shape and exact claude-code-remote identity: `AssertionError [ERR_ASSERTION]: merge-budget: merge-budget: new timing identity unknown in base source: hub/test/claude-code-remote.test.ts::Claude TERM-resistant SessionEnd hook is captured and killed by native birth` (false !== true), targeted admission test exit 1. Added guarded pinned-base manifest read and exact own-key lookup for dynamic unmatched samples; shared parser and pure allowance policy unchanged. Targeted case now passes with base-baseline-only and base-allowance-only controls; head-baseline-only and head-allowance-only controls retain unknown refusal + empty durable FIFO. Existing eight modes retained. Consumer search from first review remains applicable: only hub/src/hub/merge.ts calls checkEnqueueTimings; no wire/persisted record shape or parser contract changed. Docs runtime and per-file test guidance updated. No dev merge after initial source review.

### rev-35 · 2026-11-21T21:12:39.926Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2056-source-2
commit: b2b66069bfd16036aa57ff4e9066db9fa4c10385
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Reopened source clear b2b66069bfd16036aa57ff4e9066db9fa4c10385, Gittree98a9d0de42c380e2646a97f092ff5ed4e5044f1d; parent678931704, no devmerge. Coordinator8cab03f2 C3 exception implemented narrowly: unmatched dynamic identity is known only with exact own key in pinned base tests/allow, read using existing parser; head-only records cannot establish prior identity. C1 literal-first and C2 no-base-record refusal retained; shared source parser/pure allowance policy/missing-proof/final receipt-change fence unchanged. Four real for/ternary Claude modes cover base baseline/base allowance success and both head-only refusals with durable FIFO assertions, alongside all eight old modes in established owned fixture. Runtime/per-file docs correct; generic README/merge-skill new-identity guidance unchanged. C1/C2/C3 run-dependent/unverified at new head; earlier A-22572/A-22573 remains parent-only evidence. Authored C3 red/green/localcheck limits retained A-22574. Audit A-22575 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22575-t-2056-source2-pinned-base-dynamic-identity-fallback-clear.md. No Reviewer execution/edit/submission. Hold releases for Coordinator window/one exact-head mode-free verify; no full run requested.

### rev-35 · 2026-11-21T22:31:03.606Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2056-evidence-2
commit: b2b66069bfd16036aa57ff4e9066db9fa4c10385
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

New-head final evidence clear:0e3a514a/A-22576 autoexit0 atb2b66069bfd16036aa57ff4e9066db9fa4c10385, canonicaltreef08caac97a37f20fdad994f75001e1e90b5c43ff distinct Gittree98a9d0de42c380e2646a97f092ff5ed4e5044f1d. Matching start/pass finishes for public timing admission2.860155729s and both purepolicy cases; merge-queue51/51 and purepolicy2/2 plusfilepass. Reviewed12mode loop proves C1literal success, C2unmatched/no-base refusal, C3independentbasebaseline/baseallowance success, bothheadonlyrefusals with durableFIFO assertions; realClaude ternaryshape at4s, prior8controlsretained. C1/C2/C3 verified. ActualT0/all243T1/all444T2/239selectedT3/all55Web green;34T3batch,18T4unexecuted. Aggregate9308tests/9296pass/12skip/0fail/cancel;17provenanceskipreceipts separate/missingreasons0. Linuxc8ams3 Node24.21/Nvim0.12.5 HeadlessShell1248/Chrome156.0.8078.4,workers2;budgetsadvisoryreport-only. Selectedduration239files1911passingidentities2857.174s phasewall excludeswait/baseonly; lifeaccountnotwall/cache:nullunknown. Audit A-22577 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22577-t-2056-final-evidence2-reopened-c1-c2-c3-clear.md. Parent A-22572 remains parent-only; red histories retained. No Reviewer execution/edit/submission or duplicate/full-run request.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-21T23:07:43.115Z

Merged 4750d3f576fcb20a7162cdc5180c2a38af33ecb2 onto dev.
