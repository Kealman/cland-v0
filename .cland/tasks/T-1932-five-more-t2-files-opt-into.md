---
id: T-1932
kind: task
title: "Five more T2 files opt into nativeIdentityProjectHub: migrate them onto T-1915's hermetic CLI boundary or move them to T3 with a reason"
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1882
blocked_by:
  - T-1915
topic: topic-1650
branch: t/T-1932-five-more-t2-files-opt-into
created: 2026-11-17T04:43:21.058Z
updated: 2026-11-19T08:43:18.372Z
closed: 2026-11-19T08:43:18.372Z
---

## Summary

Split from T-1915 (A-20619). T-1915 builds the shared hermetic CLI and fixture boundary and migrates five consumers. Five more T2 files still import `nativeIdentityProjectHub` and read the real machine lock identity: roles-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode.

## Evidence

- A-20205: T-1768's macOS enforce census (239 files).
- A-20619: impl-1915's scope inventory and split (2026-11-17). auth-mode passed the old census and needs route classification; merge-queue has further native paths, which A-20619 lists.

## What to build

Move each of the five files onto T-1915's boundary, so that under the T2 tripwire it makes no native process call. Where a file truly needs the native path, move it to T3 with its reason recorded in the tier manifest.

## Acceptance criteria

- [x] C1. Each of roles-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode either passes an enforce-mode T2 tripwire run with no native process call, or is in T3 with its reason recorded (test).
  - verified: rev-39 [reviewer] · run rev-20261119-1932-final-5 · 2026-11-19T07:35:29.239Z · commit 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314
  - done: impl-1932 · 2026-11-19T07:35:43.845Z
- [x] C2. No T2 file imports `nativeIdentityProjectHub` afterwards, or each remaining import has a recorded reason (test).
  - done: impl-1932 · 2026-11-19T06:34:04.306Z
  - verified: rev-39 [reviewer] · run rev-20261119-1932-source-2 · 2026-11-19T06:43:56.050Z · commit d475f87af8e2662a07adf6baeba6f54cdb2f43ce
  - verified: rev-39 [reviewer] · run rev-20261119-1932-delta-4 · 2026-11-19T07:08:21.680Z · commit 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314
  - verified: rev-39 [reviewer] · run rev-20261119-1932-final-5 · 2026-11-19T07:35:29.239Z · commit 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314

## Comments

### impl-1932 · 2026-11-19T06:27:53.321Z

Disposition and tier history: roles-component, suite-protocol, suite-wait-metrics, merge-queue and auth-mode all remain T2 (T2 before this item; no T3 promotion or T3 proof reused). All replace nativeIdentityProjectHub with projectHub and CLI subprocesses with sealed production CLI module invocations. Guard runs from setup through cleanup; suite-protocol billingCase retains its own guarded cleanup owner. Consumer inventory: fixture-hub-cli is used by config-reload-component, config-set, startup-ready-component, hub-status-component and hub-priority; these keep its start/status API. New fixture-command serves the five named files only. Optional CLI output sinks preserve existing defaults for hub/bin/cland.ts and all old callers; no wire/help text changes. Searches covered function names, CLI module imports, docs, skills and hub/nvim tests. No remaining test imports nativeIdentityProjectHub (rg). Merge-queue stageTree is injected in seed Tracker and serving hub; missing-test refusal fixture removes its cland runner marker to preserve its non-cland command-refusal subject.

### rev-39 · 2026-11-19T06:38:35.334Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1932-source-1
commit: e0dbf144ddca6a24e7c6e245ba6631308ed1e360
scope: full
findings: [{"severity":"medium","text":"M1: normal long-fallback billingCase receives both file fixtureNativeGuard and inner guardedLeaseCase. Registration-order outer restore precedes inner success/repair fence; inner restore later reinstalls its captured outer guard, leaking isolation state. Author a6061f5e confirms. Give every billingCase one guard owner and prove post-cleanup restoration.","file":"hub/test/suite-protocol.test.ts","line":9},{"severity":"low","text":"L1: guide still claims only synthetic billing uses fake projectHub and existing native CLI cases keep original fixture, but this item migrates the entire file. Replace superseded wording with current hermetic/module boundary and billing guard ownership.","file":"docs/agents/tests/hub-test-suite-protocol.test.ts.md","line":34}]
finding_counts: {"high":0,"medium":1,"low":1}

Full source NOT CLEAR ate0dbf144ddca6a24e7c6e245ba6631308ed1e360/base808a00be1. Standards1medium/1low, Spec0 additional findings. FiveT2tier/assertion migrations, sealed sharedCLI context, after-overlay credential/Git filtering, stageTree/missing-command fixture subjects and unchanged production output defaults reviewed positively. C2search finds nativeIdentityProjectHub only harness definition/no test import; done retained/unverified. M1guard stack/order confirmed by authora6061f5e; successful75/75enforce targets/84boundaryconsumers do not check original functions restored after normal billing case. Fix owner/order and stale guide together, preserve all assertions, then fresh source review. A-21617: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21617-t-1932-first-source-review-nested-guard-restoration-order.md. A-21612localmacOSNode24.21 targeted evidence and full lint/typecheck0 scoped, no configured/Web/T3/T4/browser/nativeworker or Reviewer execution. C1 failed; hold released.

Criteria: C1 failed (Introduced nested native guards restore out of order around the normal billingCase, losing success-fence isolation and leaving an outer guard installed.).

### rev-39 · 2026-11-19T06:43:56.050Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1932-source-2
commit: d475f87af8e2662a07adf6baeba6f54cdb2f43ce
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1932 corrected source review: CLEAR
Commit: d475f87af8e2662a07adf6baeba6f54cdb2f43ce
Git tree: aed8a8d55d04c4e1145b910dc2b28f1356780625
Base: 808a00be1bd05ffeebd32d5a17036409dd025fec
Correction since reviewed e0dbf144d: one commit, two files, 30 additions/10 deletions; no dev merge.
Run: rev-20261119-1932-source-2; scope full.

## Standards
Clear; no findings. M1 is corrected by removing global beforeEach and its name exemption, explicitly installing fixtureNativeGuard before acquisition in all sixteen nonbilling cases, and leaving both billing cases solely owned by billingCase. The success regression captures seven CP methods and ChildProcess.prototype.spawn at module import and compares them after billingCase's registered cleanup/release check. Registration order is now shared drain, positive billing resource/root/repair confirmation and release, then restoration comparison; no outer guard can be reinstalled by inner restoration. The preexisting rejection/repair assertions remain. L1's superseded native-fixture paragraph is replaced with current file-wide synthetic identity/sealed CLI behavior and explicit billing ownership.

## Spec
Clear; no additional findings. The five original T2 migrations and the shared sealed CLI environment boundary from the first source audit are unchanged. Existing ledger-confirmed delivery/history/log assertions, fixture subjects and tiers remain. Exact-head Git source search over hub/test and nvim/test finds nativeIdentityProjectHub only at its harness.ts:615 definition, with no test importer; C2 is established by source and verified in this pass. C1's runtime enforcement remains unverified pending the configured same-head result.

Evidence limits: A-21618 retains the author-reported new restoration assertion red before fix and full suite-protocol 18/18 green in candidate worktree under enforce T2, Darwin arm64 Node24.21.0. It explicitly corrects A-21612's earlier unproven restoration claim. These are targeted candidate-worktree receipts, not configured verification at this committed head. The requester reports full typecheck/lint exit0, zero refusals and unchanged report-only129 findings/62 files. No browser/native/provider/T3/T4/configured run is claimed. Reviewer performed read-only source/log review, including diff whitespace check, and ran no tests or probes.

Standards: 0 findings. Spec: 0 findings. C2 verified; C1 pending same-head configured enforcement. Source clear permits configured verification at this head subject to the Coordinator's window.
Artifact: A-21624, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21624-t-1932-corrected-source-clear-single-billing-guard-ownership.md

Criteria: C2 verified.

### rev-39 · 2026-11-19T07:05:06.692Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261119-1932-evidence-3
commit: d475f87af8e2662a07adf6baeba6f54cdb2f43ce
scope: evidence
findings: [{"severity":"medium","text":"Configured c3236889 failed shared T-1999 status/freshness overlap assertion; five target files pass75/75, but required overall evidence is failed and Web unexecuted. No native-process regression attribution.","file":"hub/test/item-summary-scale.test.ts","line":140}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1932 configured evidence NOT CLEAR
Head d475f87af8e2662a07adf6baeba6f54cdb2f43ce; review rev-20261119-1932-evidence-3, scope evidence.
Run c3236889-7baf-4b22-8d3f-2430de08d649 / A-21638 exited1. Sole literal failure:
AssertionError [ERR_ASSERTION]: the status reply arrives while the first freshness batch is still running
at hub/test/item-summary-scale.test.ts:140:10.
Case: a thousand-item planned hub serves within two seconds of listening before maintenance, completion3.13065169s. Shared overlap case is tracked as T-1999, the same failure Coordinator attributed on T-1957; no native-process regression attributed to T-1932.

Structured complete receipts independently checked: 6,192 ordinary tests, 6,191pass/1fail;210 separate load repetitions passed. The five migration files all completed normally: auth-mode7, merge-queue38, roles-component5, suite-protocol18, suite-wait-metrics7 (75/75). No target-file tier-mismatch receipt found; this selected scan alone is not claimed as native coverage. Source guards and local enforce receipts retain their existing scope. The successful billing restoration comparison and rejected-cleanup/repair assertions were part of suite-protocol's completed cases.
T0/T1 exit0,T2 exit1; Web unexecuted, T3 deferred to merge batch, T4 unexecuted. No skip/cancel recorded. Linuxx64 droplet c-8ams3, kernel6.8.0-147-generic, Node24.21.0, Neovim0.12.5, workers2; producer lifetime1010s/cost$0.0702. No browser runtime receipt. Budget/lint findings report-only.

Medium hub/test/item-summary-scale.test.ts:140: required configured evidence failed. C1 final verification remains incomplete despite positive scoped75-file-case evidence; source clear/source-established C2 remain. C1 is failed for configured evidence, not for a diagnosed native leak. No new source finding, no full-suite success claim. Keep failed round distinct. Lead/Coordinator must choose shared-fix/retry disposition; this review requests no runtime experiment or automatic resubmission. Reviewer ran no tests/probes.
A-21639: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21639-t-1932-failed-configured-evidence-shared-startup-overlap.md

Criteria: C1 failed (Required configured c3236889 failed shared T-1999 overlap assertion; final evidence incomplete despite75/75 positive migration cases. Source C2 remains verified.).

### impl-1932 · 2026-11-19T07:06:19.222Z

Coordinator attributed c3236889 failure to T-1999 and supplied shared fixes bbdf60754 then 8730aa5be. Applied under rule 11, head 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314. Delta from d475f87af is exactly hub/test/item-summary-scale.test.ts +6/-1; blob abb2f4297723bf32095ed19168f8936d50e58f1e matches 8730aa5be. Specified case run once alone passed 1/1 on macOS arm64 Node24.21.0; whole-project typecheck passed. Evidence A-21641. Original c3236889 receipt remains failed; no automatic resubmission or dev merge.

### rev-39 · 2026-11-19T07:08:21.680Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1932-delta-4
commit: 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1932 shared-fix identity source CLEAR
Head1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314, tree0f6fa362a3f9a4a703f958b92d7bca6ec3f409c9.
Review rev-20261119-1932-delta-4, scope delta.
Binding Coordinatoraa893e80 supplies rule11 T-1999 commits bbdf60754 then8730aa5be and limits this review to identity.

Independently checked delta from source-reviewed d475f87af: exactly hub/test/item-summary-scale.test.ts, +6/-1; no other paths. Both new head and source-clear T-1999 commit8730aa5be have identical full file blob abb2f4297723bf32095ed19168f8936d50e58f1e. Local commits745eff30b then1ddbfc118 preserve requested order; diff whitespace check passes. All original T-1932 migration/guard/docs source is unchanged. Standards and Spec: zero new findings within requested scope; prior M1/L1 stay resolved.

C2's source-established no-import disposition is preserved because the only changed file is the exact reviewed shared fix and introduces no nativeIdentityProjectHub reference. Reverify C2 at this head; C1 final evidence awaits a new configured same-head result. This source pass does not turn old c3236889/A-21638 into green evidence.

A-21641 reports the required one selected case1/1 local Darwinarm64 Node24.21.0, standalone T2 with no tier preload claimed; listening→serving92.534ms/serving→status17.372ms, both unchanged2000ms bounds. Whole case2.923215166s includes setup and is not startup latency. It reports whole-project typecheck0; request also reports full lint0/zero refusals with unchanged129/62 report-only census. No browser/T3/T4/provider/configured proof at the new head. Earlier failed configured round remains failed. No Reviewer test/probe or file mutation. Narrow identity clear permits requesting the Coordinator's new verify window.
A-21642: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21642-t-1932-t-1999-shared-fix-identity-clear-at-1ddbfc118.md

Criteria: C2 verified.

### rev-39 · 2026-11-19T07:35:29.240Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261119-1932-final-5
commit: 1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1932 final evidence CLEAR
Reviewed head1ddbfc1181a26ee52e8031b5c4b8e2fcfc495314 (Git tree0f6fa362a3f9a4a703f958b92d7bca6ec3f409c9).
Run rev-20261119-1932-final-5; scope evidence.
Configured5cb31b1d-85aa-4c6d-bbff-5edd508fb225/A-21652 passed at this exact source-cleared head, no cache. Producer snapshot tree72ad1609763f76372958dec3e091487c08790433 is distinct from the Git source tree.

Independent structured completion review:6,928 ordinary passes and210 separate load repetition passes; zero failures/skips/cancellations. T0/T1/all fallbackT2/Web exit0. T3 remains merge-batch deferred; T4 unexecuted. No all-tier claim. Linuxx64droplet c-8ams3, kernel6.8.0-147-generic, Node24.21.0, Neovim0.12.5, workers2. Actual suite-browser receipt names /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Producer lifetime1213.863s/cost$0.0842960417 (rounded summary1214s/$0.0843); not test wall time. Budget/lint/ratchet findings remain report-only.

C1: all five named migration files completed normally at reviewed head: auth-mode7/7, merge-queue38/38, roles-component5/5, suite-protocol18/18, suite-wait-metrics7/7 (75/75). They retain their explicit positively controlled full-boundary denying guards, including callback/custom/sync/prototype launch seams and final denied-count checks through cleanup. Their ordinary receipts pass; no target-file tier-mismatch diagnostic found, which alone is not native coverage. This is combined with source-reviewed guard ownership and author-retained explicit enforce-T2 batch75/75 in A-21612, corrected suite-protocol18/18 enforce-T2 receipt in A-21618, with those local candidate-worktree epochs labelled as such. Main configured run is not relabelled a global enforce-tripwire run. Named configured billing cleanup rejection/repair and long-fallback confirmed-billing delivery/history/log cases passed (0.002184393s and0.168359592s respectively), including post-successful cleanup restoration assertion. Shared startup-overlap fix is source-identical to reviewedT-1999; required configured run is now green. No native-process defect remains diagnosed.

C2: source-established exact-head no-test-import result from delta-4 retained; only nativeIdentityProjectHub definition remains at harness.ts615. No test-tier promotion or inheritedT3 proof.

Standards and Spec: no findings. VerifyC1,C2. Earlier c3236889/A-21638 at d475f87af remains failed/partial; this is corrected-head proof, not retrospective success. Earlier local receipts retain their original limits. Reviewer performed read-only source/receipt inspection, no tests, browser, probes or mutations.
A-21653: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21653-t-1932-final-clear-at-1ddbfc118-with-exact-head-configured-receipts.md

Criteria: C1 verified, C2 verified.

### coord · 2026-11-19T08:43:18.372Z

Merged cd48c41ffdba72b3ba30c9789192ca07205d753c onto dev.
