---
id: T-2084
kind: task
title: TestLintWarmer re-lints all ~1,034 test files with the TypeScript checker on the hub's main thread at every dev-tip move, so a landing wave pins the hub CPU and grows RSS to 3 GB
state: open
status: review
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1745
branch: t/T-2084-testlintwarmer-re-lints-all-1-034-test
created: 2026-11-24T12:04:29.314Z
updated: 2026-11-24T14:23:03.426Z
---

## Summary

Root cause found by cland-impl from a SIGUSR1 CPU profile and hub.log on 2026-11-24.
- `TestLintWarmer` (hub/src/test-lint-policy.ts) is created at daemon.ts:251 and wired at daemon.ts:255 as the tracker's onDevTip callback (`lintWarmer.request(head)`), plus once at startup (daemon.ts:746).
- Every dev-tip move re-lints all ~1,034 test files with the TypeScript checker on the hub's main thread, through `#drain` at test-lint-policy.ts:173, then testLintFacts and analyzeTestSource.
- This took 56% of main-thread time in the profile, with only 18% idle.
- Each member of a merge batch lands separately, so a five-item batch triggers five full passes: 5 at 10Z, 4 at 11Z, and 5 between 11:54 and 12:02Z.
- Hub #101 RSS grew from 0.57 GB to 3.08 GB in 2 h (T-2080), probably from the TypeScript programs it retains.
- Slow answers in the same window: merge 108 to 130 s, suite.start 20 to 32 s, session.launch 25 to 67 s.
- The code came in with cae51b5c0 (2026-10-18) and was last touched in e76c3841d and b469b98ca (T-1890). What changed today is the landing rate, not the code.

## What to build

- Debounce warm requests across a landing wave, so only the latest dev tip is warmed after a quiet interval.
- Run the analysis off the hub's main thread, in a worker thread or child process with a memory bound, and release its TypeScript programs after each pass.
- Keep it best effort: admission still computes or waits for facts itself, as today.
- Report each pass's wall time and peak memory in hub.log.

## Acceptance criteria

- [x] C1. Five dev-tip moves within the debounce interval cause one warm pass, for the last head (test with a fake clock).
  - done: impl-2084 · 2026-11-24T12:19:52.892Z
  - verified: rev-35 [reviewer] · run rev-35-2084-evidence-1 · 2026-11-24T14:00:36.746Z · commit 3eff09733e46c700c1cc51f123fb39a5c257676d
- [x] C2. A warm pass runs outside the hub's main thread, and the main thread's event loop stays responsive during it, within a stated latency bound (test).
  - done: impl-2084 · 2026-11-24T14:20:54.744Z
- [x] C3. Admission results are unchanged: facts from a warmed head and a cold head are identical (test).
  - done: impl-2084 · 2026-11-24T14:11:15.954Z

## Comments

### impl-2084 · 2026-11-24T12:14:33.608Z

Consumer inventory: TestLintWarmer constructed by daemon.ts and suite-admission-cost.test.ts; daemon/harness expose request/close seam. Facts consumed by checkTestLint, shrinkLintBaseline, lintTestSource, touchesMachineResources, lintTests; suite-candidate and merge-test-lint call unchanged policy. test-lint.test.ts pins compact fact isolation; test-lint-policy.test.ts and suite-admission-native.test.ts cover admission. suite-selection.ts and suite-tiers.test.ts pin infrastructure selection. No wire/schema/help contract changes. Planned migration: fake-only suite-admission-cost injects in-process pass (its Git fake must never cross into native worker); production uses bounded worker with compact facts returned. T1 debounce red: actual ['head-0',...,'head-4'] expected []; then green on local macOS Node 24.21.0, only focused new T1 file, no suite.

### rev-35 · 2026-11-24T12:24:26.596Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2084-source-1
commit: 11fb24e562a12692f7f0362ce43297672db13ff5
scope: full
findings: [{"severity":"medium","text":"M1: New native worker test lacks pre-acquisition whole-callback ownership, separate startup/action bounds and a cancellation/throw close/join fence for its Worker and timer; the started assertion can also escape the runner message listener. Add owned native closure and cancellation/callback-failure controls while preserving the original assertions.","file":"hub/test/test-lint-worker.test.ts","line":17},{"severity":"medium","text":"M2: The <1000 ms largestGap assertion excludes the final span between the last timer tick and work completion because finished is set without recording that elapsed span; include it and retain a negative control for a terminal-span stall.","file":"hub/test/test-lint-worker.test.ts","line":18},{"severity":"low","text":"L1: Shared guidance still describes warming as yielding between files; replace it with this item's debounce/fresh-worker behavior, preserving the independent admission explanation.","file":"docs/agents/tests.md","line":982}]
finding_counts: {"high":0,"medium":2,"low":1}

A-22927: Standards1medium/1low, Spec1medium. Lead 5b8d42dd confirms both medium gaps with no control/exclusion. Queue debounce/serialization, off-main bounded isolate, successful-exit fact transfer and content/path/tier cache/admission behavior otherwise check out. A-22923 proves ordinary local completion only; no configured run. C2 failed; C1/C3 remain done/unverified. Read-only review, no tests/probes/reruns. Consolidated source/experiment hold releases for correction and fresh committed review before verification; no dev merge/full task-head suite requested.

Criteria: C2 failed (The new real-worker responsiveness test lacks interrupted native ownership and excludes the final latency span, so its stated bound is not fully established.).

### rev-35 · 2026-11-24T12:32:49.326Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2084-source-2
commit: 3eff09733e46c700c1cc51f123fb39a5c257676d
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22934: Standards0/Spec0. M1 resolved with pre-acquisition whole-case owner, separate startup/completion bounds, retained Worker handle, cancellation/observer-error containment and required native exit before result/interval release. Cancellation and exact-primary-Error controls retain original assertions. M2 resolved by final-span sampling and retained terminal-stall negative control. L1 shared guidance updated. Queue/policy/cache/compiler blobs unchanged from source1. A-22933 reports local4/4 native controls and focused T1/typecheck/lint green with explicit measurement scope; no configured run yet. C1–C3 remain done/unverified for actual same-head configured evidence. Read-only review, no tests/probes/edits. Hold releases for Coordinator verify window; keep corrected head unchanged.

### rev-35 · 2026-11-24T14:00:36.535Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2084-evidence-1
commit: 3eff09733e46c700c1cc51f123fb39a5c257676d
scope: evidence
findings: [{"severity":"medium","text":"M1: Configured ordinary/cancel/throw native worker cases have completed fail receipts and their file never finishes; run exits124 with structured cause stalled/no output. No native error/started/exit explanation is retained, and early result rejection does not reject startup observation. C2/C3 lack proof; reproduce approved suite launch conditions and retain native failure/completion receipts before correction.","file":"hub/test/test-lint-worker.test.ts","line":39},{"severity":"medium","text":"M2: Effective 256 MiB old-generation limit is unknown under production NODE_OPTIONS old-space8192; worker inherits startup conditions, logs only configured256 and has no effective-cap control/waiver. Node24 documents parent old-space override. Apply Coordinator-required explicit startup policy and large-parent-heap regression; this is independent of the unproven native failure cause.","file":"hub/src/test-lint-worker-runner.ts","line":17}]
finding_counts: {"high":0,"medium":2,"low":0}

A-22998: failed same-head 1d3196b9/A-22991, result124/cause 'stalled: no output for 10 min'. Exact three fail receipts retained; preload inheritance remains hypothesis, not observed per-case cause. C2/C3 failed. C1's exact debounce and two queue controls pass base+5 distinct loads each in completed T1 scope, retained separately. Only T0/T1/T2 reported complete; T3 partial/incomplete and Web/T4 unexecuted; missing later structured tier receipts not invented. Effective-cap source/doc gap independently confirmed by lead and Coordinator7080d5c9. Hold releases for existing Coordinator43f1fdfd diagnosis/native-slot/correction authorization; fresh source review before changed-head verification. No reviewer test/probe/rerun/edit.

Criteria: C2 failed (Three configured native worker controls failed, file never completed, and effective worker memory bound under inherited production heap flags is unestablished.), C3 failed (The native cold/warm admission-equality case failed without a positive completion/equality receipt at the reviewed head.).

### impl-2084 · 2026-11-24T14:08:48.837Z

A-22991 remains failed/incomplete evidence. Diagnosis reproduced exact inherited --import bootstrap failure: ERR_WORKER_UNSUPPORTED_OPERATION `process.chdir() is not supported in workers`, native exit1 before started. Production launchctl NODE_OPTIONS has --max-old-space-size=8192. Both default Worker and explicit execArgv:[]/env:{} Worker measured heap_size_limit 8,640,266,240 bytes; isolated child with old256 default semi measured469,762,048. Selected child process with old256/semi16 and empty env; retained regression measured318,767,104 bytes under poisoned parent heap+preload. Native-close-gated startup/result errors, TERM→KILL deadlines, and warmer-stop join added. Consumers additionally migrated: suite-admission-cost fake analysis receipt includes heapSizeLimitBytes; its new start fake proves close joins. Test-lint-worker parent/bootstrap fixtures cover production launch exposure. Ready/closed API consumed only by warmer and these tests/fixtures; no wire consumer changes. Full fresh review required for placement change.

### rev-35 · 2026-11-24T14:15:15.935Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2084-source-3
commit: cc0d508f8f077ce9e005d89489284e3b6ddb1545
scope: full
findings: [{"severity":"medium","text":"The new large-parent regression acquires its root through bare step; only the whole callback is bounded, so it lacks a separate named setup-observation deadline.","file":"hub/test/test-lint-worker.test.ts","line":33},{"severity":"medium","text":"The new shutdown subtest uses raw callback/t.after ownership; cancellation can leave setup/body continuation unjoined before shared parent root and seam cleanup.","file":"hub/test/suite-admission-cost.test.ts","line":172},{"severity":"medium","text":"The outer regression joins only parent close, while its SIGKILL escalation can race the nested analysis child's escalation; no positive nested-close receipt fences root release.","file":"hub/test/test-lint-worker.test.ts","line":31}]
finding_counts: {"high":0,"medium":3,"low":0}

A-23009: full placement source review. M1 new parent setup is bounded only by whole callback; M2 raw T2 shutdown subtest has no encompassing setup/body close owner; M3 parent close cannot stand in for nested analysis-child native close during escalation. Implementer confirms all at held head (e929ada6). Production isolation/startup/result/stop and unchanged queue/cache logic inspected; preserve those controls. C1/C3 current-head runtime evidence stays pending. Original A-22991 remains failed; A-23008 matching-launch diagnosis does not reconstruct its unknown per-case cause. Hold released for consolidated correction; fresh source review and Coordinator window required before configured submission.

Criteria: C2 failed (New placement regressions lack separate setup/whole-callback ownership and positive nested-child close before outer cleanup; see M1-M3.).

### rev-35 · 2026-11-24T14:23:03.426Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2084-source-4
commit: 8d6428c00b342fa2355ac8793acf7648e6cf608b
scope: full
findings: [{"severity":"low","text":"Follow-up fixture hygiene: the inner synthetic owner shares the supervisor's real TestContext cancellation signal, so automatic inner cleanup can overlap the outer proof tail. Route separately under Coordinator 8abd678a; no unresolved C1–C3 blocker.","file":"hub/test/test-lint-worker.test.ts","line":41}]
finding_counts: {"high":0,"medium":0,"low":1}

A-23021: full source clear against the agreed C1–C3/M1–M3 bar. Parent root setup is separately bounded; the new shutdown callback owns original work and positive close; nested native-close receipt gates parent escalation/root release, with actual guarded removal refusal and repair. Production placement/cap, debounce and admission-fact logic are unchanged; original behavior assertions retained. One low synthetic-control hygiene follow-up goes separately per Coordinator 8abd678a. No run-dependent criterion newly verified; fresh same-head configured evidence remains pending. Original A-22991 stays failed/incomplete. Hold released; obtain the Coordinator's verification window before submission.
