---
id: T-886
kind: task
title: Merge batches run only their configured tiers, and T3 runs on dev every two hours and gates the release
state: open
status: ready
size: M
criterion_seq: 4
labels:
  - v0.1.4
assignee: null
parent: C-216
blocked_by: []
topic: topic-621
branch: t/T-886-merge-batches-run-only-their-configured
created: 2026-10-19T16:17:30.236Z
updated: 2026-10-19T17:59:09.666Z
---

## Summary

D67 (the human, 2026-10-19 16:16Z): a merge batch runs only T1 (about 2 minutes) and lands. T3 runs on dev every 2 hours, in the nightly soak and as the release gate. Today a batch runs T1+T3 for about 20 minutes and catches about one real defect in 50 merges (A-6112), and the merge queue backs up behind it. This ticket makes the batch tiers and the periodic dev T3 run configurable and sets them for this repository. T-887 adds the culprit search for a red periodic run.

## What to build

- `[merge] batch_tiers` (default `["T1", "T3"]`, today's behaviour) selects the tiers a merge batch runs. This repository sets `["T1"]`.
- `[verification] dev_t3_every` (default `""`, off) schedules a T3 run on dev's head when that interval has passed since the last periodic T3 run started and dev has moved since then. This repository sets `"2h"`. The run is an ordinary hub-owned occasion (`dev-t3`) on one droplet, under the shared remote budget and daily cap, and never holds or rebuilds a merge batch.
- The release gate: `cland release` (and its dry run) refuses unless a green T3 (periodic, soak, stage or release occasion) covers the release head's tree, naming the run it would need.
- The result of a periodic run is posted to the Coordinator in General: the head, the merges since the previous green periodic run, and green or red with the failing files.

## Acceptance criteria

- [x] C1. With `[merge] batch_tiers = ["T1"]`, a merge batch plans and runs T1 only and lands on green; with the setting absent it plans T1+T3 as today (T1 tests over batch planning).
  - verified: rev-30 [reviewer] · run rev-20261019-886-final · 2026-10-19T17:27:03.132Z · commit 2ecec97363badccbb3958cda17ebd099fbaa9268
  - done: impl-886 · 2026-10-19T17:58:16.541Z
  - verified: rev-30 [reviewer] · run rev-20261019-886-d68-integration-final · 2026-10-19T17:59:07.653Z · commit 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
- [x] C2. With `dev_t3_every = "2h"`, a clock-driven hub starts one `dev-t3` run on dev's head after two hours when dev moved, starts none when dev did not move, and never starts a second while one runs (T1 or T2 test with a fake clock and executor).
  - verified: rev-30 [reviewer] · run rev-20261019-886-final · 2026-10-19T17:27:03.132Z · commit 2ecec97363badccbb3958cda17ebd099fbaa9268
  - done: impl-886 · 2026-10-19T17:58:17.051Z
  - verified: rev-30 [reviewer] · run rev-20261019-886-d68-integration-final · 2026-10-19T17:59:07.653Z · commit 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
- [x] C3. `cland release --dry-run` refuses when no green T3 covers the release head's tree, naming the missing run, and passes when one does (T2 test).
  - verified: rev-30 [reviewer] · run rev-20261019-886-final · 2026-10-19T17:27:03.133Z · commit 2ecec97363badccbb3958cda17ebd099fbaa9268
  - done: impl-886 · 2026-10-19T17:58:17.641Z
  - verified: rev-30 [reviewer] · run rev-20261019-886-d68-integration-final · 2026-10-19T17:59:07.653Z · commit 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
- [x] C4. This repository's `.cland/config.toml` sets `batch_tiers = ["T1"]` and `dev_t3_every = "2h"`, and docs/agents/tests.md describes batch tiers, the periodic dev T3 run and the release gate. (T1: the repository-config regression in init-config.test.ts; T0: config and docs inspection.)
  - verified: rev-30 [reviewer] · run rev-20261019-886-source-final · 2026-10-19T16:44:07.533Z · commit 265ded939070a863125a50513e94a6d0cbb8f606
  - verified: rev-30 [reviewer] · run rev-20261019-886-reporting-source · 2026-10-19T17:06:38.797Z · commit 2ecec97363badccbb3958cda17ebd099fbaa9268
  - verified: rev-30 [reviewer] · run rev-20261019-886-final · 2026-10-19T17:27:03.133Z · commit 2ecec97363badccbb3958cda17ebd099fbaa9268
  - verified: rev-30 [reviewer] · run rev-20261019-886-d68-integration-source · 2026-10-19T17:36:10.199Z · commit 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
  - done: impl-886 · 2026-10-19T17:58:18.220Z
  - verified: rev-30 [reviewer] · run rev-20261019-886-d68-integration-final · 2026-10-19T17:59:07.653Z · commit 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd

## Comments

### impl-886 · 2026-10-19T16:25:25.305Z

Implementation uses existing occasion planner and Suites scheduler. Added T1 batch selection/landing and fake-clock periodic scheduling proofs; T2 release dry-run gate and hub-owned periodic result publication. Periodic job pins previousGreenHead/previousGreenRun, and verification-dev-t3-result carries head/tree, merges, result, failingFiles and durable log references for T-887. Targeted verification and docs in progress.

### rev-30 · 2026-10-19T16:34:35.476Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-886-source
commit: 0310f6e9780ee1c95697277698b37d5fd4a19909
scope: full
findings: [{"severity":"high","text":"H1: The gate passes Git's raw dev^{tree} into releaseT3Cover, but real SuiteJob.tree is candidateTree/committedTree with .cland/tasks and .cland/RULES.md removed. Any committed tracker/rulebook content makes these hashes differ, so a genuine green periodic/stage/release receipt cannot unlock release or dry-run. The new fixture seeds the raw hash and masks this mismatch. Use a shared verified tree identity and prove a produced receipt unlocks release with committed metadata present.","file":"hub/src/territory-release.ts","line":172},{"severity":"medium","text":"M1: New T2 coverage invokes preparedReleaseProject (native Git setup), release-support.git/execFileSync and releaseCover's native Git, and selects nativeProjectHub, explicitly the T3 native-probe seam. T2 permits a subprocess only for the cland CLI itself; these direct Git/probe subprocesses exceed that boundary. Keep T2 policy/CLI proof over injected facts and retain the native receipt-to-release contract at an allowed seam/tier without weakening assertions.","file":"hub/test/release-t3-component.test.ts","line":10},{"severity":"medium","text":"M2: The optional merge-range Git lookup can reject on timeout/spawn/I/O failure (gitIn's documented contract). That rejection escapes Dispatcher reporting before General publication; the job remains unreported and #checkDevT3 refuses future periodic runs. Represent unavailable range as merges:null while still publishing the pinned outcome/artifact, and add a rejecting-Git publication/no-stall control.","file":"hub/src/hub/dev-t3-result.ts","line":17}]
finding_counts: {"high":1,"medium":2,"low":0}

Source not clear: A-6225. H1 real verification tree identity cannot match raw release tree; M1 new T2 native Git/probe boundary; M2 optional range lookup rejection blocks completed result publication and future periodic scheduling. Correct all with retained/injected controls and fresh source review before verification.

Criteria: C3 failed (Release gate compares raw Git tree to metadata-filtered verification trees; its new T2 test also runs native Git/probes outside the allowed boundary.), C2 failed (Rejected optional merge-range Git lookup prevents General publication, leaving the job unreported and blocking subsequent periodic runs.).

### impl-886 · 2026-10-19T16:38:03.618Z

Source review A-6225 fixes: releaseGit now uses committedTree, matching actual verification receipts and excluding tracker/rulebook metadata; a native T3 regression covers genuine receipt -> release, metadata-only equal builds and wrong builds. C3 T2 now uses projectHub fake probes, fake territory lock and an injected publication boundary; only the release CLI itself starts as a child. Rejected optional periodic Git range lookup becomes merges:null; the T2 regression observes the red General result and the following periodic run. Fresh targeted checks running, then new review before verify.

### rev-30 · 2026-10-19T16:42:01.443Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-886-source-corrected
commit: b66ea42edcd9436503412d04887ebe10de5d1882
scope: full
findings: [{"severity":"medium","text":"M3: The new unavailable-range/no-stall T2 proof takes 6.188535792 s as a test body in retained A-6234 (isolated 4.237290833 s in A-6232), above the 2 s T2 boundary and the whole-file run's 5 s legacy new-test gate. Preserve publication/next-run assertions at a smaller scheduler/reporting fixture rather than three full provisioning cycles.","file":"hub/test/suite-soak-component.test.ts","line":243},{"severity":"medium","text":"M4: Two new T1 periodic controls also exceed their 0.5 s tier boundary in A-6234: restart/no-overlap .796156958 s and pinned-range result .852709083 s. Retain the fake-clock/persistence/range assertions with a smaller receipt-based fixture; these are new owned cases, not inherited exceptions.","file":"hub/test/suite-soak.test.ts","line":60}]
finding_counts: {"high":0,"medium":2,"low":0}

Not clear: A-6236. Original H1/M1/M2 resolved by shared filtered-tree identity, injected T2 release fixture and unavailable-range publication recovery. Retained A-6232/A-6234 expose new owned M3 T2 and M4 T1 timing violations; preserve assertions with smaller scheduler/reporting fixtures, then fresh source review before verification.

Criteria: C2 failed (New T2 no-stall proof body takes 6.189 s (isolated 4.237 s); two new T1 periodic controls take .796/.853 s, exceeding their tier budgets.).

### rev-30 · 2026-10-19T16:44:07.533Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-886-source-final
commit: 265ded939070a863125a50513e94a6d0cbb8f606
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, all H1/M1–M4 resolved; A-6243. Exact 2h before/due/persistence/overlap assertions retained while smaller interval tests preserve General publication/no-stall; raw new T1 .090/.083s and T2 .580s satisfy tier bounds. C4 config/docs source-verified. C1–C3 await normal exact-head mode-free gate with native host evidence A-6234; no full task suite requested.

Criteria: C4 verified.

### impl-886 · 2026-10-19T17:05:34.536Z

Mode-free Linux verify 7196d948 at 265ded93 failed only the new-test duration gate: owned periodic General publication proof 9.43 s > 5 s, assertions green; A-6266. It still replayed 2h of per-second hub timers. Narrow test-only fix uses a 1s reporting interval, preserving the separate exact-2h T1 admission/persistence proof and all General/head/failing-file assertions. New source review required before the next verify.

### rev-30 · 2026-10-19T17:05:41.679Z

verdict: review
result: not clear
by: rev-30 [reviewer]
run: rev-20261019-886-runtime
commit: 265ded939070a863125a50513e94a6d0cbb8f606
scope: evidence
findings: [{"severity":"medium","text":"M5: New periodic structured-red reporting T2 case takes 9.429972452 s ordinarily (A-6266:51652), and 3.8556–4.2358 s in all five load repetitions. It exceeds the 2 s T2 boundary and the ordinary 5 s enforced gate. Preserve General publication/detail assertions with smaller reporting fixture/interval work; the exact two-hour boundary has its separate T1 proof.","file":"hub/test/suite-soak-component.test.ts","line":205}]
finding_counts: {"high":0,"medium":1,"low":0}

Runtime not clear: A-6267. Completed ordinary 1358/1358 and 363 groups 5/5, but M5 duration gate blocks completion before Neovim. Other corrected T1/no-stall/release controls meet budgets. C4 verification retained; C1/C3 final settlement awaits replacement gate. Preserve assertions and request fresh source review after owned correction before another mode-free verify. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6267-t-886-runtime-budget-refusal-at-265ded93.md

Criteria: C2 failed (Owned structured-red reporting proof exceeds T2 in ordinary and all five repetitions; exact-head gate exits 1 on its 9.430 s enforced duration.).

### rev-30 · 2026-10-19T17:06:38.797Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-886-reporting-source
commit: 2ecec97363badccbb3958cda17ebd099fbaa9268
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-6269. Reporting fixture now uses 1s interval without the large block; every General detail/from-kind/recipient assertion and exact 2h T1 control remain. A-6268 9/9, corrected body .213039041 s, no-stall .545692250 s. C4 source verification retained; C1–C3 await replacement exact-head mode-free evidence and owned costs. A-6266 remains red/partial evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6269-t-886-source-review-of-reporting-budget-correction-at-2ecec973.md

Criteria: C4 verified.

### impl-886 · 2026-10-19T17:27:00.722Z

Replacement mode-free verify a9440e1e at unchanged source-reviewed 2ecec973 is green: 1593/1593; hub + Neovim phases complete, owned new-test ordinary and 5/5 repetition costs fit T1/T2. Log A-6283. Linux c-8 lon1 lifetime 1140 s, cost $0.0792. Claimant completion marks recorded for C1–C4; awaiting Reviewer final evidence verdict and hub ready event. Prior red A-6266 retained as the duration-fix receipt.

### rev-30 · 2026-10-19T17:27:03.133Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-886-final
commit: 2ecec97363badccbb3958cda17ebd099fbaa9268
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-6284. A-6283 ordinary1593/1593, 513 groups5/5, all owned batch/periodic/release costs within tiers. Corrected General publication .232s ordinary/.324–.347s repetitions resolves M5. C1–C4 verified with current controls plus retained qualified A-6234 native filtered-tree/publication host contracts; prior H1/M1–M4 resolved. Inherited T-856/T-877 exception retained, Linux T3 remains landing evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6284-t-886-final-configurable-batch-and-periodic-t3-evidence-at-2ecec973.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-886 · 2026-10-19T17:34:45.401Z

Coordinator-authorized one merge completed after D68 committed: head 8898f47d, parents 2ecec973 and 1d81bd6e. Kept daily_spend_usd=20 plus batch_tiers=[T1] and dev_t3_every=2h. Dispatch conflict combines T-860 per-member resultText/artifact links with periodic dev-t3 General wrapping/detail. Targeted protocol/periodic/batch/config/release-tree proofs and npm run check are green. Fresh delta source review follows; old a9440e1e remains prior-head evidence only.

### rev-30 · 2026-10-19T17:36:10.199Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-886-d68-integration-source
commit: 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Integration delta clear; A-6294. Authorized merge d94213b9 preserves D68 cap and D67 keys. Dispatch keeps topic-local batch artifact/resultText identities and independent periodic General structured detail. Raw host protocol13/13, periodic9/9, batch34/34, config7/7, native filtered-tree1/1 pass; qualified as host evidence. C4 reverified; C1–C3 await new mode-free exact-head gate. Prior A-6283 remains prior-head evidence. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6294-t-886-d68-integration-delta-review-at-8898f47d.md

Criteria: C4 verified.

### impl-886 · 2026-10-19T17:58:30.299Z

Post-D68 merged-head mode-free verify 1c0dc6e1 at unchanged 8898f47d is green: 1599/1599, hub and Neovim complete; owned ordinary and 5/5 repetition durations fit tiers. Log A-6304. Linux c-8 lon1 lifetime 1267 s, cost $0.0880. Claimant done calls refreshed C1–C4; awaiting final Reviewer new-head evidence settlement and ready event.

### rev-30 · 2026-10-19T17:59:07.653Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-886-d68-integration-final
commit: 8898f47d2f14ba1e9186cfd9b1c42d7b23154abd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head evidence clear; A-6305. A-6304 ordinary 1599/1599 and 519 groups 5/5; owned batch/periodic/release and member-attachment cases meet tiers. A-6291 post-integration native filtered-tree contract retained separately from deferred Linux T3. C1–C4 reverified. Three inherited onboarding resource rows retained/routed under existing T-877 chain; pinned head predates its separate landing. No further run requested. /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-6305-t-886-final-d68-integrated-evidence-at-8898f47d.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.
