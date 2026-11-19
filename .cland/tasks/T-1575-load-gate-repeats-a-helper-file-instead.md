---
id: T-1575
kind: task
title: Load gate repeats a helper file instead of the test file that registered a shared contract case
state: closed
status: done
size: S
criterion_seq: 3
labels:
  - ready-for-agent
  - bug
assignee: null
parent: E-1883
blocked_by: []
topic: topic-1648
branch: t/T-1575-load-gate-repeats-a-helper-file-instead
created: 2026-11-01T00:09:14.452Z
updated: 2026-11-19T09:28:03.276Z
closed: 2026-11-19T09:28:03.276Z
---

## Summary

The load gate attributes a new test to the file in whose source the `test()` call sits, and then repeats that file alone. When a shared contract helper registers cases on behalf of a `.test.ts` wrapper, the gate launches the helper, which registers nothing, and fails with `expected one passing receipt`. Found on T-1542's verify 21753a25 (A-15116): `hub/test/host-contract.ts` registers the Host contract cases for its wrapper test file.

Shared contract suites are planned for every Host implementation in E-1531, so this will recur. T-1542 works around it by registering the named cases in the wrapper.

## Acceptance criteria

- [x] C1. The load gate repeats a new test by launching the test file that the suite run executed when the test was registered, not the source file of its `test()` call, proven by a fixture whose wrapper `.test.ts` imports a helper that registers a case.
  - done: impl-1575 · 2026-11-19T06:53:50.323Z
  - verified: rev-36 [reviewer] · run rev-36-1575-final-1 · 2026-11-19T08:04:36.161Z · commit 396ad2dccc64f9ea139362b582332a52761e16e5
- [x] C2. Duration, budget and tier lines name the same launched test file for such a case.
  - done: impl-1575 · 2026-11-19T06:34:37.502Z
  - verified: rev-36 [reviewer] · run rev-36-1575-final-1 · 2026-11-19T08:04:36.161Z · commit 396ad2dccc64f9ea139362b582332a52761e16e5
- [x] C3. A helper that registers cases when it is launched directly keeps today's behaviour, proven by an unchanged existing load-gate test file.
  - done: impl-1575 · 2026-11-19T06:34:37.986Z
  - verified: rev-36 [reviewer] · run rev-36-1575-final-1 · 2026-11-19T08:04:36.161Z · commit 396ad2dccc64f9ea139362b582332a52761e16e5

## Comments

### impl-1575 · 2026-11-19T06:24:23.744Z

Consumer inventory (rules 20/41): load-gate-reporter.ts discovery/result file feeds load-gate.ts launch, matching, baseline and rerun identities; duration-reporter.ts feeds durations.ts, suite-duration-budget.ts and persisted durations.json; skip-reporter.ts feeds suite-progress/suite-tier-report timing, execution and skip receipts; quarantine-reporter.ts uses file::name admission/quarantine keys. Tier bootstrap already keys process.argv[1]. Migrate reporters through shared reporter-file.ts selector; keep source locations for diagnostic stacks/file-envelope detection. Search covered hub/src, hub/test including T3/T4/frozen fixtures, nvim/test, docs and shipped skills; no wire/help schema or frozen CLI bytes change. Existing events without entryFile retain source fallback. Existing duration baselines remain valid for ordinary files; helper-sourced historical keys correctly cease proving wrapper cases.

### impl-1575 · 2026-11-19T06:29:50.183Z

Additional raw consumer: durations.ts logTimings reads suite start JSON for pre-timing legacy logs. skip-reporter keeps that absolute-path shape and changes only the selected entry file. Existing durations.test.ts passed 23/23 unchanged. Native evidence: red wrapper launched helper and emitted expected one passing receipt/0 of 5; after fix wrapper 5/5, one ordinary wrapper timing, wrapper budget report classified T1, tier T1 tests 1, and five wrapper progress completions. Full durations-runner 20/20; quarantine-runner 18/18; final wrapper targeted rerun 1/1. macOS arm64, local Node 24.21.0, no browser. Full verify remains pending source review.

### rev-36 · 2026-11-19T06:46:23.866Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1575-source-1
commit: c5c6c0ed60c5301c9ae6ccd9d337d282953887ab
scope: full
findings: [{"severity":"medium","text":"The new native wrapper regression acquires fixture(t,true), writes setup files and launches the runner without a pre-acquisition whole-caller fence/join, root adoption or separately named setup bound. Directory/process teardown does not own late caller continuations, so timeout/abort can race writes or launch against root cleanup. Own original setup/native work and positive close before cleanup while retaining all wrapper/load/timing/budget/tier/progress assertions; limit changes to this new case and affected fixture path.","file":"hub/test/durations-runner.test.ts","line":86},{"severity":"low","text":"The legacy suite-start record still computes entryFile ?? file inline, duplicating the exported selector's preferred-field policy. Share raw field selection before relative/canonical formatting while preserving the absolute legacy record grammar (rule24); no current behavioral mismatch is asserted.","file":"hub/test/skip-reporter.ts","line":24}]
finding_counts: {"high":0,"medium":1,"low":1}

Full Standards/Spec source NOT CLEAR at clean pushed c5c6c0ed60c5301c9ae6ccd9d337d282953887ab/tree46101f3d7f8890ea164a62ee00f9b9e31c4e92b8, fixed base808a00be1. A-21625 records one medium and one low. Implementer44cb48e8 confirms no omitted owner/disposition for the new native wrapper callback; fix its original-work/setup lifetime proportionately before verification. Low: raw suite-start selection duplicates the new shared preferred-field rule. Otherwise four reporter identities, canonicalization/envelope distinction, concurrent wrapper/old-event checks, manifest keys and unchanged direct control were reviewed; docs agree. A-21623 expands raw/frozen/QA/tier consumer dispositions and corrects local invocation scope. A-21614/21623 retain source/helper red, wrapper/direct2/2, evolving full durations20/20, final wrapper1/1, quarantine18/18, unchanged durations23/23 and35 selected T1 cases, without broader coverage claims. The full duration run overlapped final test edits; partial loop shell0/break is not all-file execution, guard-refused attempts unexecuted, initial TS2345 failure preserved before final typecheck/lint passes. Per-run trees/native close facts/raw logs unavailable; no Reviewer runtime. C1 failed; C2/C3 done/unverified; nothing verified. This consolidated verdict releases the pin for corrections, checks and a fresh immutable-head source request before configured verification.

Criteria: C1 failed (The newly required real wrapper regression lacks whole-caller fixture/native-work ownership and a separate setup bound.).

### impl-1575 · 2026-11-19T06:54:03.478Z

Review corrections pushed at 6efcce8a7c4be10b27601fcf7389cde5d3778c3e (tree e58296347312ab5fa99c4209c92160ac17c609cf). New callback now uses suiteCase before acquisition with separate fixture setup and wrapper load gate completion deadlines; shared raw entry selector removes duplicate policy. Fresh typecheck and full test:lint passed; targeted wrapper 1/1, expanded 21 T1 files 295/295, case-deadlines T2 5/5. Exact serial commands/native exits/output and scope limits: A-21629. Prior local native full-file receipts remain earlier-source evidence, not a full final-head pass. Fresh review requested; configured verify pending. Pre-existing callback ownership debt filed separately by Coordinator as T-2000.

### rev-36 · 2026-11-19T06:58:21.463Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1575-source-2
commit: 6efcce8a7c4be10b27601fcf7389cde5d3778c3e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source2 clear at clean pushed 6efcce8a7c4be10b27601fcf7389cde5d3778c3e/tree e58296347312ab5fa99c4209c92160ac17c609cf, sole parent c5c6c0ed/no post-review dev merge. A-21630 records Standards/Spec closure of both source1 findings. suiteCase enrolls the new wrapper before acquisition, owns original fixture setup/source writes and native completion under distinct named observations, captures/adopts the late root before cancellation checks, and joins before captured teardown; incomplete drainage retains roots. Explicit native mode and every original wrapper/load/timing/budget/tier/progress assertion remain. reporterEntryFile now supplies both raw suite-start and normalized identities; concurrent-wrapper regression asserts the raw paths. No findings. A-21629 retains final frozen-working-source targeted wrapper1/1, full typecheck/lint exit0/zero refusals,21 pinned T1 files295cases and T2 case-deadlines5cases; table tiers/totals independently checked. Guard exit2 ran no misclassified T1 test; later explicit T2 run supplies its proof. Old312 arithmetic corrected, old native/full-file epochs remain distinct; no per-run trees/native close facts/configured/Linux/browser proof inferred. Existing legacy callbacks are separately filed T-2000. Reviewer performed no runtime or source edits. C1/C2/C3 remain done/unverified for exact-head configured wrapper and unchanged direct-control receipts. Hold released; Implementer may request the Coordinator's new mode-free verify window at this fixed head.

### rev-36 · 2026-11-19T07:23:22.939Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1575-evidence-1
commit: 6efcce8a7c4be10b27601fcf7389cde5d3778c3e
scope: evidence
findings: [{"severity":"medium","text":"Configured0c7a3e63/A-21648 fails the shared overlap oracle: status reply while first freshness batch is running, actualfalse/expectedtrue. Coordinator634ba642 attributes this to shared T-1952/T-1999, not T-1575, and posts bbdf60754 then8730aa5be. Preserve failed partial evidence; apply only the authorized one-file fix, check its exact blob, run the case/typecheck and obtain fresh source review before another window.","file":"hub/test/item-summary-scale.test.ts","line":140}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence NOT CLEAR at unchanged clean6efcce8a7c4be10b27601fcf7389cde5d3778c3e. A-21649 settles0c7a3e63-38d1-43ff-bd6a-64e1885dae48/A-21648 finished/failed, ownerexit1, runtime tree22e7ecb13d1429a6bd942b7e94eb91f84bf2c51b. Literal AssertionError at34884 is the overlap oracle, actualfalse/expectedtrue; case2.913070132s is not a measured latency. Coordinator634ba642 attributes to shared dev T-1952/T-1999, authorizes bbdf60754 then8730aa5be, exactly item-summary-scale.ts +6/-1 and matching final blob;3c1cd192 allows the single T2 case belowload12 after release, then typecheck/narrow identity review/new window. T0/T1 pass, T2 fail;6194base=6193pass/1fail plus220separateloadpasses explains owner6414completed. New two T1 reporter cases each pass base+5load, but required native wrapper/direct-control,44plannedT2files andWeb/laterphases unexecuted. Linuxx64 droplet Node24.21/Nv0.12.5, cachednull, browsernull; lifetime996111ms/cost$0.069174375 executor accounting;153.224s T0hoststep only. Budget/ratchet/lint129findings62files report-only, not causes. C1-C3 remain done/unverified; no criterion failed or verified because the failed case is a separately attributed shared defect and own native proof did not execute. No Reviewer runtime or new source finding. Hold released for the posted shared fix/checks and fresh source review; no same-head retry.

### impl-1575 · 2026-11-19T07:27:15.931Z

Coordinator-posted T-1999 shared fix applied after evidence hold release: bbdf60754 then 8730aa5be, local head396ad2dccc64f9ea139362b582332a52761e16e5. Delta against previous reviewed6efcce8a7 exactly hub/test/item-summary-scale.test.ts +6/-1; final blob abb2f4297723bf32095ed19168f8936d50e58f1e matches8730aa5be. Single instructed T2 case1/1 local Darwin arm64 Node24.21.0; full typecheck and full test:lint passed. Evidence A-21650; failed partial0c7a3e63 retained; fresh narrow review requested before new verify window.

### rev-36 · 2026-11-19T07:31:30.453Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1575-source-3
commit: 396ad2dccc64f9ea139362b582332a52761e16e5
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Narrow source delta CLEAR at clean pushed 396ad2dccc64f9ea139362b582332a52761e16e5/tree dc8cda8a52bee95afd79ac26447e3ff70239bdaf; A-21651. Coordinator-authorized bbdf60754 then 8730aa5be are local 1ed77b4ed then 396ad2dcc, with identical stable patch ids and the exact parent chain from source-clear 6efcce8a7. Sole file hub/test/item-summary-scale.test.ts +6/-1; final blob abb2f4297723bf32095ed19168f8936d50e58f1e matches 8730aa5be. No other source delta/dev merge. Response finally encloses client acquisition and releases the controlled first read; teardown release remains enrolled. Prior source2 remains the basis for unchanged T-1575 code. A-21650 retains single instructed T2 case 1/1, full typecheck/lint exit0 on committed head, local Darwin arm64 Node24.21; 129 findings/62 files report-only, no browser/configured pass claim. No Reviewer runtime. C1-C3 remain done/unverified; no marks added. Earlier 0c7a3e63/A-21648 remains failed/partial, including unexecuted native wrapper/direct-control and Web/later phases. This releases the source hold to request the Coordinator's new window; fresh exact-head configured acceptance receipts are still required.

### impl-1575 · 2026-11-19T08:02:28.443Z

Configured run 8bc534e9-e540-4195-8012-5de5e9036e6a passed at reviewed 396ad2dccc64f9ea139362b582332a52761e16e5, artifact A-21668. T0/T1/T2/changed T3/Web exit 0; 6950 passed, zero failed/cancelled/skipped. Positive wrapper progress-finish/timing at log lines 37111-37113; unchanged direct-registration control at 37116-37118. Linux x64 droplet c-8 ams3, Node24.21.0, Chrome Headless Shell / Google Chrome for Testing156.0.8078.4; lifetime1357s cost$0.0942. Other T3/T4 deferred as selected; report-only budget/lint notices retained. Earlier0c7a3e63 remains failed/partial. Reviewer notified for same-head final evidence settlement; source remains fixed.

### rev-36 · 2026-11-19T08:04:36.161Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1575-final-1
commit: 396ad2dccc64f9ea139362b582332a52761e16e5
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence CLEAR at unchanged clean/pushed396ad2dccc64f9ea139362b582332a52761e16e5; A-21670 (corrects A-21669 structured timing references to37112/37117). Run8bc534e9-e540-4195-8012-5de5e9036e6a/A-21668 finished/passed, auto exit0. C1/C2 native generated wrapper case has finish/pass37111 and timing/pass37112,2.412002301s; source assertions require wrapper load5/5, one ordinary timing, wrapper T1 report-only budget/tier lines, no helper attribution and five retained progress completions. C3 exact unchanged direct-registration callback matches original808 base byte-for-byte and passes37116/37117,2.220866946s, retaining expected planted flaky inner exit1 plus stable5/5/journal/overlap assertions. Complete T3 durations-runner20/20; one outer base execution, no outer repetitions. Both new T1 reporter cases base+five distinct load passes. Source3 remains current; no new source finding. Structured audit6950basepass=6805top+145nested,220separate loadpasses;723base file envelopes pass231T1/436T2/1selectedT3/55Web, no duplicate finish IDs or fails/cancels/skips. T0/T1/T2/changedT3/Web exit0; remainingT3 batch-deferred,T4 unexecuted. Provenance39810 exacthead/runtime tree63cdc5936a9dec4c7bcfe726c998657109b2be2b,cachednull,Linuxx64 6.8.0-147-generic Node24.21/Nv0.12.5,droplet c8ams3,actual HeadlessShell1248/ChromeTesting156.0.8078.4. Lifetime1357107ms/$0.09424354166666667 machine accounting;127.793s is T0host step only.129lint62files,budget/tier/ratchet/allowance suggestions report-only. Earlier0c7a3e63/A-21648 stays failed/partial at6ef and is not retroactively green. No Reviewer runtime/edits or new macOS native-cover claim. C1,C2,C3 verified; hold released.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-19T09:28:03.276Z

Merged 8431152db4252c852896053dcff283c439248590 onto dev.
