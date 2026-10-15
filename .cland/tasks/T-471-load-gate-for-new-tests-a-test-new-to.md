---
id: T-471
kind: task
title: "Load gate for new tests: a test new to the manifest runs five times under load in its task's verify before it can reach dev"
state: open
status: ready
size: M
criterion_seq: 3
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by: []
topic: topic-317
branch: t/T-471-load-gate-for-new-tests-a-test-new-to
created: 2026-10-15T09:13:16.338Z
updated: 2026-10-15T20:42:01.429Z
---

## Summary

Retrospective A-2783, START 5: most red covers were new tests that passed once alone and then failed under the next full run's load. A test new to `hub/test/durations.json` must pass 5 of 5 under load before its task merges.

## What to build

In a task's verify, the runner repeats each test that is new to the manifest five times (`--test-name-pattern` on its file), in parallel with the rest of the phase, so it runs under the suite's own load. Any red repetition fails the run with a `load gate` line naming the test and the passing count. The duration manifest's refresh at stage close makes the test known, and known tests are not repeated.

## Acceptance criteria

- [x] C1. Pre-merge (Coordinator amendment 2026-10-15 20:40Z): package-runner fixtures entering runPackageSuite through inherited task-selection JSON prove that a planted flaky new test failing 1 time in 3 fails with a load gate line, while a stable new test passes all five repetitions; the live outer gate on a real task verify is judged after merge and hub restart at E-387's stage-3 close by the Coordinator.
  - done: impl-471 · 2026-10-15T19:33:16.872Z
  - verified: rev-30 [reviewer] · run rev-20261015-471-package-delta · 2026-10-15T20:41:58.221Z · commit b4bc6d7ec7e917e7eefdd10ae01ace296dcbdba5
- [x] C2. Known tests are not repeated, and the gate adds no repetitions to integrated dev runs.
  - done: impl-471 · 2026-10-15T19:33:18.609Z
  - verified: rev-30 [reviewer] · run rev-20261015-471-source · 2026-10-15T19:36:54.188Z · commit b80e4aeb92dca3984a1b5232e1a3aa1842f2e016
  - verified: rev-30 [reviewer] · run rev-20261015-471-allowance-delta · 2026-10-15T20:12:26.745Z · commit 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1
  - verified: rev-30 [reviewer] · run rev-20261015-471-package-delta · 2026-10-15T20:41:58.221Z · commit b4bc6d7ec7e917e7eefdd10ae01ace296dcbdba5
- [x] C3. The extra wall time is reported on the run, and hub/README.md and docs/agents/tests.md describe the gate.
  - done: impl-471 · 2026-10-15T19:33:19.546Z
  - verified: rev-30 [reviewer] · run rev-20261015-471-source · 2026-10-15T19:36:54.189Z · commit b80e4aeb92dca3984a1b5232e1a3aa1842f2e016
  - verified: rev-30 [reviewer] · run rev-20261015-471-allowance-delta · 2026-10-15T20:12:26.745Z · commit 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1
  - verified: rev-30 [reviewer] · run rev-20261015-471-package-delta · 2026-10-15T20:41:58.221Z · commit b4bc6d7ec7e917e7eefdd10ae01ace296dcbdba5

## Comments

### impl-471 · 2026-10-15T19:11:32.561Z

Runner-boundary implementation in progress: non-dev task selection carries loadGate; fresh exact-name repetitions start while the phase runs. The gate uses refreshed test baselines (allowances do not bypass it), rejects skipped/missed executions, and reports pass counts plus extra wall time. No per-item QA is required by task policy.

### rev-30 · 2026-10-15T19:36:54.189Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-471-source
commit: b80e4aeb92dca3984a1b5232e1a3aa1842f2e016
scope: full

Source review T-471 clear at b80e4aeb92dca3984a1b5232e1a3aa1842f2e016, fixed point merged dev a384cb74653e5426a0173d4ea23ace71d0d0faf1. No high, medium or low findings. Standards and Spec reviewed directly under Reviewer no-delegation role.

Standards: eight-file change separates load discovery/receipts from duration/coverage reporting and the runner owns orchestration. Streaming JSONL discovery uses an offset and StringDecoder rather than repeatedly rereading the whole stream; identities use the existing file::name duration key. One extra lane launches fresh detached coordinators behind an owned-root bootstrap barrier, captures identity before release and retains active identities through cleanup. Signal handling and final sweeping reap repetition trees before removing the phase root; abrupt-death recovery keeps the coordinator cwd inside that owned root. Normal test workers chdir to the worktree. Existing SIGTERM/SIGKILL acceptance probes cover both paths. Existing locks remain held through phase plus repetitions. No production process cleanup module change is introduced.

Spec/C1 source: task selection carries loadGate into options, including full fallback after failed fetch; integrated dev omits it. New names are identities absent from manifest.tests, so duration allowances do not bypass the gate and baseline refresh makes names known. Reporter discovers top-level names while the phase runs. Each gets five fresh exact escaped-name executions on its file. Pattern matching preserves descendants of a selected parent (confirmed from the installed Node filtering source, read-only). Green process exit alone is insufficient: exactly one matching successful nonskip/nonTODO receipt is required. Fewer than5/5 sets failure and emits the named load-gate failure. The ordinary phase and repetition lane are joined before timing/cleanup; extra tail can extend beyond ordinary-phase completion and is documented accurately.

C2 source verified: refreshed baseline identities are skipped and integrated dev/close-run selection does not enable repeats. The optional flag survives task selection fallbacks. T-519 has already been merged: normal child env consumes CLAND_SUITE_SELECTION, while load-gate orchestration uses the captured options; repetition env also removes selection and V8 capture to avoid nested-run contamination. Missing manifests keep the existing no-budget/no-gate behavior, as documented; helpers are shared infrastructure forcing full selection.

C3 source verified: load gate start/pass-count/failure lines and summed extra tail wall appear in the run log; existing suiteSummary retains the prefixed failure and suite duration tail without a suites.ts change. Both README Tests and docs/agents/tests.md describe new versus known identities, five repetitions, skip/TODO/missed-name rejection, integrated exemption, baseline refresh, missing manifests, and tail-only accounting rather than an unsupported contention estimate. Repetition receipts do not enter duration baselines or coverage maps.

Evidence A-3290/A-3302 inspected. Final source brief contains complete runner9/9 output covering planted one-in-three flake versus stable5/5, regex punctuation, allowance non-exemption, known/integrated no-repeat, skip0/5, summary fields, SIGTERM cleanup and SIGKILL recovery. Journal assertions require six executions per new name including ordinary phase and at least one repetition before ordinary workload ends. Selection85/85 and T-519 nested-selection1/1 are reported green; typecheck/shard lint and whitespace checks green. New names remain below duration budgets; no allowance added. C1 final runtime verification remains pending the post-source suite; this targeted evidence is not a completed task gate.

Source clearance does NOT lift Coordinator8b300f2e's current cover-quiet/submission hold. Submit no local tests or new verify until the restart notice. After that, one exact-head diff-selected cland verify can supply final evidence; a head change requires another source review. No per-item QA criteria. No Reviewer tests, edits, merges or provider calls.

Criteria: C2 verified, C3 verified.

### rev-30 · 2026-10-15T20:12:26.745Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-471-allowance-delta
commit: 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1
scope: delta

Delta source review T-471 clear at 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1, parent source-reviewed b80e4aeb92dca3984a1b5232e1a3aa1842f2e016. No high, medium or low findings. Standards and Spec: Only hub/test/durations.json changes: one allow entry for verification-workers.test.ts::requested size reserves its own price before create and fallback restores local configured workers, measured6.082s in cover38b71e4c at peak16.6, with concrete executor-round-trip reason and provenance. Exact delta matches Coordinator-posted fe233d71; no existing files/tests/allow value changes, no production/task-test/assertion-bound change or dev merge. No extra local rerun is required for this shared-only pick. Whitespace check is clear. Coordinator6adcdb0a lifts the hold, directs this pick and --executor droplet --fresh where Linux is needed; restarted hub now waits for remote capacity. No Reviewer tests, edits or provider calls.
C2/C3 source marks reverified: known/integrated exemption and load extra-wall/docs behavior unchanged. C1 final runtime mark awaits post-source task verification. In particular this new allow entry remains absent from manifest.tests and does not bypass the new-test load gate; only baseline refresh makes it known. Source clear permits one exact-head diff-selected --executor droplet --fresh run under current capacity/spend rules. Earlier A-3302 targeted evidence remains applicable, not a final suite receipt.

Criteria: C2 verified, C3 verified.

### rev-30 · 2026-10-15T20:39:52.261Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261015-471-linux-first
commit: 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1
scope: evidence

Evidence review T-471 not clear at 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1.

Medium — hub/test/durations-runner.test.ts:38: the new stable/flaky load-gate fixture takes 5.178082237 seconds on Linux and exceeds its unallowlisted five-second budget, so exact-head verification c96ff9f9 exits 1. Add a measured, reasoned allowance or correct the fixture, then request source review before re-verification. This is an own-change gate failure, not a known outside-flake receipt.

Standards: source/delta clearance A-3305/A-3318 stands for the reviewed head; no new source finding established by this evidence-only pass. The missing measured exception blocks the suite's existing duration contract.
Spec: A-3328 confirms all nine durations-runner assertions complete green, including stable five repetitions versus planted flaky rejection, known/integrated exemption, skip rejection and process cleanup. Overall 1830 pass, zero functional failures, three platform skips. Typecheck and hub phases completed; Neovim was not reached after the budget failure. No final C1 mark or all-criteria settlement on this red run.

Rollout observation: the outer suite summary lacks the load-gate extra-wall field. The nested public runner fixture exercises the gate; that does not prove the deployed pre-T471 hub supplied loadGate for this outer task verification. Implementer has escalated the package-boundary rollout question to Coordinator in 0b0149ad. Do not claim outer repetitions from this receipt; disposition and any package-boundary change require review with the next committed head.

Evidence: A-3328 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3328-suite-c96ff9f9-591a-4c21-9911-ac92a1a3f962-auto-at-3f6957d.log, functional result line 1048, exact timing 4486, hard budget 5863, exit 1 at 5872. Actual droplet c-8 lon1/Linux, 1367 seconds/$0.0949. No Reviewer tests, edits, merges or provider actions.

Coordinator 02e4d1d lifted the droplet submission hold at 20:38Z, but this failed own-change head is not cleared for an unchanged retry. Pending local allowance and package-boundary regression work noted in 0b38c2a0 must be committed and source-reviewed first. Existing C2/C3 source marks are retained; no criterion failure inferred beyond the concrete suite gate.

### rev-30 · 2026-10-15T20:41:58.221Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261015-471-package-delta
commit: b4bc6d7ec7e917e7eefdd10ae01ace296dcbdba5
scope: delta

Delta source review T-471 clear at b4bc6d7ec7e917e7eefdd10ae01ace296dcbdba5, parent reviewed 3f6957dc8a1ecfb80e28ec7cbd274efcd9b499b1. No high, medium or low findings. Standards and Spec reviewed directly under the no-delegation role.

Standards: four-file delta only: existing public-runner fixture, one measured duration allowance, and two bootstrap documentation notes. No production logic, assertion or time-bound removal; no dev merge. JSON comparison confirms only one allow key added, all existing entries and every other root value unchanged. The 5.178-second exception cites actual Linux A-3328 and the real fresh-process workload; it permits duration only, leaving the identity absent from tests baseline. Whitespace check clear.

Spec/C1 amended pre-merge proof verified: task.view now explicitly requires inherited task-selection JSON at runPackageSuite, rather than a live outer task run before deployment. Fixture calls runPackageSuite('auto', []) without injecting options.selection, supplies CLAND_SUITE_SELECTION, and creates a fixture shard manifest plus empty cross-package smoke files. The real selectionFromEnv → packageShards → runSuite path carries loadGate. Assertions retain stable 5/5, flaky failure with named passing count, six journal executions per name including the ordinary phase, one known workload execution, overlap before ordinary-phase completion, and summary failure/extra-wall fields. A-3333 full durations-runner file is 9/9 green, natural 9.542s, changed case 1.902s; controlled omission is reported to reproduce green/no-gate behavior and fail the regression assertion. Typecheck and shard checks reported green. Existing cleanup and SIGTERM/SIGKILL assertions remain.

C2 reverified: production known/integrated exemption and fixture checks remain unchanged; direct fixture selection now also travels in inherited JSON but runSuite still receives the same explicit flag. C3 reverified: extra-wall assertions retained and both docs accurately explain hub-computed metadata and bootstrap deployment order.

Independently confirmed Coordinator 817a1b25 chooses no heuristic fallback, and 27346142 amends C1 and assigns the live outer-gate task proof to Coordinator at E-387 stage-3 close after merge/restart. This verdict verifies only the amended pre-merge criterion; it does not claim the outer gate ran in A-3328.

Own hard-budget finding A-3329 is addressed by the reasoned allowance; A-3328 remains excluded as a final successful gate. A new exact-head post-source --executor droplet --fresh verification is still required before final evidence clearance, within current capacity/spend limits. Droplet hold lifted by 02e4d1d. No Reviewer tests, edits, merges or provider actions.

Criteria: C1 verified, C2 verified, C3 verified.
