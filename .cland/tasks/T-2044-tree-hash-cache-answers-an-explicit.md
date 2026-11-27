---
id: T-2044
kind: task
title: Tree-hash cache answers an explicit --executor local epic cover with a cached Linux droplet result (no macOS run)
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1783
branch: t/T-2044-tree-hash-cache-answers-an-explicit
created: 2026-11-21T03:00:38.190Z
updated: 2026-11-27T02:51:57.322Z
---

## Summary

A Coordinator `verify all --occasion epic --executor local` submission at dev b9573ba7b (tree e6e9e532) on 2026-11-21 02:59Z was answered at once from the tree-hash cache with the Linux droplet stage cover 508d39b0 (A-22308: "cached", "Original occasion stage · executor droplet"). No macOS run happened. The request explicitly asked for the local executor, on a macOS host, for the epic DoD gate that requires a macOS full cover (T-1892), so a different-platform cached result can never satisfy it. Resubmitting with `fresh: true` ran locally.

## What to build

When a submission names an executor or platform, or its occasion requires one (the macOS epic cover), the cache only reuses results from that executor and platform. Otherwise it runs. Report the reuse decision in the result.

## Acceptance criteria

- [x] C1. An `--executor local` (or macOS-required occasion) submission with only a cached Linux droplet result for the tree runs locally instead of returning the cached result (test).
  - verified: rev-41 [reviewer] · run rev-41-20261126-2044-final · 2026-11-26T21:28:03.610Z · commit 3af173d308b1bb0b2fb3666246b62727d60b2e10
  - done: impl-2044 · 2026-11-27T01:27:08.780Z
- [x] C2. A same-platform cached result is still reused, and the result names the cached run's executor and platform (test).
  - verified: rev-41 [reviewer] · run rev-41-20261126-2044-final · 2026-11-26T21:28:03.610Z · commit 3af173d308b1bb0b2fb3666246b62727d60b2e10
  - done: impl-2044 · 2026-11-27T01:27:08.936Z

## Comments

### impl-2044 · 2026-11-25T13:05:31.226Z

Consumer inventory before cache admission policy change: receiptExecutionMatches is called only by Suites.#cacheReceiptAvailable; #cached/#cacheInputsMatch serve admission and explicit-droplet bypass diagnostics. Cache fields are read by dispatch reports, CLI verify output, web verification model, shared wire conformance, batch-member-verification, stage/epic cover derivation and persisted suite restoration. Searched function names and cached/cacheBypass/original occasion/executor/platform across hub/src, hub/test, nvim/test, web, docs, qa and shipped skills; wire shape remains unchanged. Existing suite-cache, suite-release-cache, suite-queue, suite-cover and suite-persistence tests pin provenance. Red reproduction: both new whole-case tests returned cached.executor='droplet' for explicit local and default-local epic requests (expected cached undefined).

### impl-2044 · 2026-11-25T13:09:54.597Z

Detailed consumer disposition: Suites admission and verification-tree matcher migrated; dispatch cache provenance now names OS; CLI SUITE_USAGE and frozen commands.json updated together. CLI suite.start parser, protocol/SuiteAdmission cached shape, shared/wire, previous-shape cache tests, web and Neovim readers unchanged because no fields removed or added. Persisted suite jobs use existing platform/cacheBypass fields; old missing OS is refused only for constrained reuse. suite-stage-cover, suite-persistence, suite-queue, suite-accounting, executor-run-rules, suite-cache-recovery, suite-release-cache and suite-cache exercise existing readers; startup probes and QA briefs consume the same durable result identity with no wire migration. Production import graph found 758 reachable manifest tests (T1 69, T2 374, T3 226, T4 14, other/Web 75), with 18 unresolved dynamic-loader/external edges reported separately; this is a partial static inventory, not runtime proof. Running changed files and ~5 direct regressions locally; broad selection deferred to verify. No rule clause edits per launch brief.

### rev-41 · 2026-11-25T13:15:20.173Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261125-2044-source1
commit: 307609ad2c31ce3ab0d96ed8ce1cc6cb2bc0f386
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; no findings. Explicit local/droplet and effective stage/epic/release executor constraints reach shared executor/OS matcher; unknown OS misses constrained reuse. Ordinary omitted-executor reuse and existing success/artifact/expiry/supersession checks remain. Incompatible source/request facts persist in bypass log/result; hits copy/report original executor/platform. Both new owned suiteCase controls cover incompatible executor, wrong/unknown OS and matching cached durable result/no worker; existing release/explicit-droplet/report controls retained. Help export/frozen bytes match, docs/README/skill CHANGES updated, consumer census assessed. Standards/Spec A-23413: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23413-t-2044-source-review-clear-at-307609ad2.md. C1/C2 remain unverified until exact-head configured receipts. A-23408 selected local macOS checks/static inventory are not broad configured/T3/T4/browser proof. No Reviewer execution or edits. Follow Coordinator verify window; changed head needs source review.

### rev-41 · 2026-11-26T00:09:57.580Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-evidence1
commit: 307609ad2c31ce3ab0d96ed8ce1cc6cb2bc0f386
scope: evidence
findings: [{"severity":"medium","text":"M1: shared local completion receipts hardcode darwin/arm64, so Linux's newly constrained local/epic requests correctly miss those receipts. Configured run fails same-platform cache assertions in suite-persistence:563 and suite-stage-rules:356. Migrate fixture execution identity and exact consumers together, retaining cache-hit/footer/browser and occasion/batch-exclusion assertions.","file":"hub/test/suite-unit-fixture.ts","line":190}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear: exact-head run9d1da2db/A-23491 code1; structured complete T0 exit0/T1 exit1, T2/T3/Web/T4/browser unexecuted. Actual failures: persistence:563 Expected values strictly equal, +undefined -9a5ef582-5b2d-4ae5-8e75-71c677bfef25; stage-rules:356 identical soak coverage can reuse an occasion green, +undefined -2eabe994-d42e-4319-942d-53de1b528371. Both trace to one hardcoded Darwin local fixture on Linux, not different executors. C2 failed, C1 remains unverified; new exact cache identities each base pass+5/5 load passes retained only as partial evidence. Corrected full diagnosis A-23493 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23493-t-2044-corrected-failed-run-diagnosis-local-fixture-os-mismatch.md supersedes A-23492's erroneous separate M2. Linuxx64 c8nyc1 Node24.21 Nvim0.12.5 workers2; duration/lint report-only. Source/tree match checked. Reviewer ran no tests. Correction needs fresh source review before lead/Coordinator schedules retry.

Criteria: C2 failed (Configured Linux run fails two existing local cache-hit consumers because shared fake completion platform is hardcoded Darwin; migrate consumers/fixture without weakening execution constraints.).

### rev-41 · 2026-11-26T00:13:25.586Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-source2
commit: c3e777eeebd6602244ef15c0baec6e4b7d2e4e29
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at c3e777eeebd6602244ef15c0baec6e4b7d2e4e29. M1 resolved: explicit localPlatform fixture mode supplies process.platform to host-cache/provenance/occasion consumers; exact cached-ID/footer/browser/batch exclusion assertions retained. Default Darwin remains for intentional stage simulations; consumer inventory assessed, remote receipts unchanged. New guarded legacy no-platform cross-executor control retains unconstrained reuse. No production change or dev merge since prior source review. Standards/Spec no findings; A-23495 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23495-t-2044-source-review-clear-at-c3e777eee.md. C1/C2 done but remain unverified pending same-head configured result. A-23494 local macOS139/139 and simulated Linux76/76 are selected/simulated evidence, not native Linux; initial setup failure retained. Old9d1da2db/A-23491 remains failed T1; A-23493 supersedes mistaken separate-M2 diagnosis A-23492. No Reviewer tests. Retry scheduling remains item lead/Coordinator.

### rev-41 · 2026-11-26T02:09:01.306Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-evidence2
commit: c3e777eeebd6602244ef15c0baec6e4b7d2e4e29
scope: evidence
findings: [{"severity":"medium","text":"M1: remaining retained-log cache consumer uses default Darwin local fixture receipts, then requests constrained host-local epic reuse. Linux rejects the OS mismatch, failing cached-ID assertion at172 before shared-scan/reopen/heap proof. Opt into host-platform mode and preserve all original work/identity assertions; revisit retained-default cache consumers.","file":"hub/test/suite-log-backfill.test.ts","line":128}]
finding_counts: {"high":0,"medium":1,"low":0}

Retry not clear:6c509398/A-23527 code1, causeempty; structured T0/T1exit0, T2exit1, laterT3/Web/T4/browser unexecuted. Actual failure `cached and stage proof receipts: Expected values to be strictly equal: +undefined -stage-0` at suite-log-backfill:172 traces to default Darwin fixture at128. C2failed,C1unverified. Two prior T1failures now pass, and three cache identities eachbase+5/5loadpass retained as partial evidence. A-23528 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23528-t-2044-retry-failed-remaining-backfill-host-cache-consumer.md. Exact source/tree checked. Linuxx64c8nyc1 Node24.21 Nvim0.12.5 workers2, one macOS-prerequisite skip; duration/lint report-only. Prior failed round retained. Reviewer ran no tests. Correction needs fresh source review; lead/Coordinator controls retry.

Criteria: C2 failed (Configured retry T2 fails retained-log same-platform reuse consumer; suite-log-backfill still supplies default Darwin receipts for host-local epic cache requests on Linux.).

### rev-41 · 2026-11-26T17:46:56.428Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-source3
commit: cd0117e3a992ba784baa309305e3eca28cb4bc0e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at cd0117e3a992ba784baa309305e3eca28cb4bc0e. Backfill M1 resolved by eligible semantic Linux droplet stage receipts matching later epic executor, single remote slot and observed scripted start; original cached-ID/baseline/two-scan/reopen/whole-read/heap assertions all retained. No production change/dev merge; updated file guidance. Standards/Spec no findings; A-23545 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23545-t-2044-source-review-clear-at-cd0117e3a.md. C1/C2 remain unverified pending configured exact-head evidence. C2stillfailed in readback despite request sayingdone; lead should restore implementation done mark. A-23529 local111pass/simulatedLinux6pass and A-23544 fulltypecheck/lint0 are selected/local evidence, not native Linux. Both prior failed configured rounds retained. Reviewer ran no tests; retry window remains lead/Coordinator.

### rev-41 · 2026-11-26T18:54:47.373Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-evidence3
commit: cd0117e3a992ba784baa309305e3eca28cb4bc0e
scope: evidence
findings: [{"severity":"medium","text":"M1: native scenario explicitly requests --executor local then expects local.cached.run to reference the prior droplet receipt and a droplet report. This contradicts the new policy and fails at79 (TypeError cached undefined). Migrate to positive completed local execution/no droplet cache; separately retain permitted unconstrained reuse and delivery/accounting/token/cleanup proof.","file":"hub/test/scenarios/droplet-verify.test.ts","line":78}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear for26c70a1d/A-23572 exactcd0117e3a. Actual output TypeError: Cannot read properties of undefined (reading run), scenarios/droplet-verify:79. Source78explicitlocal/cache79still expects forbidden reuse. C1failed,C2unverified. A-23573 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23573-t-2044-native-scenario-consumer-still-expects-forbidden-cross-executor-cache.md. Structured producer code1/causeempty, completeT0/T1/T2exit0,T3exit1; Web/T4/browserunexecuted. Source/tree91022a00checked. Linuxx64c8nyc1workers2 Node24.21/Nvim0.12.5;9skips, advisoriesreport-only. All prior failed rounds retained. No Reviewer execution. Fix requires fresh source review and Coordinator retry window; expand consumer census to direct CLI executor flags/cache accessors.

Criteria: C1 failed (Unmigrated native scenario still requires explicit --executor local to reuse a droplet receipt, contrary to C1; configured T3 fails at local.cached.run.).

### rev-41 · 2026-11-26T19:04:03.298Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-source4
commit: 3af173d308b1bb0b2fb3666246b62727d60b2e10
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at3af173d308b1bb0b2fb3666246b62727d60b2e10. Native consumer M1 resolved: omitted-executor hit preserves original droplet cachedID/report; explicitlocal asserts no cache and bounded exact result exit0/Executorlocal before stop/byte scans. All delivery/selection/runner/accounting/token/cleanup assertions retained; docs/index updated, no production change/devmerge. Expanded A-23576 per-hit274/78file+suiteUnit census assessed; reported41matching local files635pass/static0 are selected macOSarm64 Node24.21 proof, not nativeLinux/configuredclosure. Standards/Spec no findings; A-23577 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23577-t-2044-source-review-clear-at-3af173d30-after-native-consumer-migration.md. C1/C2done/unverified pending same-headconfiguredresult. Allthree prior failed configured rounds retained. No Reviewer tests/edits/native/browser execution. Coordinator window required before retry.

### rev-41 · 2026-11-26T20:12:47.357Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-evidence4
commit: 3af173d308b1bb0b2fb3666246b62727d60b2e10
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence incomplete, not clear for e94867ad/A-23611. Producer code1 cause `remote machine lost`, only T0 completeexit0 in structured tierReceipts; remoteT1/T2/T3/Web completion/closure receipts missing, closure unknown. Collected logprints T1/T2/T3/Webexit0 and own exact regression passes (threecacheidentitiesbase+5/5, backfill/nativecasebasepass); retained as positive partial evidence, not owner-complete run. Source/treec728e454matcheshead. C1/C2staydone/unverified; no newsourcefinding or failedcriteria inferred from receiptloss. A-23616 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23616-t-2044-remote-loss-result-remains-incomplete-despite-collected-green-log.md. Linuxx64c8nyc1workers2 Node24.21/Nvim0.12.5, ChromeHeadlessShell1248/CFT156executed percollectedWeb;12skips/advisoriesreport-only/T4unexecuted. Allpriorroundsretained. Authorizedunchangedheadretry228fa8db nowadmitted/pending; Reviewerlaunchednothing.

### rev-41 · 2026-11-26T21:28:03.610Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-final
commit: 3af173d308b1bb0b2fb3666246b62727d60b2e10
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; C1/C2 verified at3af173d30 from orderedretry228fa8db/A-23633. Producer code0/causeempty, completeT0/T1/T2/T3/Webexit0 all same-run/treec728e454; executablematchchecked. Three exact cache identities base+5/5load/filepasses; formerlyfailed footer/stage-rule/backfill/native scenario identities+files basepass. Native explicitlocal no-cache/completedlocalexit0 and omitted-executor remotehit retained; exact compatiblecached-ID/originalexecutor-platform/no-new-worker and legacyunknown-OS controls establish criteria. A-23634 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23634-t-2044-final-review-clear-at-3af173d30.md. Linuxx64c8nyc1workers2 Node24.21/Nvim0.12.5 HeadlessShell1248/CFT156.0.8078.4, noncached,12platform/prereqskips;253selectedT3once, remainingintegratedoccasionseparate/T4notfulltier, advisoriesreport-only. Allfour earlier failed/incomplete rounds retained, includinge948remote-loss structuredT0only; noneconvertedtopass. No findings or Reviewerexecution.

Criteria: C1 verified, C2 verified.

### rev-41 · 2026-11-26T21:32:42.823Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-delta1
commit: 0e9a2aaa3b10cc079dde534872c07adca9f5a774
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized dev-merge delta source clear at0e9a2aaa3 (parents3af173d30/devb3e3f89e8). Both-parent comparisons and taskdiffagainstnewdev inspected. README retains task cache-policy and dev invocation/hook paragraphs; matching executor/OS/cache/bypass/report logic and all migrated consumers unchanged. Imported shared suites changes are pass-accounting and host-gate clock, outside cache policy. Standards/Spec no findings. A-23636 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23636-t-2044-authorized-dev-merge-delta-clear-at-0e9a2aaa3.md. C1/C2done but prior verification stale atnewhead; no newmarks. A-23635 local macOSarm64 Node24.21selected101+CLI10/fulltypecheck/lint0 not newconfiguredLinuxproof. Priorcomplete228fa8db and allfailed/incompleterounds retained asoldhead evidence. Reviewerexecutednothing. Fresh Coordinator window/newheadconfiguredreceipt required.

### rev-41 · 2026-11-26T22:43:49.451Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261126-2044-merge-evidence1
commit: 0e9a2aaa3b10cc079dde534872c07adca9f5a774
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Merged-head evidence notclear. Run4053e1b7/A-23651 producer code1/causeempty, completeT0/T1/T2exit0,T3exit1, Web/T4/browserunexecuted. Literal OpenCodeAdapter failureatlog rollback assertion true!==false at adapter-native-boundary:488 tests presence of .cland/opencode/impl (directory retained), not child-exit assertion. Source/tree5049c225checked; taskdiffagainstdev doesnotchange failingtest/adapter/system-processes, but no causal/flaky attribution inferred. Exactcachecontrolsbase+5/5 and correctednativecasebasepass retained onlypartial. A-23652 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23652-t-2044-merged-head-run-failed-in-opencode-rollback-assertion.md. No newcachesourcefinding; C1/C2done/staleunverified atmergedhead, nofailed/verifiedmarksadded. Linuxx64c8nyc1workers2 Node24.21/Nvim0.12.5,9skips/advisorybudgetsreport-only. Allpriorroundsretained. Lead/Coordinatorattributionand retrydecisionpending; Reviewerlaunchednothing.

### rev-41 · 2026-11-27T01:27:47.510Z

verdict: review
result: clear
by: rev-41 [reviewer]
run: rev-41-20261127-2044-delta2
commit: 3850ab09d903bf17edda4bc899cbe51d61733b04
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Posted shared-fix merge delta source clear at3850ab09d. Both-parent comparisons: README retains taskcachepolicy and devbatch/T3-plan paragraph with separation; cacheadmission/matcher/reporting and migratedunit/native consumers unchanged from0e9a2aaa3. Taskdiffagainstdevde4118939 retains priorcachepolicy only, no additional implementation/config/help changes. Standards/Spec no findings; A-23683 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23683-t-2044-shared-fix-merge-delta-source-clear-at-3850ab09d.md. C1/C2done, old marks stale/unverified atnewhead; newconfigured evidencepending. A-23682 actualmacOSarm64 Node24.21selected101/101/typecheck+lint0 islocal evidenceonly. Prior4053e1b7failure retained; Coordinator sharedfixattribution isnotpass. Alloldrounds retained, Reviewerexecutednothing. Obtain Coordinator newheadverifywindow.

### rev-41 · 2026-11-27T02:51:57.322Z

verdict: review
result: not clear
by: rev-41 [reviewer]
run: rev-41-20261127-2044-evidence1
commit: 3850ab09d903bf17edda4bc899cbe51d61733b04
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Evidence incomplete, not clear. Run cf0f336c/A-23700 at source-clear 3850ab09d: producer deadlineExpired=true/code143, cause `run timeout 75m; secondary diagnostic: package closure incomplete; machine deletion required`, closure incomplete/nativeExit143. Structured T0–T3 complete exit0; Web interrupted/no complete receipt, T4 unexecuted. Three cache controls each base+5/5 pass; native droplet scenario and previously failing OpenCode log-rollback case base pass, retained only as partial evidence. No new source finding; C1/C2 done, old verification stale/unverified at this head; no failed marks inferred from incomplete Web. A-23701 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-23701-t-2044-shared-fix-run-incomplete-during-web-at-3850ab09d.md. Source/tree 7c562783 matched. Linux x64 c8 fra1, workers2, Node24.21/Nvim0.12.5, HeadlessShell1248/CFT156 in incomplete Web; 12 skips and report-only advisories retained. All prior rounds retained. Authorized larger same-head e7499da9 now admitted/pending; Reviewer ran nothing.
