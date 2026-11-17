---
id: T-1921
kind: task
title: A transient git failure in the landing lint drops a green batch member and forces the remaining members to rerun the full batch on a new tree
state: open
status: review
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1575
branch: t/T-1921-a-transient-git-failure-in-the-landing
created: 2026-11-16T16:50:10.827Z
updated: 2026-11-17T00:40:53.897Z
---

## Summary

On 2026-11-16 at 16:48Z, batch db99ae9e (T-1764, T-1861, T-1867, T-1904) went green on run c9c83d2d: T0, T1 and T3 exit 0, 3,833 pass, 44 min, $0.18. At landing the queue dropped T-1764 with `merge-test-lint: hub/test/lint-baseline.json:1 [lint-baseline] cannot read test lint policy: Error: Command failed: git cat-file --batch`. The root repository read that blob fine with `git cat-file --batch-check` a minute later (core.bare false), and the hub was under heavy CPU load at the time (T-1919). The hub then re-batched the other three members as b6b8ed80 on a new tree, which means a full rerun: the green result was discarded for all four items because of one failed git read.

## What to build

The landing lint tells an infrastructure failure (git or child-process errors reading the policy or baseline) apart from a lint finding. On an infrastructure failure it retries the read a bounded number of times, then holds the batch as blocked with the cause, keeping the green result. It never drops a member or rebuilds the batch for it. A genuine lint finding keeps today's drop behaviour.

## Acceptance criteria

- [x] C1. A fake git that fails `cat-file --batch` once during the landing lint, then succeeds, lands every member of a green batch with no new batch run (test, red before the fix).
  - done: impl-1921 · 2026-11-17T00:34:38.250Z
- [x] C2. A persistent read failure leaves the batch blocked with its green result and the cause named, drops no member, and a genuine lint finding still drops its member (test).
  - done: impl-1921 · 2026-11-17T00:34:39.355Z

## Comments

### impl-1921 · 2026-11-16T23:54:51.632Z

Consumer inventory (rule 20): testLintPolicy/TestLintError callers are territory.mergeTreeFacts, hub/suite-candidate lintSuiteCandidate/SuiteAdmissionError, test/lint-tests CLI, test-lint-policy and suite-admission-native tests, suite-component-fixture; references in QA E-676/E-677. MergeError/BatchRefusal consumers include merge-batch-territory preparation, dispatch landing wrapper, MergeBatches controller, merge queue/protocol/UI consumers and all merge tests (including native/T3). Plan: keep existing wire codes/shapes, add internal typed infrastructure error with existing merge-git code; propagate it through preparation/landing and preserve existing retryLanding storage. Syntax/schema findings remain ordinary lint refusals. Native processes are unnecessary: existing in-process fake Git adapter can prove the failure boundary.

### impl-1921 · 2026-11-16T23:58:56.280Z

Implemented internal TestLintReadError / MergeLintReadError (existing merge-git wire code). Consumer disposition: territory routes to retry helper; merge-batch-territory propagates infrastructure identity rather than BatchRefusal; MergeBatches retains retryLanding/run/member state; dispatch already propagates merge-git; suite-candidate and lint-tests retain default finding-shaped errors (readFailures throw is opt-in); suite-component-fixture uses checkTestLint, unaffected; QA E-676/E-677 use normal lint findings, unchanged. Native suite-admission tests, merge-gate, test-lint-policy and merge-batches cover existing callers. No protocol/list/serialized shape changed; existing merge-git reopen regression covers legacy persisted/wire code. Search also covered web/nvim, QA briefs, shipped skills and all hub test tiers by field/class/function names. Docs/skills updated for retry behaviour.

### rev-35 · 2026-11-17T00:25:30.781Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1921-source-1
commit: 96cfbe4c31979973df936b1bfce4c57b93199270
scope: full
findings: [{"severity":"medium","text":"Fail-fast current/base and snapshot read groups do not join a rejected attempt's still-pending sibling before requireMergeTestLint retries or returns a terminal hold. Drain the complete read group before retry/terminal handling and retain a held-sibling regression (rule 12).","file":"hub/src/test-lint-policy.ts","line":188},{"severity":"medium","text":"The added suiteUnit scenario loop and merge-batches.test.ts:1410 preparation callbacks lack whole-callback setup/body ownership. Later runner/fixture hooks cannot fence caller continuations or adopt late resources before global mock/root/store cleanup. Use the shared owner before first acquisition (rule 12).","file":"hub/test/test-lint-policy.test.ts","line":84},{"severity":"medium","text":"Baseline-introduction git log failure is swallowed as empty history, and line201 substitutes introduced on any parent read failure. Even readFailures:'throw' bypasses typed retry/hold here. Distinguish successful no-introduction/root facts from unavailable reads so policy is not judged against fallback history.","file":"hub/src/test-lint-policy.ts","line":197}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source not clear A-20499, three medium findings consolidated. Implementer1c942773/b298ac80 confirms no earlier owners or approved fallback dispositions. Batch membership/green-run retention, typed preparation propagation, existing merge-git/retryLanding restart shape and genuine finding drops are otherwise coherent; docs/skills and CHANGES reflect intended behavior. Independent raw diff equality confirms shared96cfbe4c3 matches15757e4d4 exactly. A-20480/A-20497 original red/green, setup failures, lint compound-command correction, source-to-commit/raw/hash/signal/scan limits and normalized consumer dispositions retained. No configured/Linux/browser proof inferred. C1/C2 failed; no criteria verified. Hold released for one consolidated correction and fresh source review before verify. No Reviewer runtime or post-review dev merge.

Criteria: C1 failed (Retries and terminal hold handling do not drain the rejected attempt's parallel read group.), C2 failed (Some policy-history infrastructure failures bypass typed classification; the new controller regressions also lack whole-callback ownership.).

### rev-35 · 2026-11-17T00:40:53.897Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1921-source-2
commit: e7f32c5c45687e7a087169cf23d6d5661b642094
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source clear A-20509. All three A-20499 findings resolved: settled current/base/optional read groups drain before retry/hold; Git stdin errors wait for native completion; caseDeadlines owns the full T2 callback/setup with early partial suiteUnit cleanup; introduction errors propagate and positive parent listings distinguish roots. Held-sibling mutation red and stdin-error/completion ordering retain exact receipts; final membership, same green run, no-drop, restart and genuine-finding rebuild assertions remain. Preparation scenarios moved from T1 batch file into T2 policy case, preserving tier boundaries. New helper consumers and unchanged wire/persisted/default-caller shapes reviewed. A-20507 final-head local policy1/1, batch81/81, hub typecheck/lint exit0 and ancestor native8/8/cost6/6 remain labelled with their source/provenance limits; report-only advisories retained. No configured/Linux/browser proof claimed. C1/C2 implementation/test design clear, both runtime criteria unverified. No findings; hold released for Coordinator window and one mode-free same-head verify. No Reviewer runtime or dev merge.
