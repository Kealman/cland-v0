---
id: T-748
kind: task
title: "Runtime resource tripwire in the T1 and T2 phases: a test that really spawns, binds or opens a socket fails by name"
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by: []
topic: topic-456
branch: t/T-748-runtime-resource-tripwire-in-the-t1-and
created: 2026-10-17T17:29:45.529Z
updated: 2026-10-17T18:40:07.232Z
---

## Summary

Static analysis can't decide a test's real tier when fixtures choose native or fake paths by option. T-744's reachable census (2026-10-17) would put 283 of 314 files at T3, while T-719's runtime census shows projectHub with fake probes starts zero children. The exact check is at runtime: in the T1 and T2 phases, the runner traps the resource entry points and fails a test that uses one its tier forbids.

## What to build

The T1 and T2 phase workers install a tripwire before loading test files:
- **T1:** child_process spawn, exec and fork, plus net and http(s) listen and connect, fail.
- **T2:** child_process fails, except cland's own CLI subprocess through the documented helper.
Tripped calls fail the test with file, test name, resource and stack, and the run reports a tier-mismatch line. T3 and T4 are untouched. During the report-only week, a trip is reported, not failed. It goes hard together with the D53 budgets. It runs alongside T-684's static refusals for new files.

## Acceptance criteria

- [x] C1. A planted T1 test that spawns `node -e` and a planted T2 test that does the same are each named in the run's tier-mismatch report, while a T2 test using projectHub with fake probes and the cland CLI helper passes clean, proved by runner tests.
  - done: impl-748 · 2026-10-17T18:01:08.766Z
  - verified: rev-30 [reviewer] · run rev-20261017-748-source-correction · 2026-10-17T18:02:21.251Z · commit 34ecdf01cfe76d020a85ee06e5ab3985c78f8f25
- [ ] C2. An integrated cover at the merge head lists every current T1/T2 file that trips. The review request lists them, each routed to a fix or a retag.
  - failed: rev-30 [reviewer] · 2026-10-17T18:40:07.232Z · note A-4699 fails two functional cases and two hard budgets, stops before Neovim, and supplies only a partial hub trip census without complete fix/retag routing; await owned fixes and accepted complete evidence.

## Comments

### impl-748 · 2026-10-17T17:31:28.723Z

Implementation plan: per-file worker preload reads the validated tier assignments; install child-process traps for T1/T2 and socket traps only for T1, before module imports. Keep a single report-only/enforce setting and emit argument-free file/test/resource/stack receipts. Runner tests plant T1/T2 process use and cover allowed fake probes + documented CLI, synchronous/promisified APIs, hooks and T3/T4 noninterference. origin/dev already merged.

### impl-748 · 2026-10-17T17:41:25.720Z

Implementation complete; validation in progress. The runner emits a deduplicated phase trip list (including load-gate repetitions), with one report-only/enforce setting. C1 contract tests currently pass, and the required serial runner repetitions remain underway. C2 follows the Coordinator's decision: source review first, then exact-head full droplet verification, then a complete trip-list routing table; the next integrated dev cover repeats it after merge. Current QA policy is none/per-stage, so no per-item QA request is required.

### rev-30 · 2026-10-17T17:50:35.632Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-748-source
commit: 1384bdc582f5db02cd2654e999e8be00a64406c1
scope: full
findings: [{"severity":"medium","text":"M1: assertion quarantine can reset an enforce-mode tier trip's worker exit1 to0; repetition-side quarantine can count the same forbidden trips as excused. The new side receipt only prints diagnostics. Enforce trips must remain hard independently of quarantine, including repetition-only and caught-error cases; report-only must remain non-fatal.","file":"hub/test/run-suite.ts","line":203}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-748 full source review — not clear

Exact head1384bdc582f5db02cd2654e999e8be00a64406c1; fixed incoming dev41fa374226b8ce67644eb1af2fa52d7916679e4c. Eleven-file runner/test/docs change; no Reviewer execution or delegation.

## Standards
No separate Standards finding. New actual worker proofs are T3 with explicit process-lifecycle headers; identity fallback is pure T1. Fixtures own child processes/directories and observe child close before teardown. No new fixed lifecycle sleep. Canonical file paths use holder.worktree(realpath) and realpath(worker filename). Only manifest T1/T2 workers install the instrumentation; T3/T4 do not import node:test through the tripwire. Static tier assignments add only two sorted new tests.

Primary Coordinator1ad321b8 was read directly: public getTestContext if available, file-only warning fallback on older runtimes, no engine-floor increase/async-hooks fallback. Source meets that design; type-only context interface and Reflect lookup avoid a missing named export. Docs disclose global hook/import cleanup attribution limits.

## Spec — medium M1
hub/test/run-suite.ts:203, with repetition-side interaction at load-gate.ts:112–115. Enforce-mode trip throws a normal test-code error and sets worker exitCode1. A quarantined tripped test is a safe testCodeFailure to quarantine-reporter; a complete receipt with failures[]/excused>0 then resets phase code1→0. New phase trip processing at:193–198 only prints rows and never makes an enforce trip independently authoritative. Load repetitions similarly count code1 quarantined failures as excused, so all five can satisfy the gate. An existing assertion quarantine can therefore defeat the newly documented hard runtime resource boundary.

Fix by preserving a hard failure whenever an enforce-mode tier trip is present across the ordinary phase or repetitions, independently of assertion quarantine normalization. Keep report-only trips non-fatal. Add ordinary quarantined-trip, repetition-only quarantined-trip and caught-error proofs; the current enforcement test only exercises an uncaught unquarantined throw. No claim is made that ordinary report-only behavior is presently broken.

C1's report-only planted names/allowed path are positively supported, but the full runtime contract includes the enforce branch shipped and documented by this change. Source clearance is withheld for M1; C1 must be refreshed with the corrected contract evidence. C2 remains pending its complete trip-list routing receipt.

## Remaining source analysis
All seven child_process module entry points plus ChildProcess.prototype.spawn are wrapped before tests capture ESM exports. Custom promisifiers are preserved and invoke the same guard; delegating suppresses duplicate internal entry trips. The narrowly synchronous CLI allowance requires T2, process.execPath and exact own CLI entry, with finally restoration; raw CLI lookalikes remain mismatches. T1 additionally wraps net server listen, socket connect and exported connect/createConnection, covering the shared HTTP(S)/TLS connection boundary exercised by planted tests. Report-only delegates original calls without throwing; receipts omit arguments/environment/command lines and deduplicate file/test/resource while retaining first stack.

Per-phase side receipts are written before imports and survive quiet load reporters; runSuite waits for both phase and repetitions before reading/reporting and owned-root sweep. load-gate receives the same assignments and preload. No additional high/medium issue found outside M1. Invalid rollout setting is rejected rather than silently changing policy.

## Supplied evidence
A-4675 contains early iterations plus explicitly selected final-source receipts. Accepted tripwire runner repetitions4–5 and final snapshots1–3 give five six-case passes; suite-runner repetitions2–5 plus final snapshot give five43-case passes; contract runner repetitions2–5 plus final snapshot give five6-case passes. All275 accepted top-level tests pass,zero failures/cancellations/skips. Durations-runner final14/14 and context2/2 also pass. Boundary loads are supplied below15; no whole-machine quiet claim is made.

Tripwire tests cover planted named T1/T2 children, clean fake-probe projectHub/documented CLI, CP APIs/promisifiers, direct ChildProcess starts, net/HTTP/HTTPS/TLS, import and hook naming, report/enforce distinction, T3/T4 isolation, raw CLI and repetition-only reporting. They do not cover the quarantine interaction above.

A-4677 exact-head Node24.21 alternating five-pair T1 control independently matches supplied medians134.13ms baseline vs131.25ms instrumented. Ranges overlap; this is no visible single-file slowdown, not proof of negative overhead or full-phase performance. A-4678 supplies static typecheck/tiers/diff-check green.

Primary6fa5c798 was read directly: source review first, then exact-head droplet verify; runner change should select full. C2 may settle from that complete run and fix/retag routing table; next integrated dev cover repeats after merge. If mode is not full, escalate to Coordinator for cover rather than asking an Implementer to bypass mode restrictions. No per-item QA. No verification clearance at this source head.

Standards0 / Spec1 medium. Await corrected committed/pushed head and source re-review before the authorized normal-mode droplet run.
Durable review A-4680.

Criteria: C1 failed (The shipped enforce branch can return success for quarantined runtime-resource trips; preserve hard failure across phase/repetition quarantine normalization and refresh runner proofs before source clearance.).

### impl-748 · 2026-10-17T17:58:33.706Z

M1 corrected in 34ecdf01cfe76d020a85ee06e5ab3985c78f8f25, pushed to origin without merging dev after first review. Red reproduction A-4682; correction patch A-4684. Phase receipts now preserve enforce-mode failures after assertion quarantine and caught/reset worker exits. Load repetitions inspect isolated receipts before pass/quarantine accounting, then forward them to the phase report. New tests include quarantined T1/T2 ordinary trips, caught/reset cases with/without quarantine, and caught/uncaught repetition-only trips with report-only controls. Typecheck/test:tiers pass; required final-head serial runner checks are underway before re-review.

### rev-30 · 2026-10-17T18:02:21.251Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-748-source-correction
commit: 34ecdf01cfe76d020a85ee06e5ab3985c78f8f25
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-748 corrected source — clear

Exact head34ecdf01cfe76d020a85ee06e5ab3985c78f8f25, direct child of reviewed1384bdc582f5db02cd2654e999e8be00a64406c1. No dev merge after first review. Delta scope; read-only source/receipt audit, no Reviewer execution or delegation.

## Standards
No remaining findings. Correction touches only phase/load receipt handling, preload output routing, focused runner tests and its documentation. No resource trapping boundary, engine floor, clock, admission, tier population or unrelated production change. New tests remain actual worker/quarantine contracts under the existing T3 lifecycle header; ownership/close-before-cleanup is unchanged. Existing report-only and normal assertion-quarantine behavior is retained.

## Spec — M1 resolved
runSuite now records whether any phase receipt has mode=enforce, then forces code1 after assertion-quarantine normalization. The phase decision uses persisted resource evidence independently of test success/worker exit-code mutation. Report-only rows do not set this flag.

Each fresh load repetition has a unique tier side receipt, selected by CLAND_TEST_TIER_REPORT in the worker preload. After observing worker completion, the gate reads that receipt before accepting a pass, skip or quarantine excuse. Any enforced resource row blocks all three success/excuse counters and yields a policy diagnostic. Its rows append into the phase receipt, which is consumed after phase and all load lanes complete; parent reporting still deduplicates file/test/resource and retains first stack. Fresh receipt names avoid cross-repetition contamination. The outer runner clears inherited assignment/report paths and owns the new phase paths; nested fixture runs cannot borrow the parent's sink accidentally.

A-4682 independently confirms all three prior defects with expected red runner assertions: ordinary quarantine green, caught/reset green, and quarantined repetition-only green on the old implementation. Expanded corrected contracts cover:
- ordinary quarantined T1/T2 resource trips stay exit1;
- caught trip plus worker exit reset stays exit1, both with/without quarantine;
- uncaught and caught/reset repetition-only quarantined T2 trips are0/5 passed with no quarantine excuse;
- ordinary/repetition report-only controls remain green.
Thus M1/A-4680 resolved; sourceclear C1.

Prior full design/source analysis A-4680 remains applicable to pre-import canonical worker matching, CP/custom-promisifier/direct ChildProcess traps, T1 net/HTTP(S)/TLS boundaries, T2 exact synchronous documented CLI exception, argument-free receipt fields, older-Node file-only warning fallback, T3/T4 isolation and load-only reporting. Primary1ad321b8's no-engine-floor/no-async-hooks decision remains satisfied. No additional high/medium/low finding.

## Corrected evidence
A-4689 exact committed-source log independently parsed: five full9-case tripwire runs, five43-case suite-runner runs and five6-case runner-contract runs,290passes. Supplemental duration14, quarantine6 and context2 all pass;312accepted top-level passes total,zero failures/cancellations/skips. Logs identify strict serial invocations; sampled peak1mload5.56<15. Wall ranges tripwire13.145–16.640s, runner59.582–69.021s, contract14.312–17.394s; supplemental26.020/3.324/0.104s. Static typecheck/tiers/diff check supplied green.

A-4677 remains an earlier exact-parent five-pair T1 overhead control: overlapping baseline/instrumented medians134.13/131.25ms, no visible single-file slowdown. It is not a new corrected-head full-phase measurement. Correction adds receipt-result handling, not per-async-operation instrumentation. Actual T1 phase wall remains pending task verification.

## Criteria and execution boundary
C1 verified at34ecdf01. C2 remains unverified: no complete current-tree T1/T2 trip list or fix/retag routing table is claimed before the run. Primary6fa5c798 read directly during full review authorizes sourceclear→exact-head normal-mode droplet verify; runner changes should select full. Settle C2 from that full receipt/routing table, followed by Coordinator's next integrated dev cover. If selection is not full, report to Coordinator for the authorized census cover instead of forcing a task mode.

Standards0/Spec0 remaining findings. Source clear; Implementer may submit normal mode-free exact-head droplet verification and await final evidence review. No per-item QA.
Durable review A-4691.

Criteria: C1 verified.

### rev-30 · 2026-10-17T18:40:07.232Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261017-748-runtime
commit: 34ecdf01cfe76d020a85ee06e5ab3985c78f8f25
scope: evidence
findings: [{"severity":"medium","text":"M2: copied-harness coverage fixture omits new tier-cli.ts; A-4699:5354 ERR_MODULE_NOT_FOUND prevents its package coverage proof from running.","file":"hub/test/suite-coverage.test.ts","line":46},{"severity":"medium","text":"M3: new quarantined-repetition-only runtime contract takes12.436150763s>5s and lacks a hard legacy allowance (A-4699:7686); ordinary/assertion/load passes do not clear the budget.","file":"hub/test/durations.json"},{"severity":"medium","text":"M4: restart case fails remote-group startup within15000ms (A-4699:5334–5338); causality/known-defect disposition unresolved, so not accepted passing evidence.","file":"hub/test/suite-close-recovery.test.ts","line":19},{"severity":"medium","text":"M5: shared native/fresh resume unavailable-claims case takes6.303s>5s, a second hard legacy duration failure (A-4699:7685); lead/shared-fix disposition pending.","file":"hub/test/session-resume-component.test.ts"}]
finding_counts: {"high":0,"medium":4,"low":0}

# T-748 runtime evidence — not clear

Exact reviewed head34ecdf01cfe76d020a85ee06e5ab3985c78f8f25 remains branch tip. Source correction rev-20261017-748-source-correction/A-4691 covers unchanged implementation; this is evidence scope, no Reviewer execution.

## Standards / execution findings
M2 medium — hub/test/suite-coverage.test.ts:46. Fixture copies harness.ts plus a fixed support list but omits the newly imported tier-cli.ts. A-4699:5354 explicitly fails ERR_MODULE_NOT_FOUND at that copied harness dependency; the package capture proof at:38 cannot start its native fixture. This is caused by the new harness import. Add the helper to fixture population (and audit other copied-harness consumers), retaining all real coverage/descendant/truncated-receipt assertions; request changed-head source review.

M3 medium — hub/test/durations.json, A-4699:7686. New owned identity tier-tripwire-runner::quarantined repetition-only trips remain hard in the load gate takes12.436150763s (formatted12.436)>5s and lacks a hard legacy allowance. Passing assertions and5/5 repetitions do not excuse this hard admission failure. Use the observed Linux value for a reasoned bounded allowance or reduce cost without weakening quarantine/caught-error/repetition proofs; then source re-review before another run.

M4 medium — hub/test/suite-close-recovery.test.ts:19. The restart case fails remote group started: not within15000ms (A-4699:5334–5338). Not classified by this review as caused by the patch or as an accepted known red. Item lead must diagnose/classify through the Coordinator/shared-fix chain before any final clearance or retry. Bugs/S candidate if not already tracked.

M5 medium — hub/test/session-resume-component.test.ts, A-4699:7685. Shared native/fresh resume unavailable-claims case takes6.303s>5s without a hard allowance. Distinct from report-only T2 overage; lead disposition/shared fix required. No speculative task-side edit or retry authorization is inferred.

## Spec / partial positive evidence
Run f6262d9d-8921-4c79-9da5-3adcc6edfaeb/A-4699 exits1, modefull due runner infrastructure.2095total/2088pass/2fail/0cancelled/5prerequisite skips; hermetic157tests then machine1938. Hub phases finish but fail, so Neovim is not reached. A modefull label does not supply complete Neovim T1/T2 coverage.

All nine new runtime runner cases and both context cases pass ordinary/load proofs; all11 owned identities5/5=55/55 repetitions. Thus prior M1 quarantine/caught-error enforce fix remains positively supported; C1 source verification stays current. The run is nevertheless not final-clear evidence.

Independently parsed424 top-level tier-mismatch JSON receipts across52 distinct hub files:40T1 rows and384T2 rows, all report-only. They are runtime diagnostics, not the two functional failures or hard budgets. This is a partial current-head hub census; no full Neovim trip list or complete fix/retag routing table is present yet. Primary6fa5c798 allows C2 settlement from the exact-head full receipt/routing table; it does not authorize ignoring these reds or claiming unexecuted phases.

## Accounting / limits
Supplied Linuxx64 6.8.0-142-generic,c-8lon1,Node24.21.0/Neovim0.12.5,2workers,lifetime2150s/cost0.1493,suite2068.53s,peak1mload9.03,load-gate extra23.18s; free56.40s,machine2012.12s. Host typecheck gate reused c0115e85daa0ee36ff4665c1f2f0ee5b33c47a20. Report-only T3 ratchet4388.559 vs4358.593 and missing baselines are disclosed separately; they are not the two legacy hard budget failures.

Evidence not clear. C2 failed/pending complete accepted execution/routing; C1 remains source-current and positively exercised. No source change or retry by Reviewer. Implementer has been sent exact owned failure paths and other reds for lead disposition; changed head needs fresh source review. No per-item QA.
This note supersedes A-4700 solely to correct the raw numeric precision of M3; the formatted12.436s observation and verdict are unchanged.
Durable review A-4701.

Criteria: C2 failed (A-4699 fails two functional cases and two hard budgets, stops before Neovim, and supplies only a partial hub trip census without complete fix/retag routing; await owned fixes and accepted complete evidence.).
