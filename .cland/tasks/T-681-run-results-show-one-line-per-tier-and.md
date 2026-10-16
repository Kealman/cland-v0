---
id: T-681
kind: task
title: Run results show one line per tier, and cland verify --dry-run prints the admission report without queueing
state: open
status: in progress
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
updated: 2026-10-16T23:27:13.782Z
---

## Summary

Nobody can see the tiers until a run says what each one cost. Week 0 adds tier-wall lines to every run report, report-only (memo §5.5 step 0), and a dry run the Reviewer can read instead of running anything (memo §5.4). It also carries T-662's tier counts in the result and its census share.

## What to build

- **Tier lines.** Every run result and log gets one line per tier that ran: files, tests, observed test-seconds, the projected wall at the run's worker count, and the tier's wall budget (T1 120 s, T2 480 s, T3 900 s). The projection uses `durations.json` seconds, the same way the close-run planner does. A tier over its wall prints `over wall (report only)`; nothing fails on a tier line.
- **Share.** The result ends with `tier share: T1+T2 <p> % of <s> s (T3 <s> s, T4 <s> s)` over the manifest seconds of the files the run planned, and a full run's share is the number E-677's exit reads.
- **Dry run.** `cland verify --dry-run` (and the MCP `verify` request's `dryRun: true`) runs admission and selection and prints the mode, reason, deciding files, planned tiers and tier lines. It creates no queue entry, lease or droplet and reserves no spend. Later tickets add their lines to the same report: test lint (T-682) and budgets (T-683).

## Acceptance criteria

- [ ] C1. A task run's result shows one line per planned tier with files, tests, observed seconds, projected wall at the run's workers and the tier's wall budget, proved by a run-report test.
  - failed: rev-30 [reviewer] · 2026-10-16T22:04:34.595Z · note Legacy-only planned Neovim files are silently filtered out of tier rows, including counts/observed seconds/projection. See A-4230.
- [ ] C2. The result shows the T1+T2 share of the planned files' manifest seconds, proved by the same test.
  - failed: rev-30 [reviewer] · 2026-10-16T22:04:34.595Z · note Legacy full-run tier share omits planned Neovim manifest seconds from its denominator. See A-4230.
- [ ] C3. `cland verify --dry-run` prints the selection and tier lines and leaves no queue entry, lease, droplet or spend reservation, proved by a CLI test against `projectHub`.
  - failed: rev-30 [reviewer] · 2026-10-16T23:27:13.782Z · note Owned CLI dry-run proof fails ordinarily in A-4239; full gate times out without assertion detail. See A-4243.
- [ ] C4. A tier over its wall budget prints a report-only notice and the run's exit is unchanged, proved by a test with a planted manifest.
- [ ] C5. The share of a full run at the merge head is recorded on this item as the tier baseline.

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
