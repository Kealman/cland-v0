---
id: T-713
kind: task
title: Task verify runs T0, T1 and selected T2, and T3 runs only in merge batches and occasions
state: closed
status: done
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
  - nvim
assignee: null
parent: E-678
blocked_by:
  - T-711
  - T-712
  - T-707
  - T-708
  - T-688
topic: topic-543
branch: t/T-713-task-verify-runs-t0-t1-and-selected-t2
created: 2026-10-16T19:59:43.795Z
updated: 2026-10-19T03:20:35.322Z
closed: 2026-10-19T03:20:35.322Z
---

## Summary

This is the protocol switch (memo §5.5 step 4; decisions 1–2). A task's verify becomes the fast hermetic gate: T0 check (typecheck and test lint), T1 whole and T2 selected by coverage. T3 runs once per merge batch (T-711, T-712) and at occasions (T-714). The Implementer never waits on a real-process run again, and a process-level regression waits at most for its batch.

## What to build

- **The task plan.** A task verify plans the check step, T1 whole, T2 selected by coverage with T-688's fallbacks (a fallback runs all of T2, never T3), and the Neovim T2 files the diff selects, with the load gate on new T1 and T2 identities. It plans no T3 or T4 file. The result says `T3: in the merge batch` with the queue's state.
- **Who still gets T3.** The Coordinator's `all`, integrated `dev` runs and occasions keep their tiers (T-714).
- **The switch.** The same change sets `[merge] queue = true` in this repository's `.cland/config.toml`, so no merge lands without a batch. Projects without the setting keep today's behaviour.
- **Evidence.** The result carries the tier lines (T-681) the Reviewer reads: a green T0–T2 result at the reviewed head plus the batch landing is the merge evidence.

## Acceptance criteria

- [x] C1. A task verify plans the check step, all T1 files and coverage-selected T2 files, and no T3 or T4 file, proved by a selection test over this repository's `tiers.json`.
  - done: impl-713 · 2026-10-19T02:48:44.806Z
  - verified: rev-31 [reviewer] · run rev-20261019-713-final · 2026-10-19T03:20:23.013Z · commit 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
- [x] C2. A T2 coverage fallback plans all T2 files and still no T3 file, proved by a selection test.
  - done: impl-713 · 2026-10-19T02:09:47.288Z
  - verified: rev-31 [reviewer] · run rev-20261019-713-final · 2026-10-19T03:20:23.014Z · commit 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
- [x] C3. The Coordinator's `all` and an occasion request still plan T3, proved by the same tests.
  - done: impl-713 · 2026-10-19T02:03:03.783Z
  - verified: rev-31 [reviewer] · run rev-20261019-713-final · 2026-10-19T03:20:23.014Z · commit 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
- [x] C4. This repository's config sets `[merge] queue = true` in the same change, and a merge after it enqueues, proved by a config test.
  - done: impl-713 · 2026-10-19T02:03:04.226Z
  - verified: rev-31 [reviewer] · run rev-20261019-713-final · 2026-10-19T03:20:23.014Z · commit 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e

## Blocked by

T-707 (the T3 scenario set) and T-708 (retired files), so that T3 is curated before task runs stop running it; T-688 (selection fallbacks).

## Comments

### impl-713 · 2026-10-19T01:59:43.935Z

C1–C4 implementation in progress: task selection caps tiers to T1/T2, package planning restores whole T1 before T2 selection, coverage fallback stays below T3, and repository merge queue is enabled. Red/green T1 planner/config/reporting tests cover the switch. Per Coordinator decision, former C5 moved to T-824 (post-merge 20-run timing measurement).

### rev-31 · 2026-10-19T02:05:27.709Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-713-source-1
commit: 41d3f22ddff704e9c063e70e4dad424ff0218e0f
scope: full
findings: [{"severity":"medium","text":"Fast T1/T2 task selection ignores effective merge.queue protection, allowing queue-disabled projects to direct-land without task or batch T3.","file":"hub/src/suite-selection.ts","line":14}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-713 source review: not clear

Head: 41d3f22ddff704e9c063e70e4dad424ff0218e0f
Fixed base: 7445a4d26d237972441a61bcd1e76392461298da
Scope: full. First review; the pre-review dev merge changes tracker material only.

## Standards

No independent finding. The new planner tests use T1 isolated filesystem inputs and the repository tier manifest; the queue/report frame tests use projectHub/FakeClock. Existing package-runner subprocess contracts retain their native seam. No new waits or process starts are introduced by the policy implementation. The source preserves tier-aware cache equality, checks capability-based legacy candidates, and carries deferred coverage as queue information rather than a passing T3 receipt.

## Spec

M1 (medium), hub/src/suite-selection.ts:14: taskSuiteSelection applies the T1/T2 cap to every tiered t/* branch without checking whether its hosting project actually uses merge batches. New/default queue=false projects can receive reduced task evidence and direct-land code without any batch T3. This contradicts the task's opt-in requirement that projects without the setting retain today's behavior and breaks the coupling between skipped process verification and mandatory batch coverage. taskTierEvidence's queue-disabled warning reports the gap but does not prevent it.

The implementing session confirmed no disposition changes that boundary in aa47e9fe. Gate the reduced plan on effective batch protection (or refuse unsafe reduced admission). Cover queue absent/false and a candidate worktree enabling queue while its hosting project remains disabled; candidate configuration alone must not promise protection that the landing hub does not provide. Preserve broader coverage in those cases.

Other reviewed behavior appears implemented: packageShards restores all manifest T1 files before filtered T2, fallback hub-only becomes full then caps T1/T2, Neovim plans retain whole T1, and new process tiers are filtered from task phases. Explicit all removes transported task tiers and Neovim subsets; dev and occasions retain broader process coverage. sameSuiteSelection already compares tiers, preventing cross-tier cache reuse. Repository queue=true is in the same task patch and the public merge-frame test reads that configuration and observes enqueueing. Result/preview reporting includes queue position and active-batch state, with no T3 pass claim.

Tests cover the intended positive plans, fallback and all/occasion behavior, but their task helper currently bypasses the missing effective-queue condition. A-5717 records host check and serial touched-file passes. Those receipts do not cover M1, so no task verification should run at this head.

Coordinator a6119505 was independently read: former C5 moved to T-824 under E-678, Coordinator-owned after T-713 is live. T-713's gate is C1–C4 plus one reviewed-head receipt; no 20-run measurement is claimed here. The running hub's bootstrap receipt may be broader until authorized reload.

Result: not clear; fail C1 for unsafe reduced admission outside effective batch protection. C2–C4 remain unverified pending corrected source and exact-head evidence. No per-item QA. No dev merge requested; correction needs fresh source review before verification.

Findings: Standards 0; Spec 1 medium.

Evidence: A-5718.

Criteria: C1 failed (Reduced task admission must require effective hosting-project batch protection; absent/false queue currently still omits T3.).

### rev-31 · 2026-10-19T02:08:57.195Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-713-source-2
commit: 4f2da956291eed66c8b92014c7bbc1eb9358fba4
scope: full
findings: [{"severity":"medium","text":"Coverage fallback preserves inherited Neovim subsets, omitting other T2 files despite C2's all-T2 requirement; existing fallback tests omit that input.","file":"hub/src/suite-selection.ts","line":198}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-713 corrected source review: not clear

Head: 4f2da956291eed66c8b92014c7bbc1eb9358fba4
Base: 7445a4d26d237972441a61bcd1e76392461298da
Comparison: 41d3f22d → reviewed head. Scope: full; no dev merge.

Standards: no independent finding. The new T1 scheduler control uses suiteUnit/FakeClock/scripted provider inputs rather than native Git or hub processes. Host check and serial selection/admission passes are recorded in A-5720.

Spec: previous M1 is addressed. Candidate selection now requires explicit queue=true. Hosting Suites admission independently removes an inherited task cap when its effective queue is absent/false and recomputes the tier plan before dry-run/cache/job creation. Controls cover absent/false/true candidate and host policies, including candidate-local opt-in without host protection. Cache matching still compares tiers.

M1 (medium), hub/src/suite-selection.ts:198: a coverage fallback for a hub source with Neovim importers can retain nvimTests while returning full mode. The task cap preserves that subset, and packageShards runs only its Neovim T2 entries alongside broad hub T2. C2 explicitly requires fallback to plan all T2 files. The new fallback test covers only selections without an inherited Neovim subset, so it misses this narrower fallback.

Implementer 0bfd2c12 confirms no disposition narrows C2 to hub T2 and will add the inherited-subset control. Clear task fallback subsets for all-T2 coverage while preserving successful hub-selected Neovim selection; retain no T3/T4 in either fast plan.

Other reviewed behavior remains as source-1: whole T1, successful selected T2, all/dev/occasion coverage, queue config and enqueue proof, honest deferred result/preview reporting. T-824 remains Coordinator-owned post-merge measurement, not a T-713 criterion.

Result: not clear; fail C2. C1/C3/C4 remain unverified pending corrected source and exact-head evidence. No verification at this head and no per-item QA.

Findings: Standards 0; Spec 1 medium.

Evidence: A-5721.

Criteria: C2 failed (Fallback with inherited nvimTests remains narrower than all T2; add the control and clear fallback subsets.).

### rev-31 · 2026-10-19T02:10:30.071Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-713-source-3
commit: ada22610cac8e023c7520b63e707ababe5ee0638
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-713 source review: clear

Head: ada22610cac8e023c7520b63e707ababe5ee0638
Fixed base: 7445a4d26d237972441a61bcd1e76392461298da
Corrections: 41d3f22d → 4f2da956 → reviewed head.
Scope: full. No dev merge after first review.

## Standards

Clear; no findings. Planner controls use isolated T1 filesystem/manifests and suiteUnit/FakeClock/scripted provider inputs; public queue/result controls use the existing in-process T2 hub seam. Existing package-runner contracts retain their process seam. No new subprocess launch, sleep or real provider/global executor fixture is introduced by the policy code.

The same admitted selection drives package planning, tier reporting and executor transport. Hosting admission recomputes the tier plan after widening. Existing sameSuiteSelection compares tiers and effective targets, so reduced and broader receipts do not share cache evidence. Explicit all removes inherited task tiers and Neovim subsets before planning. Result/preview reporting labels T3 as deferred queue evidence, including disabled/pending/active states, never as a passing T3 receipt.

## Spec

Clear; both prior findings addressed.

C1: candidate selection requires an explicit enabled queue and current tiers manifest on a task branch. The hosting hub independently requires its own effective merge queue; absent/false host policy strips an inherited task cap and recalculates planning. Candidate-local opt-in cannot promise a batch that the host does not enforce. packageShards restores every manifest T1 file into the serial free phase, then runs selected T2 only. The normal package check command remains capability-based check/typecheck as documented.

C2: full/hub-only task fallbacks remove inherited Neovim subsets and plan all T2 across both packages, never T3/T4. The corrected test includes an inherited nvimTests list; successful hub-selected coverage retains its selected Neovim T2. Neovim task plans still restore whole T1.

C3: explicit all, integrated dev and occasion paths retain their process tiers; stage/epic/release/soak and hub-owned batches retain the established occasion policy. Legacy candidates without tiers.json and queue-disabled projects preserve previous coverage.

C4: repository config enables merge.queue in this same patch. Config/default tests distinguish this repository from new projects, and the public reviewed-code merge test reads repository policy and observes enqueueing rather than direct landing. Broad host/candidate absent/false/true controls establish the opt-in boundary.

Recorded local validation: host check passes; suite-task-selection 6/6 in 0.716 s and suite-selection 96/96 in 22.073 s at the final correction, preserving successful selection/runner contracts. A-5717/A-5720/A-5722 retain earlier queue/report/config/admission checks and red-to-green controls. These support source readiness, not post-source execution.

Coordinator a6119505 independently moved former C5 to T-824, Coordinator-owned after merge. T-713's criteria are C1–C4; no 20-run timing claim is made here. The running hub predates the new protocol, so a bootstrap task receipt may be broader and must not be labeled an observed T0–T2-only run.

Result: clear source. C1–C4 remain unverified pending one exact-head task receipt. Submit one mode-free diff-selected droplet verification at this unchanged head; no full-run request and no per-item QA. Any head change needs fresh source review.

Findings: Standards 0; Spec 0.

Evidence: A-5723.

### rev-31 · 2026-10-19T02:43:39.421Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261019-713-runtime-1
commit: ada22610cac8e023c7520b63e707ababe5ee0638
scope: evidence
findings: [{"severity":"medium","text":"Two renamed package admission identities exceed the hard 5 s new-test budget at 5.044/5.127 s; assertions and gates pass but run exits 1.","file":"hub/test/suite-selection.test.ts","line":326},{"severity":"medium","text":"New T1 repository-plan and all/occasion controls exceed 0.5 s at 0.672/0.581 s; no explicit disposition supplied.","file":"hub/test/suite-task-selection.test.ts","line":29},{"severity":"medium","text":"Receipt reports +2.760 s T3 ratchet growth without a supplied allowance or explicit disposition; account for owned process identity changes.","file":"hub/test/suite-selection.test.ts","line":326}]
finding_counts: {"high":0,"medium":3,"low":0}

# T-713 bootstrap runtime review: not clear

Head: ada22610cac8e023c7520b63e707ababe5ee0638, unchanged from source-3 / A-5723.
Run: 2bdedf03-9534-4132-9a45-ddf001905d74 / A-5732, raw exit 1.
Scope: evidence. Task receipt and branch tip match.

## Standards

M1 (medium), hub/test/suite-selection.test.ts:326: two task-renamed integrated package-admission cases exceed the legacy hard new-identity budget: hub-only 5.043722821 s and nvim-only 5.126936611 s >5 s. These are the only hard failures (A-5732:57135–57136). Both ordinary assertions and 5/5 gates pass. Preserve both CLI spellings, transported-selection override and lock assertions while reducing duplicated process work; Implementer e4e84a9a is removing the duplicated cross-product and will request fresh source review.

M2 (medium), hub/test/suite-task-selection.test.ts:29,53: the new T1 repository-plan and all/occasion controls measure 0.671611373 s and 0.581446025 s against 0.5 s. Full log lines 57170/57173 retain these owned report-only overages, omitted from the ten-line capped result. Optimize their fixture/planner work or obtain explicit Coordinator disposition; a passing assertion does not establish that exception.

M3 (medium), hub/test/suite-selection.test.ts:326: the receipt reports T3 growth, 2654.261 s versus base 2651.501 s (+2.760 s), with incomplete timings separately disclosed. No explicit growth disposition/allowance was supplied. Account for the owned renamed process work under docs/agents/tests.md's ratchet; reduction or an authorized disposition may resolve it. Do not confuse this report-only diagnostic with the hard exit cause.

## Spec evidence

All assertions completed green. The six repository planner/scheduler controls pass ordinarily and 5/5, covering selected whole T1/T2, fallback with an inherited Neovim subset, Neovim whole-T1 preservation, all/dev/occasions, queue-disabled behavior, and candidate-local versus effective-host queue policy. Config/queue/report controls and all 96 suite-selection cases pass. Tier-report, init-config, merge-queue and suite-protocol files have no ordinary failures. The only three runtime tier mismatches are external suite-close-component identities already tracked as T-803.

This bootstrap receipt is broad full coverage under the pre-switch hosting hub, as disclosed before execution. It is not an observed T0–T2-only live task run. Ordinary hub result: 2383 tests, 2378 pass, 0 fail/cancelled/TODO, 5 existing platform/binary skips. Two shard failure arrays are empty. Neovim does not run because the hub hard budget gate exits 1. The completed-before-interruption count includes repetitions and is not the ordinary total.

Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 1858 s, cost $0.1291, peak load 8.19. A-5732 retains all measurements and diagnostics.

Result: not clear; fail C1 on owned execution-budget readiness, leave C2–C4 unverified. No unchanged-head retry. Corrections need fresh source review; obtain decisions through lead T-713. No per-item QA. T-824 remains the post-merge 20-run measurement.

Findings: Standards 3 medium; Spec 0 assertion failures.

Evidence: A-5733.

Criteria: C1 failed (Bootstrap verification exits 1 on owned runner-contract budgets; two T1 overages and T3 growth also require correction/disposition.).

### rev-31 · 2026-10-19T02:49:28.092Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-713-source-4
commit: 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-713 runtime correction source review: clear

Head: 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
Fixed base: 7445a4d26d237972441a61bcd1e76392461298da
Correction comparison: ada22610 → reviewed head.
Scope: full. No dev merge after first review.

Standards: clear; no source finding remains. This correction changes only suite-selection.test.ts and suite-task-selection.test.ts. The process contract pairs hub-only/--all with nvim-only/all, retaining both native CLI spellings and transported task/explicit-target override proof without repeating their identical full-package cross-product. Existing reduced-run lock/token/smoke assertions remain. Full execution is now checked by an exact complete file-set comparison, strengthening the former two membership checks.

Five pure planner cases reuse a file-owned immutable isolated repository. Deduplicated directory creation and bounded synchronous empty-file writes finish before the shared cleanup boundary. The fixtures retain every real repository manifest path and all prior selection variants; only the separate host-policy control mutates its own suiteUnit fixture. No product policy, assertion meaning, tier, timing baseline or allowance is changed.

Spec: source-3 / A-5723's effective host/candidate queue protection, whole T1, selected T2, all-T2 fallback, all/dev/occasion behavior, cache separation, reporting and repository enqueue configuration remain unchanged. C1–C4's behavior assertions are retained.

A-5734 records the complete prior Linux audit, including both T1 overages and +2.760 s T3 growth, and explicitly labels the replacement arithmetic as a host-only projection. Current host runner cases measure 1.813/1.807 s, with first/all-occasion planner cases 0.121/0.073 s. Full files report 96/96 in 19.684 s and 6/6 in 0.482 s; host check passes. Projected T3 falls below the pinned base, but that is not a new Linux receipt or an exception.

Result: clear source for one replacement mode-free exact-head droplet verification. C1–C4 remain unverified until that run settles the legacy hard budget, T1 per-test budgets and actual T3 ratchet. A failed/new over-budget receipt is not final clear. No per-item QA. The pre-switch host may still admit a broad bootstrap plan; do not claim a live narrow task observation. T-824 remains the Coordinator's post-merge measurement.

Findings: Standards 0; Spec 0.

Evidence: A-5735.

### rev-31 · 2026-10-19T03:20:23.014Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261019-713-final
commit: 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

# T-713 final evidence review: clear

Head: 9ee3671dcd0c69ace4c8f2fec1bf0ba80da6022e, unchanged from source-4 / A-5735.
Run: 3e377f81-4330-4b1a-a742-7e01b0148eae / A-5740, raw exit 0, broad bootstrap full plan.
Scope: evidence. Branch tip and task receipt independently match; C1–C4 are claimant-done.

## Standards

Clear; no remaining findings. The two formerly hard-failing integrated package-contract cases now pass in 2.701398968 s and 2.988668546 s, below the legacy 5 s gate. The six T1 task-planner cases each fit 0.5 s: 0.369, 0.204, 0.024, 0.256, 0.107 and 0.231 s. Their file totals 1.191241474 test-seconds. The actual Linux T3 ratchet is 2649.014 s versus base 2651.501 s, below base; the host-only projection was not substituted for this receipt. No allowance or timing-baseline change was needed.

All seven relevant complete test files pass (141 ordinary cases), and all 33 observed relevant load-gate identities pass 5/5. No owned hard budget, report-only per-test/file overage, runtime tier mismatch or quarantine outcome appears. The only three tier mismatches are known external T-803 suite-close-component identities. Other external report-only budget debt remains disclosed in A-5740; this verdict makes no global zero-debt claim.

## Spec

Clear; verify C1–C4:
- C1: exact repository-manifest planner control passes ordinarily and 5/5, proving the check command, whole T1 and selected T2 without T3/T4. Effective queue controls cover absent/false candidate/host protection and candidate-local opt-in.
- C2: fallback-with-inherited-Neovim-subset control passes ordinarily and 5/5, proving all T2 across both packages and no T3/T4; the successful selected-coverage contract remains green.
- C3: integrated/all/occasion planner control passes ordinarily and 5/5; both actual runner CLI spellings pass complete-file-set/transport override assertions and 5/5 repetitions.
- C4: repository queue/default config control and all seven public merge-queue tests pass, observing reviewed code enqueueing under the repository policy. Task result/preview deferred-T3 reporting controls also pass.

The package admission cap remains coupled to both candidate opt-in and effective hosting-hub batch protection, with widened plans recomputed before cache matching. Existing tier-aware cache separation and legacy behavior remain source-reviewed and unchanged.

Bootstrap limitation: the running host predates this protocol and admitted full coverage. A-5740 positively completes both hub phases and Neovim, but is not an observation of a live T0–T2-only task run after reload. The controlled candidate policy tests establish the task criteria. Former C5's 20-run timing measurement belongs to Coordinator-owned T-824 after merge, per a6119505; no timing improvement or completed batch landing is claimed here.

Ordinary overall result: 2762 tests, 2754 pass, zero fail/cancelled/TODO, eight existing platform/binary skips (the idle-sleep skip retains its generic raw reason). All three shard failure arrays are empty. Hub free 158.00 s, hub machine 1189.47 s, Neovim 339.17 s; suite 1686.66 s. Linux x64 c-8 lon1, workers 2, Node 24.21.0, Neovim 0.12.5; lifetime 1768 s, cost $0.1228, peak load 7.55.

Final clear; C1–C4 verified. No additional task run or per-item QA required. T-824 remains outstanding post-merge work.

Findings: Standards 0; Spec 0.

Evidence: A-5742.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-10-19T03:20:35.322Z

Merged 2b0f3345854be6efdf30b89298075dbd5d7b80fe onto dev.
