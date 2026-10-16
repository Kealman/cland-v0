---
id: T-557
kind: task
title: The new-test load gate adds up to 22 minutes to a task verify
state: open
status: ready
size: M
criterion_seq: 2
labels:
  - v0.1.3
  - hub
assignee: null
parent: E-387
blocked_by:
  - T-546
regression_of: T-471
topic: topic-354
branch: t/T-557-the-new-test-load-gate-adds-up-to-22
created: 2026-10-16T01:08:32.102Z
updated: 2026-10-16T05:25:07.163Z
---

## Summary
T-471's load gate repeats every test new to the manifest five times "alongside phase" in the task's verify. On 2026-10-16, T-477's droplet verify e3fddbaf ran 2,659.68 s, of which "load gate extra wall 1311.47s" was repetitions. T-469's c7b31aef and T-527's 62859e0a were still in their repetitions 47 minutes after admission. With six remote slots and about 15 implementers, this alone backed the queue up to five waiters at 01:08Z, one waiting 47 minutes. It also works against E-387's goal of a 3–5 minute typical task verify.

## Acceptance criteria
- [x] C1. The gate's extra wall per verify is bounded: repetitions run in parallel workers, or are capped by a configured per-verify budget in seconds that a session can see in the report, without dropping the five-repetition proof for any new test, which may move to a later run if the budget is exceeded.
  - done: impl-557 · 2026-10-16T04:03:39.920Z
  - verified: rev-30 [reviewer] · run rev-20261016-557-source · 2026-10-16T04:08:04.069Z · commit f6d98a20dbf3029f933eb04f88998e056042a3dd
  - verified: rev-30 [reviewer] · run rev-20261016-557-correction · 2026-10-16T04:37:39.396Z · commit f39bc97477a56b8358260b3265f202e93d6ab0f2
  - verified: rev-30 [reviewer] · run rev-20261016-557-final · 2026-10-16T05:25:06.443Z · commit f39bc97477a56b8358260b3265f202e93d6ab0f2
- [x] C2. Measured on a branch adding about 8 new tests of about 20 s each: the gate's extra wall is under 5 minutes, recorded on the item, and T-471's C1–C3 still hold.
  - done: impl-557 · 2026-10-16T04:05:15.632Z
  - verified: rev-30 [reviewer] · run rev-20261016-557-final · 2026-10-16T05:25:06.443Z · commit f39bc97477a56b8358260b3265f202e93d6ab0f2

## Comments

### coord · 2026-10-16T01:17:08.371Z

Most of the extra wall seen tonight was caused by a stale manifest, not by the gate's design. hub/test/durations.json still had its v0.1.2 baseline (A-2714), so every test added in v0.1.3 counted as new, and every task verify repeated dozens of them. Fixed on dev by the stage-close refresh 2149fe33 (01:17Z, from A-3493). T-557 stays open for the genuine case: a task that adds many slow new tests. Re-measure C2 after branches have picked 2149fe33.

### impl-557 · 2026-10-16T03:56:17.452Z

Test-first runner-boundary regression is red on unchanged gate: eight new 0.1s tests yielded 9.60s extra wall and peak two active tests (ordinary + one repetition); parallel-lane assertion failed. Implementing configurable [verification] load_gate_workers (default2) per Coordinator62b96343, preserving five sequential fresh-process repetitions per identity. The optional same-fixture eight-by-20s probe will record extra tail and peak load under Mac targeted-run guard. No per-item QA required (scope none).

### impl-557 · 2026-10-16T04:05:15.621Z

C2 measured on task branch with shared duration refresh2149fe33 already present and default [verification] load_gate_workers=2: real package-runner inherited task-selection fixture added eight new identities, each20s. Passed in403.937s (runner403.78s), gate extra wall243.21s <300s, lock wait0.02s, peak1m load2.67 on darwin arm64 Nodev24.21.0. Test retains assertions for six completions and six unique process PIDs per identity (ordinary + five fresh repeats), sequential per-identity repeats, at most2 repetition lanes plus ordinary phase, all eight5/5 log lines, worker count report and bound. Durable acceptance log is the latest artifact. T-471 C1–C3 regressions passed in17/17 targeted file (A-3673); deterministic flaky rejection, stable5/5, known/integrated exemption, extra-wall summary/docs retained. Expanded two-lane SIGTERM/SIGKILL cleanup2/2 and config1/1 green. Source head remains f6d98a20dbf3029f933eb04f88998e056042a3dd; no source edits since first review request. Exact-head fresh droplet verification awaits Reviewer source clearance.

### rev-30 · 2026-10-16T04:08:04.069Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-557-source
commit: f6d98a20dbf3029f933eb04f88998e056042a3dd
scope: full

Source clear, 0 findings. A-3681 / /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3681-t-557-source-clear-two-bounded-lanes-and-243-21s-eight-test-tail.md. Configurable default-two lanes preserve five sequential fresh processes per identity, exact receipt and skip semantics, concurrent discovery/final drain, owned-process cleanup and visible lane count. C1 verified. Audited A-3673 runner17/17 and A-3678 eight-by-20s package proof: extra243.21s<300, total403.78s, peak1m2.67. C2 measurement accepted; final C2/runtime gate pending one fresh exact-head Linux droplet verification. No per-item QA. No Reviewer test execution.

Criteria: C1 verified.

### rev-30 · 2026-10-16T04:32:35.072Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-557-linux-first
commit: f6d98a20dbf3029f933eb04f88998e056042a3dd
scope: evidence

# T-557 first Linux gate not clear at f6d98a20

Reviewed head f6d98a20dbf3029f933eb04f88998e056042a3dd, source A-3681. A-3704 /ef335684-78ee-4102-a26e-eaa4879173c9 is actual Linux c-8 lon1, four workers, peak one-minute load18.42. Ordinary1888pass/0fail/4platform skips, but final exit1. Full mode stops after hub; required Neovim phase is not reached.

## Standards
Medium M1 — hub/test/durations-runner.test.ts:72–114: the new eight-identity bound regression achieves only4/5 in its outer load gate (raw1062), so the new task proof is not stable under the required fresh repetitions. Its ordinary execution passes13.000s (1086), and single-lane config plus both two-lane TERM/KILL cleanup cases pass. This is a concrete owned gate failure, not an outside known-flake-only receipt.
The raw gate does not include the failing repetition's assertion. The short fixture uses100ms intervals and requires peak>=3 at107; that is a plausible scheduler-sensitive cause, not a demonstrated diagnosis. Test timeout/fresh-PID alternatives likewise remain unproved. Reproduce with controlled fixture scheduling and capture the assertion, then fix the demonstrated cause while preserving evidence of bounded parallel lanes, sequential identity repetitions and all forty fresh runs. Do not simply remove concurrency proof, widen all timeouts or retry unchanged.

## Spec
No observed loss of the five-repetition contract in production scheduling itself is inferred from the summary. C1 source clearance is retained; C2's controlled Mac eight-by20s measurement remains valid supporting evidence (A-3678 extra243.21s<300). Final C2/runtime settlement stays pending the corrected regression and qualifying new-head suite, including full Neovim. No criterion is failed solely from an unidentified assertion inside the test proof.

Other hard blockers in A-3704 are remote-fixture-lifecycle watchdogTERM7.347s and watchdogINT6.805s>5. The Implementer reports Coordinator-posted shared08e88000 for these budgets; review the exact authorized pick at the correction head rather than treating the current hard budget output as harmless regression notices. New eight-identity13s versus5.701 baseline is itself a known-entry notice, separate from its actual4/5 gate failure.
Impl50ef8271 already commits to controlled reproduction, correction plus posted shared pick, new source review before further verification, and no unchanged retry/dev merge. That is the appropriate next step. No additional run is requested by this verdict.
Final evidence verdict not clear, no new criterion marks; source implementation/accepted measurement do not make this exit1 a final-ready receipt. Findings high0,medium1,low0; Standards1medium,Spec0 diagnosed production findings. No Reviewer execution, edits, signals, provider actions or subagents.

Artifact A-3706 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3706-t-557-linux-not-clear-owned-bound-regression-load-gate-4-5.md

### impl-557 · 2026-10-16T04:36:25.725Z

Corrective source head f39bc97477a56b8358260b3265f202e93d6ab0f2 is committed/pushed; no dev merge after first source review. Delta versus f6d98a20: exact Coordinator-posted08e88000→90098ec8 and b4fc313b→c2386638 lifecycle allowances, plus test-only f39bc974. Controlled repro A-3707 delayed repetition startup1s: runner/gated repetitions succeed, then the old peak>=3 assertion fails with observed2 at25.980s. This demonstrates a real scheduling-dependent assertion flaw, though A-3704 does not retain the exact remote failure assertion. Correction uses a first-two-identity readiness barrier and asserts peak repetition count exactly2 separately from ordinary-phase activity; all40 fresh runs, sequential per identity,5/5 counts, max3 total and wall<300 remain. Same delayed-start command green25.842s A-3708; temporary injection removed. Whole final targeted file17/17 green22.400s A-3709, short bound fixture5.742s / extra4.23s / peak1m3.14; both two-lane signal cleanup cases pass. Typecheck/shard lint/whitespace green. Product gate code and accepted C2 slow measurement A-3678 (extra243.21s / peak2.67) unchanged. Delta source review required before fresh exact-head droplet retry. New knownT-570 and lifecycle budget reds remain separate from own corrected test.

### rev-30 · 2026-10-16T04:37:39.396Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-557-correction
commit: f39bc97477a56b8358260b3265f202e93d6ab0f2
scope: delta

# T-557 corrected fixture/shared-pick delta clear at f39bc974

Headf39bc97477a56b8358260b3265f202e93d6ab0f2; branch t/T-557-the-new-test-load-gate-adds-up-to-22. Compare prior reviewedf6d98a20dbf3029f933eb04f88998e056042a3dd. Origin task ref matches; no dev merge. Three commits: shared lifecycle watchdog allowances90098ec8, remaining lifecycle allowancesc2386638, fixture correctionf39bc974. Only durations-runner.test.ts and durations.json change.

## Standards
No high, medium or low findings (0).
The fixture now distinguishes its ordinary process using a module-load marker, written before any test enqueue discovery. First repetition identities0/1 publish separate readiness markers and wait for their peer with a bounded15s wait. This proves actual repetition overlap without requiring a100ms ordinary body still to be running. Shared ready markers are confined to the owned fixture directory and need synchronize only the first pair. Existing fixture ownership cleanup remains.
Separate activeRepetitions/peakRepetitions require exactly two overlapping repetition tests and zero at completion. Existing per-identity sequentiality, maximum three total active tests, six executions/six distinct PIDs per identity, forty fresh repetitions, eight5/5 receipts and extra-wall<300 assertions remain. The gate implementation itself, process cleanup, timeout policy and package/config/report production sources are byte-unchanged by this delta.
The old serial implementation would fail the two-identity readiness barrier rather than pass a weakened concurrency assertion. No broad timeout increase or assertion removal substitutes for evidence.

## Spec
No findings (0). Prior A-3706's owned proof blocker is addressed by a demonstrated scheduling-sensitive assertion correction:
- A-3707: temporary fixture-only1s repeat-start delay yields completed repetitions then old peak>=3 assertion fails with observed2 (25.980s; extra24.32s).
- A-3708: same delay with corrected repetition-only overlap proof passes25.842s, extra24.26s.
- A-3709: temporary delay removed; whole runner17/17 green22.400s, no fail/skip/cancel. New fixture5.742s/extra4.23s; both two-lane TERM/KILL tests, deterministic flaky rejection, single-lane config, known/integrated exemptions and T-546 skip/TODO/mixed receipt guards pass.
This does not assert that the remote4/5 repetition failed on the same assertion: A-3704 did not preserve its failure detail. It establishes and fixes the independently reproduced proof defect, then requires a new runtime gate.

Both manifest picks are posted shared work:08e880003ac03229e28706fddf9b540aba9ec6fc and b4fc313bb064e85e29a0a75472ca0642daf4f0c2. Primary Coordinator da9333bd-bbbc-498a-8ffe-65352b82051d in Agents explicitly posts the latter, carries the same08e88000 rule and permits picks when the head changes anyway. Independent duplicate-rejecting JSON audit confirms final allow map equals prior map plus exactly the two upstream added-entry sets (2+5 entries); every other root field unchanged. No own T-557 allowance or duration baseline changes. Commit context/index hashes differ because of candidate history, but the added semantic payloads match exactly.
Typecheck/shards reported green; independent immutable whitespace check clear. Test-only shared picks use their posted evidence without extra local repetition.

C1 source verified/refreshed. Accepted A-3678 Mac eight-by20s measurement (extra243.21s,peak2.67) remains evidence for unchanged scheduler; final C2/runtime acceptance still awaits fresh exact-head droplet verification including required full Neovim. A-3704 remains red/historical, not a qualifying final receipt. Coordinator's current dev freeze does not prohibit reviews/picks/droplet runs and does prohibit another dev merge; this delta obeys it. No per-item QA. No Reviewer tests, binaries, compiler execution, edits, signals, provider actions or subagents. Totals Standards0,Spec0.

Artifact A-3712 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3712-t-557-correction-delta-clear-deterministic-repetition-overlap-and-shared-budgets.md

Criteria: C1 verified.

### impl-557 · 2026-10-16T05:24:41.066Z

Fresh exact-head droplet fe1e46b8-57b6-4c25-aff5-ff502a4f8a6c is green at f39bc97477a56b8358260b3265f202e93d6ab0f2 (A-3736): exit0,2278 pass,0fail/cancelled,7platform skips; full hub and Neovim complete. Owned eight-identity bound regression5/5 in outer gate (raw1072) and ordinary15.136s (1093); configured single-lane fixture5/5 (1052). Default load-gate workers2 visible in each phase. Total1624.02s, peak1m load15.85, extra gate tail0.07s. Actual Linux c-8 lon1, Nodev24.21.0, Neovimv0.12.5, ordinary workers4; receipt currently names lifetime/cost unknown. No hard budget or load-gate failure lines. A-3678 accepted controlled C2 measurement remains eight×20s,243.21s extra, peak2.67. Head/working tree unchanged and clean; final Reviewer evidence verdict pending; no additional run or dev merge.

### rev-30 · 2026-10-16T05:25:06.443Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-557-final
commit: f39bc97477a56b8358260b3265f202e93d6ab0f2
scope: evidence

# T-557 final evidence clear at f39bc974

Headf39bc97477a56b8358260b3265f202e93d6ab0f2; branch t/T-557-the-new-test-load-gate-adds-up-to-22. Source chain A-3681 and correction/shared-pick A-3712. Current origin ref and fresh A-3736 receipt match exactly. C1/C2 read from current task view; no new source changes.

## Standards
No high, medium or low findings (0). Prior owned4/5 proof failure is superseded by new corrected-head5/5; no claim that its missing original assertion was recovered. Current receipt is actual execution, not a cancellation, cache label or waived red. Known-entry duration-regression notices are not hard budget failures; final exit0.

## Spec
C1/C2 both verified at this exact head.
C1 source retains configurable positive load_gate_workers default2, visible count, parallel lanes across identities with five sequential fresh processes each, continuous discovery/final drain, strict receipt/skip acceptance and owned cleanup before root deletion. Current full Linux log exposes workers2 in each phase (43/176/6145). Corrected eight-identity package-boundary fixture passes ordinarily15.136s and outer fresh load5/5 (1072/1093); configured single-lane case also5/5 (1052). Both two-lane TERM/KILL worker/root cleanup cases pass (1104–1105), config validation/render roundtrip passes4263. Full runner file includes the unchanged deterministic flake rejection, stable5-repetition, known/integrated exemption and T-546 skip/TODO/mixed receipt assertions already source-audited. T-471 C1–C3 behavior remains covered rather than dropped for speed.
C2 controlled eight-by20s evidence A-3678 remains accepted for unchanged production scheduler: real package fixture retained all40 fresh repetitions, identity sequentiality and lane bound; extra243.21s<300, total403.78s, peak1m2.67 on reported Mac. Correction changed the fixture scheduling assertion/barrier, not production gate logic. This controlled workload measurement is not a universal maximum for an arbitrary number of new identities.

A-3736 /fe1e46b8-57b6-4c25-aff5-ff502a4f8a6c: actual Linux x64 6.8.0-142-generic,c-8lon1 cland-v0-ae0a2cc0,Nodev24.21.0,Neovimv0.12.5,fourworkers. Full mode2285tests/2278pass/0fail/cancel/7platform skips. Hub free38/38, hub machine1850pass/4skip, full Neovim390pass/3skip. All required phases and typechecks complete; final exit0 at7381. Overall1624.02s,peak1m15.85,load extra tail0.07s. The actual full-suite peak is disclosed separately from the controlled C2 probe; default-two tradeoff remains configurable. Lifetime/cost are unknown in receipt; no invented accounting values.
No known-flake or missing-phase exception is needed. Earlier A-3704 stays historical red. No per-item QA; further head movement needs delta review. No additional verification requested.

Final evidence verdict clear, all criteria refreshed. No Reviewer test/compiler/binary execution, edits, signals, provider actions, commits, merges or subagents. Totals Standards0,Spec0 findings.

Artifact A-3737 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-3737-t-557-final-clear-corrected-load-proof-5-5-and-full-linux-neovim-green.md

Criteria: C1 verified, C2 verified.
