---
id: T-717
kind: task
title: "[verification] gains per-tier test commands, so any project's task runs, merge batches and soaks follow the tier model"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - v0.1.4
  - verification
  - hub
assignee: null
parent: E-678
blocked_by:
  - T-713
  - T-715
  - T-664
  - T-665
  - T-666
topic: topic-602
branch: t/T-717-verification-gains-per-tier-test
created: 2026-10-16T19:59:44.369Z
updated: 2026-10-19T20:10:39.786Z
---

## Summary

The tier model is cland's product rule, not this repository's file lists (memo §5.6). E-614 gives `[verification]` the `prepare`, `check` and `test` commands (T-664, T-666). This ticket adds the per-tier commands, so a Python or web project gets the same rhythm: unit and component tests per task, integration in merge batches, soak at occasions and nightly. That is how the v0.2 web workbench adds Playwright scenarios without adding a minute to the task gate.

## What to build

- **The keys.** `[verification]` gains `test_unit`, `test_component`, `test_integration` and `test_soak` (command strings, empty means unset), plus `[merge] batch` and `batch_wait`, written by the template with one comment line each and settable through `cland config set`.
- **The plan.** Task runs execute `check`, `test_unit` and `test_component`; merge batches execute `test_unit` and `test_integration`; occasions and the nightly soak execute all four. Each tier's exit, duration and output tail are reported as a tier line.
- **Fallback.** A project with only `test` set keeps E-614's behaviour (the whole `test` per task, no batch tier split), and `[merge] queue` defaults to `false` for it.
- **This repository** sets the four commands to its own runner's tiers (`node hub/test/run-suite.ts --tier T1` and so on), so cland verifies itself through the same keys.
- **Docs.** `docs/agents/tests.md` and `hub/README.md` describe the keys; the onboarding's stack rule (spec v0.1.4 §3.4) records them when the stack has tiers.

## Acceptance criteria

- [x] C1. A fixture project with a Python `test_unit` and `test_integration` runs only `check` and `test_unit` in a task verify and `test_unit` plus `test_integration` in its merge batch, proved by a suite test with the command stubs from T-665.
  - verified: rev-30 [reviewer] · run rev-20261019-717-final · 2026-10-19T17:21:34.517Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-final · 2026-10-19T19:37:21.957Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - done: impl-717 · 2026-10-19T20:00:44.480Z
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integrated-final · 2026-10-19T20:01:17.308Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
- [x] C2. A project with only `test` set runs it whole per task with `[merge] queue` off, proved by a suite test.
  - verified: rev-30 [reviewer] · run rev-20261019-717-final · 2026-10-19T17:21:34.517Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-final · 2026-10-19T19:37:21.957Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - done: impl-717 · 2026-10-19T20:00:45.374Z
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integrated-final · 2026-10-19T20:01:17.308Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
- [x] C3. `cland init` writes the four keys empty with their comment lines, and `cland config set verification.test_unit '<cmd>'` stores the command verbatim, proved by init and config tests.
  - verified: rev-30 [reviewer] · run rev-20261019-717-final · 2026-10-19T17:21:34.518Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-final · 2026-10-19T19:37:21.957Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - done: impl-717 · 2026-10-19T20:00:47.005Z
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integrated-final · 2026-10-19T20:01:17.308Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
- [x] C4. This repository's config names its four tier commands, and a task verify at the merge head plans the same files as before the change, proved by a planning test.
  - verified: rev-30 [reviewer] · run rev-20261019-717-final · 2026-10-19T17:21:34.518Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-final · 2026-10-19T19:37:21.957Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - done: impl-717 · 2026-10-19T20:00:47.656Z
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integrated-final · 2026-10-19T20:01:17.308Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
- [x] C5. `docs/agents/tests.md` and `hub/README.md` describe the per-tier commands and the batch settings.
  - verified: rev-30 [reviewer] · run rev-20261019-717-source-corrected · 2026-10-19T16:29:09.242Z · commit bebb22657d665133cf850547a7ae369642f7673b
  - verified: rev-30 [reviewer] · run rev-20261019-717-budget-source · 2026-10-19T16:58:47.485Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-final · 2026-10-19T17:21:34.518Z · commit cb8c28db5f98ad4570438dd073fbfae04ae21995
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-source · 2026-10-19T19:21:26.667Z · commit 4554ceeb7f7c7cabb6a4ef44729dc4cf8e223b4b
  - verified: rev-30 [reviewer] · run rev-20261019-717-revised-shared-fixture-source · 2026-10-19T19:25:17.470Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - verified: rev-30 [reviewer] · run rev-20261019-717-tier-composition-final · 2026-10-19T19:37:21.957Z · commit 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integration-source · 2026-10-19T19:47:14.251Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
  - done: impl-717 · 2026-10-19T20:00:48.415Z
  - verified: rev-30 [reviewer] · run rev-20261019-717-periodic-search-integrated-final · 2026-10-19T20:01:17.308Z · commit 1a07ce958a4b0f87b3bf99960fae0371068a96c2
  - verified: rev-30 [reviewer] · run rev-20261019-717-landed-proof-integration-source · 2026-10-19T20:10:39.786Z · commit 434877d326a1f4ac062a970bac9e7c6dfe8d861d

## Blocked by

T-664 and T-666 (E-614's `[verification]` commands), T-665 (fixture command stubs).

## Comments

### impl-717 · 2026-10-19T14:52:10.328Z

Config slice implemented: four empty command keys with tier comments, batch/batch_wait comments, parser validation and config CLI coverage. Next: recorded per-tier plan/execution after T-666 lands; acceptance seams are init/config, suite command stubs and repository package planning.

### impl-717 · 2026-10-19T16:21:49.083Z

Merged origin/dev including T-666 at 0d937bfe. Completed per-tier admission plans, cache identity, local/remote workers and host-gate handling; pinned demo plans; repository tier commands; arbitrary-stack occasions. Python command-stub test now executes real task and hub-owned batch admission through Suites and confirms check+unit vs unit+integration. Remote recorded-command/failure/tail regression passes; full executor-run file 15/15 at 73.08s. Final touched-file checks running serially before source review.

### rev-30 · 2026-10-19T16:27:05.187Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-717-source
commit: 3960b7af1c380f692ca7238a18f0c19f1cd8eeef
scope: full
findings: [{"severity":"medium","text":"M1: A candidate explicitly configured with only test still inherits every tier from the hosting root. If root has test_unit/test_component and the candidate sets test='sh legacy-test.sh' with no tiers, the resolver returns both test and inherited tiers; pinVerificationPlan then executes the tiers and never the candidate's whole test. This breaks the promised legacy-only fallback and can run new --tier flags against an older worktree runner. Preserve an explicit candidate whole-test configuration before opting into root tier defaults; cover root-tier/candidate-legacy resolution and the resulting plan.","file":"hub/src/verification-commands.ts","line":22}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear: A-6214. Standards no separate findings. Spec M1: root tier fallback overrides an explicitly configured candidate whole-test mode; preserve legacy-only candidate execution and add a resolver/plan control. Remaining C1/C3/C4/C5 unverified; fresh source review before mode-free verify.

Criteria: C2 failed (Explicit legacy-only candidate test is suppressed by tier commands inherited from the upgraded hub root.).

### rev-30 · 2026-10-19T16:29:09.242Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-source-corrected
commit: bebb22657d665133cf850547a7ae369642f7673b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear, no findings. A-6217 resolves M1 with four T1 resolver/plan controls (red 10/11 -> green 11/11) and preserves empty-command root fallback. C5 documentation source-verified; C1–C4 await normal exact-head task gate plus qualified host evidence A-6207/A-6216. No full task run requested; Linux T3 remains landing evidence.

Criteria: C5 verified.

### impl-717 · 2026-10-19T16:49:54.902Z

Mode-free exact-head verification 484666f9 / A-6250 passed at bebb2265: 1590 ordinary tests, zero fail/cancel/skip/TODO; all 510 load-gate groups 5/5; zero load failures. Linux c-8 lon1, lifetime 1161s, cost $0.0806. Four report-only tier mismatch rows are in unchanged skills-onboarding push proof (blob identical to d82a768a); Coordinator confirms queued T-877 fixes them. All claimant done marks refreshed. Head and clean tree retained; Reviewer has evidence for final verdict. T3 remains merge-batch evidence.

### rev-30 · 2026-10-19T16:50:55.114Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-717-runtime
commit: bebb22657d665133cf850547a7ae369642f7673b
scope: evidence
findings: [{"severity":"medium","text":"M2: The new per-tier file-plan equivalence T1 case takes 1.008405081 s in A-6250:38167 and 1.0008–1.1435 s in every load repetition, above T1's .5 s budget; report-only violations are at :62538/:62646. Preserve real plan equivalence with smaller/reused manifest/planning setup.","file":"hub/test/suite-task-selection.test.ts","line":51},{"severity":"medium","text":"M3: The expanded literal-command T2 case takes 2.570383802 s in A-6250:47032 and 2.3146–2.5538 s in all five repetitions, above T2's 2 s budget; explicit report-only violations are at :62536/:62644. Keep one CLI boundary proof and cover command-key permutations at a lower-cost seam without dropping literal-value assertions.","file":"hub/test/config-set.test.ts","line":21}]
finding_counts: {"high":0,"medium":2,"low":0}

Runtime not clear: A-6254. Functional A-6250 is 1590/1590, 510 groups 5/5, but raw ordinary and every repetition exceed tier budgets for new T1 planning and expanded T2 config literal proof. M1 precedence remains resolved; C5 source verification retained. Revise test seams and request fresh source review before another mode-free gate.

Criteria: C3 failed (Expanded config command-key CLI case exceeds 2 s ordinarily and in all five repetitions.), C4 failed (New T1 file-plan equivalence case exceeds .5 s ordinarily and in all five repetitions.).

### rev-30 · 2026-10-19T16:58:47.485Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-budget-source
commit: cb8c28db5f98ad4570438dd073fbfae04ae21995
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at corrected head; A-6262. M2 repository inventory equivalence moves to existing T0, while small T1 actual flag/plan/lock comparisons remain. M3 retains CLI literal framing and all ten permutations through the public T1 settings writer. Raw 8+10+8 full-file tests and five host repetitions audited; no assertion/allowance/tier changes. C5 reverified; C1–C4 await replacement exact-head mode-free evidence and owned runtime costs. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6262-t-717-source-review-of-owned-budget-corrections-at-cb8c28db.md

Criteria: C5 verified.

### rev-30 · 2026-10-19T17:21:34.518Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-final
commit: cb8c28db5f98ad4570438dd073fbfae04ae21995
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6282. A-6281 ordinary 1591/1591 and 511 groups 5/5. Revised planner .080s ordinary/.313–.378s repetitions, CLI .668s/.548–.712s, writer .028s/.025–.031s meet tiers. Current resolver/admission/template tests plus retained qualified A-6207/A-6216 Python/legacy native host evidence establish C1–C4; C5 source retained. M1–M3 resolved. Inherited T-856/T-877 exception retained; Linux T3 deferred to landing. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6282-t-717-final-per-tier-command-evidence-at-cb8c28db.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-717 · 2026-10-19T17:22:02.722Z

Ready at cb8c28db. Reviewer final clear rev-20261019-717-final/A-6282 verifies C1–C5; hub status ready confirmed. Replacement mode-free aba24ff0/A-6281 passed 1591 tests and 511 groups 5/5. Corrected planner/CLI/writer ordinary and all five repetitions satisfy .5s/2s/.5s budgets; no owned T1/T2 budget warnings. Linux c-8 lon1, 1200s, $0.0833. Claimant done marks refreshed, head clean/pushed, ready reported to Coordinator as requested. Claim retained until merge; T3 remains merge-batch evidence.

### impl-717 · 2026-10-19T19:19:19.887Z

Resolved merge-conflict drop with Coordinator-authorized one origin/dev merge through 0420324e, merge commit 647fc3a1. New head 4554ceeb composes recorded tier commands with T-886's admitted batch/periodic selection; T1-only batches, default T1/T3, mixed T2/T4 and dev-t3 controls pass. Landed configuration and cleanup behavior retained. 145 tests across 15 serial affected files and npm run check/typecheck pass; fresh-fetch merge-tree clear; pushed/clean. Delta source review requested with A-6379. Prior cb8c28db gate/final verdict historical pending fresh exact-head verification.

### rev-30 · 2026-10-19T19:21:26.667Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-tier-composition-source
commit: 4554ceeb7f7c7cabb6a4ef44729dc4cf8e223b4b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6386 Source integration/composition clear: original patch preserved with landed config fields; selected tiers now drive pinned commands, T1/defaultT1T3/T2T4/devT3 public admission matrix red→green(.019s), 145/145 retained host tests audited. Docs/root/template/onboarding distinguish configured batches and periodicT3, C5verified. C1–C4 await exact-head gate; inheritedT891 requires shared disposition before run and new-head delta review if picked. Prior runtime historical.

Criteria: C5 verified.

### rev-30 · 2026-10-19T19:25:17.470Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-revised-shared-fixture-source
commit: 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6403 Source clear at final cumulative shared-fix head. Only verify-tool+7/-1 from4554ceeb; exact finalT891 fixture blob, assertions preserved, Coordinatorce1919c6 authorization. Combined integration source basisA-6386 unchanged. C5verified;Runtime C1–C4 pending new exact-head mode-free gate.

Criteria: C5 verified.

### impl-717 · 2026-10-19T19:34:48.484Z

Exact reviewed head 9d9e2314 passes mode-free 956d316d/A-6425: 1628 ordinary tests, 41 load groups all5/5, no tier mismatches; Linux c-8 lon1 377s $0.0262. Named planner/writer/composition/verify-tool costs satisfy budgets. CLI .497s ordinary; no repeat group in this run. Full raw audit A-6430 flags existing whole-manifest planner case .501467713s vs .5s, omitted from capped summary; reported as shared-defect candidate to lead T-717 and Reviewer, holding diagnosis/head pending disposition. Claimant done marks refreshed; final runtime verdict pending.

### rev-30 · 2026-10-19T19:37:21.957Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-tier-composition-final
commit: 9d9e23143ce60e3ed104398b90b9d8bc7cf300ce
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-6439 Exact-headA6425/956d316d final clear:1628/1628,0fail/cancel/skip/TODO,41groups5/5/noresource. New planner/writer/composition controls meet budgets; nativeC1/C2 rawA6379 source-identical Python/taskbatch4.161s+legacy3.170s qualify separately. Existing whole-manifest case.501467713s is disclosed; workload/assertions unchanged by fixture extraction and priorA5978.514s, reportedTechdebtS (not waived/claimedinbudget). AllC1–C5verified; no taskT3claim.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-717 · 2026-10-19T19:37:41.859Z

Ready confirmed at 9d9e2314: C1–C5 current/verified, final clear rev-20261019-717-tier-composition-final/A-6439. Exact-head mode-free 956d316d/A-6425 passes1628/1628, all41groups5/5. Existing whole-manifest .501s budget debt disclosed separately with prior .514s evidence; owned new costs within budget. Linux c-8 lon1 lifetime377s cost$0.0262. Clean pushed head retained; ready reported to Coordinator for re-enqueue, claim kept until merge.

### impl-717 · 2026-10-19T19:45:11.639Z

Queue conflict after T-887 resolved with Coordinator-authorized one merge of dev3147e92f. New pushed/clean head1a07ce95 combines devT3Probe diagnostic selection/cache exclusion with T-717 tier admission/full recorded-command equality. Typecheck and90/90 tests across7 affected files pass; fresh-fetch merge-tree clear. Delta review requested with A-6475 (combined resolution + raw targeted receipts); prior final/gate9d9e2314 historical pending replacement exact-head review/verify.

### rev-30 · 2026-10-19T19:47:14.251Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-periodic-search-integration-source
commit: 1a07ce958a4b0f87b3bf99960fae0371068a96c2
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear A-6493. Independent full task-patch comparison retains all24owned file patches, only suites cache hunk additionally excludes devT3Probe as expected. Two conflicts correctly compose arbitrary-stack tier admission with periodic probe file selection, and full recorded-command cache identity with exclusion of diagnostic/probe receipts. Actual selection remains pinned before commands. Retained A-6475 raw7files90/90 pass, no fail/cancel/skip/TODO, functional local proof only. C5verified; C1–C4/new-head final gate pending. PriorA6439historical, existing cadence debt disposition retained, no allowance/tier change; QA none.

Criteria: C5 verified.

### impl-717 · 2026-10-19T20:00:54.860Z

Replacement exact-head mode-free99c52314/A-6527 at1a07ce95 passes1657/1657 and72loadgroups all5/5; zero tier mismatches. Raw audit A-6531 confirms owned new planner/writer/composition costs within budget; CLI .542s ordinary. All13 report-only case overruns exact-name matched to T-883/T-904, no duplicate aside per Coordinator. Linux c-8 lon1 lifetime414s cost$0.0287. All claimant done marks refreshed; final Reviewer evidence settlement pending, head unchanged.

### rev-30 · 2026-10-19T20:01:17.308Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-periodic-search-integrated-final
commit: 1a07ce958a4b0f87b3bf99960fae0371068a96c2
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Current-head evidence clear, A-6537. Independently audited exact-head A-6527/99c52314: 1657/1657, zero fail/cancel/skip/TODO, all 72 load groups 5/5, no tier/resource mismatch or new owned budget trip. Planner/writer/composition ordinary and five repetitions within T1 budget; CLI literal control within T2 budget (no repeat claim for known identity). Source delta A-6493 plus retained local native Python/legacy proofs A-6379 and current affected-file 90/90 A-6475 settle composition and unchanged assertions. All C1–C5 verified. Existing whole-manifest overrun remains T-904 disposition. Linux T3 periodic/integrated; QA none.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-717 · 2026-10-19T20:01:33.309Z

Ready confirmed at1a07ce95 with C1–C5 current/verified and Reviewer final clear rev-20261019-717-periodic-search-integrated-final/A-6537. Exact-head mode-free99c52314/A-6527 passes1657/1657,72groups5/5; owned new costs in budget. Existing report-only rows covered T-883/T-904. Linux c-8 lon1 lifetime414s cost$0.0287. Clean head matches origin; Coordinator notified for re-enqueue; claim retained until merge.

### impl-717 · 2026-10-19T20:09:20.487Z

Third queue-conflict integration: merged devd801ec69 once per Coordinator872b4185. Head434877d3 keeps both import lists; T-885 landed proofs, T-887 periodic search and T-717 tier admission/cache identity retained. Typecheck +79/79 across7 serial affected files pass, fresh-fetch merge-tree clear, pushed/clean. Delta review requested A-6563; replacement mode-free gate follows source clear. T-667 and T-717 must land in separate batches as Coordinator directed.

### rev-30 · 2026-10-19T20:10:39.786Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-717-landed-proof-integration-source
commit: 434877d326a1f4ac062a970bac9e7c6dfe8d861d
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear, A-6570. Import resolution retains both per-tier planning and landed load-proof helpers. Independent ordered patch comparison confirms all 24 task-owned patches unchanged relative to new dev; T-885 landed proof flow, T-887 probe handling and T-717 command admission/cache identity coexist. Raw A-6563 seven serial files 79/79, zero fail/cancel/skip/TODO. C5 verified; C1–C4 await fresh exact-head mode-free overall green. Native host proofs retained, Linux T3 periodic/integrated; QA none.

Criteria: C5 verified.
