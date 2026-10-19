---
id: T-713
kind: task
title: Task verify runs T0, T1 and selected T2, and T3 runs only in merge batches and occasions
state: open
status: review
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
updated: 2026-10-19T02:10:30.071Z
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
  - done: impl-713 · 2026-10-19T02:07:35.256Z
- [x] C2. A T2 coverage fallback plans all T2 files and still no T3 file, proved by a selection test.
  - done: impl-713 · 2026-10-19T02:09:47.288Z
- [x] C3. The Coordinator's `all` and an occasion request still plan T3, proved by the same tests.
  - done: impl-713 · 2026-10-19T02:03:03.783Z
- [x] C4. This repository's config sets `[merge] queue = true` in the same change, and a merge after it enqueues, proved by a config test.
  - done: impl-713 · 2026-10-19T02:03:04.226Z

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
