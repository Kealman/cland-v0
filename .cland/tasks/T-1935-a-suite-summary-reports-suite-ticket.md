---
id: T-1935
kind: task
title: A suite summary reports "suite ticket lost" for a green run because it takes any log line starting "suite infrastructure:", including test fixture output
state: open
status: review
size: S
criterion_seq: 3
labels:
  - needs-triage
  - regression
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1576
topic: topic-1594
branch: t/T-1935-a-suite-summary-reports-suite-ticket
created: 2026-11-17T06:37:12.828Z
updated: 2026-11-17T09:05:30.918Z
---

## Summary

T-1850's verify 067aad91 (A-20707) passed: 6583 of 6583, T0, T1, T2 and Web exit 0, and the hub recorded it as passed. Its summary still read "auto exit 0; suite infrastructure: suite ticket lost; remover unknown". The line comes from a test fixture, not from the runner: hub/test/suite-command.test.ts:70 writes exactly that cause to a fake child's stderr, and the line reaches the run log (A-20707 line 28717, followed by the fixture's "still writing unrelated output"). hub/src/hub/suites.ts:179 then collects every line starting with `suite infrastructure: ` into the summary. Any test that prints such a line can make a green run look like an infrastructure loss, or hide a real one among false ones.

## What to build

The summary takes infrastructure causes only from the runner's own channel (the worker or result receipt), never from test output in the log, or it marks lines from inside a test file's output so they are excluded. Fixture tests can keep printing their planted causes.

## Acceptance criteria

- [x] C1. A run whose test output contains a `suite infrastructure:` line, but whose runner records no infrastructure cause, has a summary with no infrastructure cause (test).
  - done: impl-1935 · 2026-11-17T08:59:09.344Z
- [x] C2. A real runner-recorded ticket loss still appears in the summary with its cause (test).
  - done: impl-1935 · 2026-11-17T08:59:09.899Z
- [x] C3. The readers of the summary's infrastructure lines (heartbeat, digest, merge queue diagnosis, T-204 tooling) are listed with their dispositions (rule 20).
  - done: impl-1935 · 2026-11-17T06:49:14.058Z
  - verified: rev-36 [reviewer] · run rev-36-1935-source-2 · 2026-11-17T07:32:34.249Z · commit 84957a1bb9d8f57d3cedb45b9099db73f6b29ff8

## Comments

### coord · 2026-11-17T06:37:39.304Z

Added by impl-1850 (topic-1589): the contamination also reaches the typed droplet result. hub/src/executor/droplet/run.sh:18 greps the `suite infrastructure:` prefix out of suite.log into $run/cause, so result.json for 067aad91 carries code 0 with the fixture cause (no notRun; finished 06:35:33Z), while the log's real "Finished: exit 0" is at A-20707:38094. The fix covers both: run.sh:18 and hub/src/hub/suites.ts:179. Both should take the cause only from the runner's own channel. Note that run.sh comes from the running hub (run.ts:156), so the run.sh half takes effect only after a hub restart.

### coord · 2026-11-17T06:39:20.592Z

Since T-1576 landed (f9b490e17, which added the suite-command.test.ts infrastructure fixture), every run that includes that file reports this false cause. Second occurrence: T-1660's verify 92c9564f (A-20708 line 28547), green 6580/6580. It is a release-blocking annoyance, because each green verify now looks like an infrastructure loss. Prefer fixing it in this release before T-1931's hub restart, so the run.sh half ships in the same restart.

### impl-1935 · 2026-11-17T06:42:41.378Z

Rule 20 inventory (search suite infrastructure:, suiteInfrastructureLine, suiteCommandOutcome, suiteSummary and outcome/cause consumers across hub/src, hub/test all tiers, nvim, shared, docs, skills, qa): producers run-suite.ts/package ticket catch and suite-worker.ts direct loss; migrate optional dedicated cause receipt. Log readers run.sh, suite-command.ts, suites.ts summary, dispatch.ts incomplete classification migrate to receipt/outcome. Droplet RunObserver.status reads cause file; collect/result.json/local executor status, Suites persistence/cache/shard aggregation and shared/wire SuiteJob outcome retain existing shape. dispatch all three summary calls pass outcome. Heartbeat and digest consume saved job/outcome and rendered reports, unchanged. Merge queue diagnosis/cover policy consumes outcome/notRun, unchanged. T-204 tools consume published suite reports/artifacts; printed prefix retained only for real outcomes; raw fixture lines remain in full logs. Regression readers: suite-summary.test.ts migrate positive control to explicit outcome, suite-command.test.ts migrate planted cause to receipt while retaining stdout; executor-run.test.ts migrate positive fake producer and add old-runner missing-receipt controls. suite-close-component infrastructure aggregate controls, suite-soak-component legacy persisted shapes and suite-infrastructure classification remain compatible. No wire fields removed or added. Docs running.md and file-specific test guides will describe receipt provenance. No live DB accessed.

### impl-1935 · 2026-11-17T06:50:07.522Z

C1-C3 marked done. Targeted red/green evidence A-20718 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20718-t-1935-red-green-fake-runner-evidence.md. Local Darwin arm64 Node 24.21: summary T1 6/6, fake command T2 26/26, native fake transport selected 3/3, package old/new hosting selected 2/2; full npm run test:lint exit0 (0 refusals, 122 report-only findings/59 files), npm run typecheck exit0. Configured verify not run; neither full T3/T4 nor Web ran. run.sh deployment cannot be proven by task verify, which uploads the hosting hub source; fake tests execute branch script. Inventory correction: no T-204-specific tool script is shipped in this checkout; externally consumed rendered reports keep existing prefix only for recorded causes, raw log output remains unchanged. Awaiting Coordinator's dev-merge timing for three related landings before first source review.

### rev-36 · 2026-11-17T07:05:16.614Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1935-source-1
commit: b12cc929f04fa4ba047b7a1fec9ceedf43d24040
scope: full
findings: [{"severity":"medium","text":"Both new older-runner callbacks use raw fixture(t), then launch/result/readFile continuations outside a pre-acquisition whole-case owner. Resource cleanup alone does not fence/join caller work before normal/signal root disposal (rule12); nearby positive case already uses caseDeadlines/adoptRoot. Enroll both negative cases in the existing whole-case owner, capture/adopt roots and fence/join complete callbacks. Claimant7c61b2d3 confirms no earlier owner.","file":"hub/test/executor-run.test.ts","line":315},{"severity":"low","text":"The new fake output modes inherit raw await launched.promise without a separately named setup deadline or immediate rejection observer for result. Added writeSuiteCause can reject before spawn; the wait would not diagnose that boundary, and t.after observes result only later. Add prompt settled-outcome observation and a bounded setup wait, preserving existing fake-clock behaviour/assertions. Claimantab253fe6 confirms.","file":"hub/test/suite-command.test.ts","line":72}]
finding_counts: {"high":0,"medium":1,"low":1}

Standards1medium+1low/Spec0. A-20729 full pass b12cc929f/tree75aceb4b vs1e4bceff6 after Coordinator-authorized first-review merge26dd7423. M executor-run:315 two new negative callbacks rawfixture(t) lack whole-case owner, unlike positivecase; claim7c61b2d3 confirms. L suite-command:72 rawlaunched wait lacks separate setup bound/immediate result rejection observer; new writeSuiteCause can fail pre-spawn, claimab253fe6 confirms. C1failed,C2/C3unverified. Dedicated receipt/outcome source, child env deletion,3dispatchsummary callers, missing-receipt oldrunner and no-env newrunner semantics inspected; no wire shape change. C3all90originalhitpaths retained/expanded102 with tiers/executed/deferred/QA/T204boundary. Two C216allowances explicitlyapproved463c7e87,1.5×8.3948775/8.410832959 rounded12.6/12.7,expiry2026-11-24; assertions/nativebounds unchanged. A20718/25 premerge selected summaries/nativefake tests have original argv/cwd/counters but missingraw/signal/tree/childreceipts; A20721mergedheadfull lint/typecheck0/0refusals122reportonly, not runtimecarry. Hostinghub uploadsownrun.sh so fakeproof only untilrestart. No Reviewer runtime/compiler/lint/generator/probe/edit/retry/merge. Consolidate test fixes and request fresh clean-head source review before window.

Criteria: C1 failed (Two new older-runner negative native cases lack pre-acquisition whole-case callback ownership; resource cleanup does not fence/join launch/result/FS continuations before root teardown.).

### rev-36 · 2026-11-17T07:32:34.249Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1935-source-2
commit: 84957a1bb9d8f57d3cedb45b9099db73f6b29ff8
scope: full
findings: [{"severity":"low","text":"Both new older-runner callbacks now join/fence their whole lifetime, but fixture acquisition uses step() without a separately named owner.wait setup deadline. remote-fixture awaits initial tempProject/guard/provider/Git/file setup before later readiness bounds; step/run do not bound that work. Add a named setup wait around fixture acquisition while retaining the fixed owner. Claimant e9e0cf3a confirms; this is a diagnostic gap, not an outstanding lifetime-join defect.","file":"hub/test/executor-run.test.ts","line":317}]
finding_counts: {"high":0,"medium":0,"low":1}

Standards1low/Spec0. A-20742 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20742-t-1935-corrected-test-ownership-and-source-clearance.md covers clean84957a1b/tree240fa26f, direct childb12cc929f with only4test/guide changes and no dev merge; full production/102consumer audit A-20729 retained, production bytes unchanged. Both older-runner native callbacks now enroll shared normal/signal whole-case owner before acquisition, owner.fixtures/adoptRoot and complete fenced/joined launch/report/read callback; original code/cause/report/log/provider-release assertions intact. Fake T2 matrix immediately observes result rejection and bounds launch setup with captured live native5s timer, cleared before mocked behaviour ticks; old low resolved. Remaining low executor-run.test.ts:317: initial fixture setup is step-owned but lacks separately named owner.wait bound; claimant e9e0cf3a confirms, lifetime ownership is fixed. C3 static consumer inventory verified. C1/C2 await completed same-head configured evidence incl planted-output summary/fake negative-positive receipt modes and all3remote cause controls. A-20735 local corrected-source precommit26/26T2 and2/2native pair, exact-head lint/typecheck0 retain original source/raw/native/receipt limits; no configured/fullT3/T4/Web/browser/QA/provider/native-wall claim. Approved C-21612.6/12.7s entries, owner/dates/expiry unchanged. Hosting-source run.sh/restart requirement stays separate. No Reviewer execution/edit/merge/retry; source-1 failed verdict remains history.

Criteria: C3 verified.

### rev-36 · 2026-11-17T08:13:00.499Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1935-evidence-1
commit: 84957a1bb9d8f57d3cedb45b9099db73f6b29ff8
scope: evidence
findings: [{"severity":"medium","text":"The new incomplete-infrastructure check accepts only a cause beginning 'suite infrastructure: ', but shard aggregation records 'shard-2: suite infrastructure: ...'. A real infrastructure child beside a passed sibling therefore reports 'No tests executed.' and drops the completed summary. A-20758 has both live/restored-child regressions failed; Coordinator79916bfd attributes this missed consumer to T-1935. Use recorded per-shard infrastructure outcomes for classification and preserve completed receipts, without restoring authority to raw test output.","file":"hub/src/hub/dispatch.ts","line":1189},{"severity":"low","text":"Both new older-runner callbacks now join/fence their whole lifetime, but fixture acquisition uses step() without a separately named owner.wait setup deadline. remote-fixture awaits initial tempProject/guard/provider/Git/file setup before later readiness bounds; step/run do not bound that work. Add a named setup wait around fixture acquisition while retaining the fixed owner. Claimant e9e0cf3a confirms; this is a diagnostic gap, not an outstanding lifetime-join defect.","file":"hub/test/executor-run.test.ts","line":317}]
finding_counts: {"high":0,"medium":1,"low":1}

A-20769 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20769-t-1935-failed-aggregate-shard-evidence-and-partial-coverage.md records FAILED partial ed1b37be/A-20758 at unchanged 84957a1b. Spec1medium dispatch.ts:1189 rejects shard-prefixed recorded infrastructure causes, producing 'No tests executed' instead of 'Execution incomplete' and completed summary. Both suite-close-component aggregate variants fail with typed receipts28474/28479 and assertion excerpts33158–33205; Coordinator79916bfd attributes to T-1935 and authorizes structured per-shard fix/regression, full T2 close/summary/dispatch checks, aggregate-reader inventory, fresh source review/window. Retain source2 low native fixture setup deadline at executor-run.test.ts:317. C2failed; C1 remains unverified; prior C3 static inventory/history retained. Independent counts ordinary5867pass+2fail,607filepass+1fail;225loadtest/filepasses; combined6094completed/6092pass/2fail. T0/T1exit0/all224T1positive; T2exit1/383filepass/1fail/44no finish; T3/T4/Web unexecuted, browser null. Pure summary6 and fake command26 positives incl3exact5/5proofs remain partial, not native coverage. Provenance33358 Linuxx64Node24.21, effective tree6aaa2099 distinct Git240fa26f, cached:null. All102consumer dispositions retained,33positive/1failed/68reference-deferred. Budget/lint report-only; fixture contamination is not an extra native failure. No Reviewer runtime/reproduction/edit/retry/merge.

Criteria: C2 failed (Real shard infrastructure beside a passed sibling is reported as 'No tests executed' because the new cause-prefix consumer misses the shard-prefixed aggregate; both live/restored-child controls fail.).

### impl-1935 · 2026-11-17T08:15:51.422Z

Aggregate-cause consumer correction: Coordinator79916bfd attribution accepted. New pure summary regression red before fix (expected tests2/pass2 plus shard-2 cause, got counts only). Shared suiteInfrastructureCauses now traverses recorded child outcomes and adds labels for display, used by suiteSummary and dispatch incomplete flag (including periodic summary branch). All three dispatch summary calls supply shards. Parent cause string is no longer parsed for child information; regression also replaces aggregate description with opaque text and retains child cause. Full suite-close-component T2 (public dispatch reporting seam) 18/18 local Darwin pass, including both failed configured variants, summary7/7. No standalone dispatch.test.ts exists; close-component exercises production dispatch. Rule20 aggregate reader search: #collectShards intentionally renders prefixed cause; result read/persistence/cache preserve explicit notRun; merge diagnostic uses code/notRun and generic abort substrings, cover/dev-t3/heartbeat/digest and wire readers unchanged. suiteCommandOutcome remains for direct worker receipts; parent uses structured shards and notRun. Existing102-reader audit retained; focused57-line hit-set will be published with fresh preflight. Recorded low fixture setup bound remains as previously accepted; no native rerun or configured resubmission.

### rev-36 · 2026-11-17T08:45:10.637Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1935-source-3
commit: f290979e4418bfc5a1eaa70788deb2ec1ff3fe5a
scope: full
findings: [{"severity":"medium","text":"Pending work must satisfy new rule38. The fake-only matrix mocks expected spawn and callback execFile, but has no custom-promisify denial and no positively exercised guard that fails on every native launch. A green fake result or absent tier warning does not prove these routes are blocked. Use the shared fixture guard at each reachable callback/custom/native launch boundary and retain positive denial controls. Claimant de4dd55f confirms no omitted guard.","file":"hub/test/suite-command.test.ts","line":40},{"severity":"medium","text":"Pending work must satisfy rule42: readSuiteCause buffers the whole file via readFile before slicing4096. Producer-side truncation is not a read-time byte/memory bound. The raw uploaded status reader at executor/droplet/run.ts:236 similarly readFileSyncs the whole cause file. Bound both while ingesting, count retained bytes and handle the explicit incomplete/oversize boundary. Coordinator ead69ea6 authorizes the inherited reader as this item's eighth production file.","file":"hub/src/suite-infrastructure.ts","line":28},{"severity":"medium","text":"Rule39 requires preserving a selected primary outcome. After child close, readSuiteCause can reject on a non-ENOENT error; the worker catch then replaces the selected child code/cause with code1/error text. The worker cleanup catch at suite-worker.ts:120 also unconditionally sets code1, dropping notRun:infrastructure for a selected code75. Keep selected outcome metadata through read/cleanup failures and add secondary diagnostics; distinguish failures before selection. Claimant245c82b2 confirms no separate preservation owner or disposition.","file":"hub/src/suite-command.ts","line":177},{"severity":"low","text":"Both new older-runner callbacks now join/fence their whole lifetime, but fixture acquisition uses step() without a separately named owner.wait setup deadline. remote-fixture awaits initial tempProject/guard/provider/Git/file setup before later readiness bounds; step/run do not bound that work. Add a named setup wait around fixture acquisition while retaining the fixed owner. Claimant e9e0cf3a confirms; this is a diagnostic gap, not an outstanding lifetime-join defect.","file":"hub/test/executor-run.test.ts","line":317}]
finding_counts: {"high":0,"medium":3,"low":1}

A-20789 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-20789-t-1935-shard-correction-and-rules38-43-consolidated-source-findings.md pins clean f290979e/treecfb8d01b, two linear correction commits after84957a1b/no dev merge. Original shard-prefix Spec finding resolved: shared suiteInfrastructureCauses traverses recorded child outcomes, all3dispatch summaries pass shards??[], incomplete/periodic paths share it, parent wire/notRun unchanged; pure aggregate+opaque-parent and existing live/restored controls retained. New rules38–43 apply to this pending head per Coordinator01058b7b, independently read rule.list. Standards3medium+retained1low/Spec0: fake matrix lacks positively exercised callback/custom/native guard; readSuiteCause and raw uploaded run.ts:236 buffer complete cause files; selected outcome can be overwritten by ancillary read/cleanup errors. Claimants de4dd55f/245c82b2 confirm no hidden guards/caps/preservation. Coordinator ead69ea6 includes run.ts as eighth production file and authorizes consolidated fixes; eight-file limit, further findings separate items. C1/C2failed; no current criteria verified here. All104consumers/frozen fixtures/raw readers/tier-history dispositions retained. A-20776 original pre-final-typing summaryred6/7→green7/7 and closeT2 18/18, TS2379→corrected full typecheck0, exact-head lint0refusals122report-only retained with raw/native/tree limits. Old ed1b37be/A-20758 remainsFAILED PARTIAL, no pass or new configured/native/Web claim. Retained setup-deadline low accepted by Coordinator5f7cdd21; no exception for new mediums. No Reviewer runtime/probe/test/compiler/lint/generator/edit/retry/merge. Consolidate before fresh source review/window; already-cleared old heads are not retroactively judged by new rules.

Criteria: C1 failed (Pending work lacks rule38 positive callback/custom/native launch protection, and both local and uploaded cause readers lack rule42 ingestion bounds.), C2 failed (After selecting a child outcome, cause-read or worker cleanup failure can replace its primary code/cause and drop code75 infrastructure metadata, against rule39.).
