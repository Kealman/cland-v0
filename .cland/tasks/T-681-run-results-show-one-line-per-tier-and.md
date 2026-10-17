---
id: T-681
kind: task
title: Run results show one line per tier, and cland verify --dry-run prints the admission report without queueing
state: open
status: ready
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-676
blocked_by:
  - T-679
topic: topic-412
branch: t/T-681-run-results-show-one-line-per-tier-and
created: 2026-10-16T19:59:27.868Z
updated: 2026-10-17T01:20:16.594Z
---

## Summary

Nobody can see the tiers until a run says what each one cost. Week 0 adds tier-wall lines to every run report, report-only (memo §5.5 step 0), and a dry run the Reviewer can read instead of running anything (memo §5.4). It also carries T-662's tier counts in the result and its census share.

## What to build

- **Tier lines.** Every run result and log gets one line per tier that ran: files, tests, observed test-seconds, the projected wall at the run's worker count, and the tier's wall budget (T1 120 s, T2 480 s, T3 900 s). The projection uses `durations.json` seconds, the same way the close-run planner does. A tier over its wall prints `over wall (report only)`; nothing fails on a tier line.
- **Share.** The result ends with `tier share: T1+T2 <p> % of <s> s (T3 <s> s, T4 <s> s)` over the manifest seconds of the files the run planned, and a full run's share is the number E-677's exit reads.
- **Dry run.** `cland verify --dry-run` (and the MCP `verify` request's `dryRun: true`) runs admission and selection and prints the mode, reason, deciding files, planned tiers and tier lines. It creates no queue entry, lease or droplet and reserves no spend. Later tickets add their lines to the same report: test lint (T-682) and budgets (T-683).

## Acceptance criteria

- [x] C1. A task run's result shows one line per planned tier with files, tests, observed seconds, projected wall at the run's workers and the tier's wall budget, proved by a run-report test.
  - done: impl-681 · 2026-10-16T23:29:59.002Z
  - verified: rev-30 [reviewer] · run rev-20261017-681-final · 2026-10-17T01:20:15.533Z · commit 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
- [x] C2. The result shows the T1+T2 share of the planned files' manifest seconds, proved by the same test.
  - done: impl-681 · 2026-10-16T23:29:59.371Z
  - verified: rev-30 [reviewer] · run rev-20261017-681-final · 2026-10-17T01:20:15.533Z · commit 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
- [x] C3. `cland verify --dry-run` prints the selection and tier lines and leaves no queue entry, lease, droplet or spend reservation, proved by a CLI test against `projectHub`.
  - done: impl-681 · 2026-10-16T23:29:59.587Z
  - verified: rev-30 [reviewer] · run rev-20261017-681-final · 2026-10-17T01:20:15.534Z · commit 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
- [x] C4. A tier over its wall budget prints a report-only notice and the run's exit is unchanged, proved by a test with a planted manifest.
  - done: impl-681 · 2026-10-16T23:29:59.797Z
  - verified: rev-30 [reviewer] · run rev-20261017-681-final · 2026-10-17T01:20:15.534Z · commit 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
- [x] C5. The share of a full run at the merge head is recorded on this item as the tier baseline.
  - done: impl-681 · 2026-10-17T01:19:26.368Z
  - verified: rev-30 [reviewer] · run rev-20261017-681-final · 2026-10-17T01:20:15.534Z · commit 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2

## Comments

### impl-681 · 2026-10-16T21:52:51.065Z

Implementing tier summaries and read-only dry-run admission. Per launch instruction, local targeted test execution skipped until authorized T-475 restart; local static checks and reviewed-head droplet verification planned.

### impl-681 · 2026-10-16T22:00:56.535Z

Pre-review full planned-file manifest baseline at 06e434f6eedf11904d57a67a6d31c23ff3c94531: tier share: T1+T2 0.02 % of 5281.23 s (T3 5280.19 s, T4 0 s). 254 planned files (T1 9, T2 4, T3 241), including 12 without duration file baselines; missing seconds are excluded from the census share and explicitly named in reports. Reviewed-head droplet full run will confirm the same planned-file baseline. Static checks passed; local tests skipped under the instructed T-475 admission restriction.

### impl-681 · 2026-10-16T22:01:42.737Z

Final requested source-review head: c457754a7f3f823f598220e8629490220eb3b986 (pushed). Includes close-run summary ordering regression; full planned-file baseline remains 0.02% of 5281.23 s. Local static checks pass; runtime evidence waits for reviewed-head droplet verification.

### rev-30 · 2026-10-16T22:04:34.595Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-681-source
commit: c457754a7f3f823f598220e8629490220eb3b986
scope: full
findings: [{"severity":"medium","text":"M1: Legacy shards-only candidates still plan/run Neovim, but readTierAssignments returns only legacy hub entries and this filter silently drops every Neovim file. Full-run tier counts, observed seconds, projected wall and share omit planned manifest weight. Assign the compatible legacy Neovim tier (conservative T3) or explicitly account for unassigned planned files; add a legacy hub+Neovim report/dry-run regression without changing execution scope.","file":"hub/src/suite-tier-report.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

T-681 full source review not clear at final requested branch tip c457754a7f3f823f598220e8629490220eb3b986 (origin/t/T-681-run-results-show-one-line-per-tier-and). Fixed point 7bda748394f9929614046667084b4fe160a3b722. Initial 06e434f6 and follow-up summary-order corrections through the final tip were inspected before verdict; no verification has started. Both axes reviewed in-session under the role's no-delegation constraint.

Spec — medium M1, suite-tier-report.ts:23: planned files without a tier-map entry are silently omitted. readTierAssignments in suite-shards.ts:87–91 reads only entries physically in the selected manifest. T-679 explicitly preserves shards-only legacy candidates, whose map classifies hub files and omits Neovim. packageShards still plans the Neovim phase/smoke, but tiers.has(path) filters all those paths out of every tier row. Their file/test counts, observed timings, projected wall and duration weight disappear from full-run results and dry runs, violating C1/C2's planned-file accounting. For example, a legacy T1 hub file with 10 manifest seconds and a planned Neovim file with 90 seconds produces share 100% of 10 s instead of accounting for the 100 s plan. This is a pinned source deduction, not a Reviewer-executed reproduction.

Keep legacy execution/admission compatibility. Give its planned Neovim files the conservative compatible T3 interpretation, or otherwise explicitly include unassigned planned files in truthful reporting; do not silently exclude known manifest seconds. Add an in-process legacy-only hub+Neovim report/preview regression checking file sets, observations and the share denominator, while preserving the actual phase plan.

Standards: no additional findings. The new pure T1 summary tests and in-process T2 CLI/admission fixture state their tiers. Explicit sorted rendering now keeps T1/T2/T3/T4 then the final aggregate share after shard-line deduplication. Snapshot/worker-policy recalculation handles serial T1 and changing machine workers; wall notices are outside the run exit decision. Core projection uses file LPT placement and phase summation; unknown baseline estimates are distinct from known manifest share.

Dry-run source path otherwise looks correct: CLI/MCP bool reaches suite.start; report is optional only for dryRun, caller/occasion authorization remains, immutable/current manifest lint and HEAD fence still execute. It returns before suite directory, job persistence, queue/admission, lease/acquire/reservation paths. Explicit droplet checkSpend performs provider GET/read-only spend inspection, not reservation. Existing test captures the fixture's actual isolated spend path through projectHub defaults. No need to create real execution to review it.

A-4229 records claimant typecheck/test:tiers/diff checks green and preliminary full planned share 0.02% of 5281.23 s. Local targeted timings are deliberately unavailable under the Coordinator's T-475 admission restriction; their absence is not this finding and no refusal workaround is directed. No Reviewer test/compiler/provider execution. C5 remains preliminary and must be confirmed/recorded against accepted reviewed-head runtime evidence.

C1/C2 failed for M1; C3/C4/C5 remain unverified pending corrected source and exact-head task verification. Correct the accounting and request source re-review before verification. Scope full; one medium Spec finding, zero additional Standards findings. No per-item QA criteria.
Review artifact A-4230.

Criteria: C1 failed (Legacy-only planned Neovim files are silently filtered out of tier rows, including counts/observed seconds/projection. See A-4230.), C2 failed (Legacy full-run tier share omits planned Neovim manifest seconds from its denominator. See A-4230.).

### rev-30 · 2026-10-16T22:10:48.219Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-681-legacy-correction
commit: c93466646f45158b88a6c004c616799ba8e6b446
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-681 delta source review clear at c93466646f45158b88a6c004c616799ba8e6b446, directly following reviewed c457754a7f3f823f598220e8629490220eb3b986. Only suite-shards.ts and suite-dry-run.test.ts changed. Both Standards and Spec reviewed in-session; no remaining findings.

M1 resolved: legacy-only readTierAssignments now adds existing Neovim test files as conservative T3. Current-tier manifests retain their interpretation. planTierReport still intersects assignments with the actual package phase targets, preserving reduced selection and execution scope; this adds truthful accounting, not another execution phase.

The focused T2 regression independently asserts the unchanged legacy package plan, then uses projectHub and a real suite.start dry-run frame to check complete hub+Neovim file/test counts, projected phase wall, observed Neovim seconds and the full known-manifest share denominator (20% of 1000 seconds). It also checks that no suite was queued. The fixture retains in-process admission and does not launch Neovim to account for it.

Prior source review A-4230 otherwise stands. Pinned diff and whitespace checks reviewed; claimant reports static typecheck/test:tiers green. No Reviewer test/compiler/provider execution. Local test execution remains deliberately unavailable under the T-475 restriction; this clearance does not direct a workaround.

All C1-C5 require runtime evidence or its recorded baseline, so none is verified on this source pass. Prior C1/C2 failure mechanism is corrected in source; claimant done marks and Reviewer verification await accepted exact-head evidence. C5's preliminary 0.02% of 5281.23 seconds remains preliminary until confirmed and recorded from accepted runtime evidence. Clear source permits normal mode-free droplet verification at this exact head; no per-item QA criteria.
Review artifact A-4232.

### rev-30 · 2026-10-16T23:27:13.782Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261016-681-first-gate
commit: c93466646f45158b88a6c004c616799ba8e6b446
scope: evidence
findings: [{"severity":"medium","text":"E1: The new CLI dry-run admission/no-mutation proof fails in the ordinary phase (A-4239:3399); its load-gate identity reports 0/5 only after exit 124, with no detailed assertion retained. C3 is not established. Obtain an authorized bounded trace, fix the demonstrated cause and request source re-review; do not attribute an assertion or repeat count the receipt does not expose.","file":"hub/test/suite-dry-run.test.ts"}]
finding_counts: {"high":0,"medium":1,"low":0}

T-681 evidence review not clear at unchanged source-reviewed c93466646f45158b88a6c004c616799ba8e6b446. Inspected durable A-4239, suite c1d75969-ecb2-46d3-a99e-c3ccbc45eea7, and the task's matching failed verification record.

Medium E1 — hub/test/suite-dry-run.test.ts: the new CLI admission/selection/no-mutation proof fails ordinarily (A-4239:3399, 701.943361 ms). Its load-gate identity reports 0/5 at line 4094, after “Finished: exit 124” at line 4093. The receipt has no detailed assertion; do not infer which assertion failed or claim five independently captured assertion failures. This does not establish C3 and is not a known-unrelated-red exception. Obtain a bounded failure trace through the authorized test path, correct the demonstrated cause, and request new source review before another head is verified. No unchanged retry or local admission bypass is directed.

Positive evidence retained: the planted over-wall report case, weighted/reduced selection case and corrected legacy Neovim case pass ordinarily and each 5/5 repetitions (3427,3430,3432). The three pure tier-report cases also pass 5/5. M1's legacy accounting correction remains source-clear; this receipt does not reopen it.

Overall run exits 124 after the 60-minute timeout (3596.94 s). Full mode did not reach Neovim; the machine reporter never produced its complete timing/count summary. Final T2/T3 rows explicitly say observed unavailable, so these are not zero-test execution claims. Tier share emitted 0.02% of 5281.23 s (T3 5280.19 s, T4 0), matching the preliminary plan census, but this incomplete gate is not accepted completed full-run/merge-head evidence for C5.

Fail C3 for the owned ordinary CLI proof failure. No criterion verified in this not-clear pass; C1/C2/C4 positive receipts are retained for a later final assessment, and C5 remains pending accepted full evidence. Coordinator submission hold and local admission restrictions remain in force. Reviewer performed only read-only source/log inspection, no tests/compiler/provider execution.
Review artifact A-4243.

Criteria: C3 failed (Owned CLI dry-run proof fails ordinarily in A-4239; full gate times out without assertion detail. See A-4243.).

### impl-681 · 2026-10-16T23:30:00.112Z

Corrected source head 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2 (pushed). Exact local red TAP trace showed startup ledger registration race plus failure-path provider leak. Cleanup-only change preserved the failure but made runner exit normally in 0.83s; registering startup ledger before the unchanged byte-equality assertion made original case green. Whole T2 file 5/5 serial: 2.153,2.157,2.125,2.283,2.178s; T1 file 3/3 in 0.142s. Typecheck/test:tiers/diff-check pass. A-4240 holds machine timing analysis; correction proof artifact posted. Fresh source review requested; droplet retry waits for explicit hold lift. C5 full-run evidence remains pending.

### rev-30 · 2026-10-16T23:30:35.650Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261016-681-fixture-correction
commit: 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-681 delta source review clear at 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2, compared with c93466646f45158b88a6c004c616799ba8e6b446. Only suite-dry-run.test.ts changes (6 insertions, 2 deletions); product code and every existing assertion are unchanged. Both Standards and Spec reviewed in-session; findings [].

E1 correction: before projectHub starts, the fixture awaits rememberProject against exactly the isolated .cland/executor-state ledger that projectHub uses. Production rememberProject adds project registration without a reservation. The original before/after byte equality, provider GET-only assertion, empty droplets/leases/jobs/queue assertions and invalid-manifest refusal remain intact. This establishes the startup baseline without weakening the no-spend-mutation test.

The fake provider now registers with onCleanup, so an earlier failing teardown step cannot skip its disposal: the ownership cleanup loop catches individual errors and continues through resources, hubs and directories. The restored scheduler/store cleanup uses beforeDirectories, including signal cleanup, to stop writers before removing their root. No sleep, deadline relaxation, allowance or execution bypass is added.

A-4245 records an authorized bounded local TAP reproduction: actual ledger contained the registered fixture root while expected was null; the process then remained alive after its fast failure. Its cleanup-only experiment retained the same failed byte-equality assertion but exited normally in 0.83 seconds, isolating failure-path disposal from the ledger race. With registration added, the exact case passed, followed by five serial whole T2 files (20/20 cases, 2.125–2.283 seconds per file) and the pure T1 file (3/3). These are claimant-recorded targeted receipts, inspected read-only; Reviewer ran no tests/compiler/provider. Static typecheck/test:tiers green is also recorded; pinned diff whitespace check passed.

The correction addresses the observed local failure and leak. It is consistent with the remote gate's unfinished CLI identity; it does not establish a precise attribution of the entire 60-minute remote wall. A-4240 correctly distinguishes summed emitted test times from unavailable completed file wall times; T-720 owns runner deadline/diagnostic work.

C1-C4 claimant done marks are restored with targeted proof. No Reviewer criterion marks added on this source pass: accepted exact-head droplet evidence and C5's recorded completed full-plan baseline remain pending. The preliminary census remains 0.02% of 5281.23 seconds, not completed final evidence. This source clearance does not lift the Coordinator's daily-spend submission hold. Wait for an explicit lift before new mode-free droplet verification; no dev merge or unchanged-head retry is directed.
Review artifact A-4246.

### impl-681 · 2026-10-17T01:19:26.347Z

C5 confirmed full-run tier baseline at unchanged source-reviewed head 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2: tier share: T1+T2 0.02 % of 5281.23 s (T3 5280.19 s, T4 0 s). Completed mode-full droplet run fca3a564-9f9e-4e60-a0c3-5979ad322aea, exit 0; A-4268 lines 7971–7974. T1: 9 files, 44 tests, 1.138 observed s, 39.515 projected s at 1 worker. T2: 4 files, 19 tests, 6.493 observed s, 13.477 projected s at 2 workers. T3: 241 files, 2303 tests, 5777.789 observed s, 2685.709 projected s at 2 workers, over wall (report only); exit remains green. Share uses known planned-file manifest seconds, with 12 missing baselines explicitly reported. All seven new T1/T2 identities passed ordinary execution and 5/5 load repetitions, including corrected CLI proof (A-4268:3430). Full result: 2437 tests, 2429 passes, 8 skips, 0 failures; Linux c-8 lon1, workers 2, 3005.80 s suite wall, 3080 s machine lifetime, $0.2139. No source changes since clear verdict; final evidence review requested. Live hub report formatter predates T-681, while candidate package log contains complete tier lines and same-head report tests prove new formatter behavior.

### rev-30 · 2026-10-17T01:20:15.534Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261017-681-final
commit: 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-681 final evidence clear at unchanged source-reviewed 27a74fdccd63774eda41a4a8a0ef5bb9ef3e8ba2. Origin tip and task verification record match. Audited complete A-4268 / fca3a564-9f9e-4e60-a0c3-5979ad322aea: full hub plus Neovim exits 0, 2437 tests/2429 pass/0 fail/8 prerequisite skips. Hub free 44 pass, machine 1995 pass/5 skips, Neovim 390 pass/3 skips. No hard budget or load-gate failure.

All seven new identities pass ordinarily and 5/5 each (35/35 load repetitions): three pure reporting/summary cases and four T2 dry-run/report/projection/legacy cases. Corrected CLI admission/no-mutation proof passes at 1.549986139 seconds and its formerly unfinished gate now completes 5/5 (line 3430). Restored report case is 1.699943431 seconds; legacy preview is 0.564071542 seconds. M1 legacy omission and E1 fixture registration/cleanup correction remain resolved.

C1/C2: same-head run-summary and restored-result tests pass, including counts, observed seconds, phase-weighted wall, worker policy, complete legacy hub+Neovim accounting, aggregate row ordering and planned-file share denominator. Completed candidate log contains observed tier lines:
- T1: 9 files, 44 timing receipts, observed 1.138 s; projected 39.515 s at 1 worker; budget 120 s.
- T2: 4 files, 19 timing receipts, observed 6.493 s; projected 13.477 s at 2 workers; budget 480 s.
- T3: 241 files, 2303 timing receipts, observed 5777.789 s; projected 2685.709 s at 2 workers; budget 900 s.

C3: real CLI/projectHub dry-run contract completes normally and 5/5; original byte-equality spend, empty queue/jobs/lease/provider state, GET-only and invalid-manifest refusal assertions were retained in source A-4246. No test bypass or weakened deadline/assertion was used.

C4: planted over-wall restored-result proof completes normally and 5/5. Actual full log also prints T3 “over wall (report only)” and then Finished: exit 0. Projected wall and summed observed test-seconds remain distinct from actual suite wall.

C5: claimant recorded the completed reviewed-head full-plan baseline in the item comment at 01:19:26Z: tier share T1+T2 0.02% of 5281.23 s (T3 5280.19 s, T4 0 s). Independently parsed committed manifests: T1 known 0.495366 s, T2 0.544 s, T3 5280.190327 s; 254 files and 12 explicitly reported missing baselines (3/2/7). Known manifest seconds determine share; missing-file median estimates affect projections only. A-4268:7971–7974 confirms the recorded rounded line.

The currently serving hub's old formatter does not display these new tier rows in its topic receipt; the candidate log and same-head production summary/restored-result tests do. This review does not claim the live hub has already rolled out T-681. Prior A-4239 remains an interrupted failed receipt; T-720 diagnostic/deadline follow-up and historical full-wall causality are unchanged.

All C1-C5 claimant done marks present; verify all. No remaining Standards/Spec findings, no per-item QA or further task run needed. Linux c-8 lon1, two workers, suite 3005.80 s, peak load 12.13, reported machine lifetime 3080 s/cost $0.2139. Reviewer performed read-only inspection only.
Review artifact A-4269.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.
