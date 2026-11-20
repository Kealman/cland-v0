---
id: T-1891
kind: task
title: Flaky-identity receipt and auto-quarantine
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by: []
topic: topic-1670
branch: t/T-1891-flaky-identity-receipt-and-auto
created: 2026-11-16T07:29:45.132Z
updated: 2026-11-20T05:17:45.481Z
closed: 2026-11-20T05:17:45.481Z
---

## Summary

A cover or batch whose only failures are open flaky-labelled identities, each passing 5/5 in a hub rerun at the same tree, closes with a receipt. The identity gets a dated `hub/test/quarantine.json` entry (the mechanism exists; the file is empty). Merges impl #3 and §7 #1 option 3.

Kind: product. Triage ticket H-3 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Decision change

changes the flaky rerun rule (human 2026-10-15) and T-469's green-cover stage gate. The human approved this change on 2026-11-16 at 07:25Z (ask 8e3dd5ab, triage A-19813).

## Acceptance criteria

- [x] C1. A cover whose only failure is a filed flaky identity passing 5/5 in a hub rerun at the same tree records a green-with-receipt outcome that the stage gate accepts (test).
  - done: impl-1891 · 2026-11-20T02:19:53.782Z
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-1 · 2026-11-20T03:24:18.472Z · commit a81476f5aada7a43120dd1b591e16ce08d0f3f98
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-2 · 2026-11-20T04:05:10.496Z · commit 430d950371bee8bb5d43e6839a6ec40390f6b3ce
- [x] C2. An unfiled failure, or one that fails any rerun, keeps the run red (test).
  - done: impl-1891 · 2026-11-20T01:40:48.331Z
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-1 · 2026-11-20T03:24:18.472Z · commit a81476f5aada7a43120dd1b591e16ce08d0f3f98
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-2 · 2026-11-20T04:05:10.497Z · commit 430d950371bee8bb5d43e6839a6ec40390f6b3ce
- [x] C3. Each excused identity gets a quarantine entry with an owner item and an expiry of at most 7 days, and an expired entry fails the manifest lint (test).
  - done: impl-1891 · 2026-11-20T01:40:48.660Z
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-1 · 2026-11-20T03:24:18.473Z · commit a81476f5aada7a43120dd1b591e16ce08d0f3f98
  - verified: rev-35 [reviewer] · run rev-35-1891-evidence-2 · 2026-11-20T04:05:10.497Z · commit 430d950371bee8bb5d43e6839a6ec40390f6b3ce

## Dependencies

none; `merge-batches.ts` (already has "flaky failing files" repeats at :346), `suite-quarantine.ts`, tracker stage cover

## Comments

### impl-1891 · 2026-11-20T00:16:26.072Z

Contract consumers (rule 20/41): suite-quarantine.ts and suite-shards.ts own manifest grammar/lint; quarantine-reporter.ts and quarantine-runner/quarantine/tier-tripwire tests consume it. Suites owns persisted jobs, stageCovers/stageMissing, result/cache/baseline projections and scheduler reruns; suite-cover derives cover incidents; batch-flakes and merge-batches own existing flaky-repeat diagnosis. dispatch wires tracker lookup, reports and publishes frames; tracker.ts and stage-candidates.ts consume stage cover trees. protocol.ts/shared/wire/index.ts and wire-conformance.ts retain old wire shape with optional receipt. CLI hub.ts/suite.ts and usage/suite.ts show cover status/help; frozen commands.json pins exact help bytes. suite-stage-rules, suite-stage-cover, stage-cover-fixture, stage-closure-component, suite-persistence, suite-cover, suite-candidate, suite-accounting, merge-batches, soak-quarantine and dev-t3-result tests/producers need assessment. nvim/web have no direct cover-status consumers; generic wire transport keeps optional additions. Existing QA E-468/E-678/E-387 and stage-cover QA briefs assert explicit run/tree/platform receipts and remain valid (no weakening platform/coverage/QA gate). Startup probes contain no direct cover outcome parser. Skills implement/merge and hub README/docs agents tests/running describe flow and need updated receipt policy. Full-field/name search includes raw exact outcome.code checks; unchanged native-exit cache, coverage and periodic baselines deliberately remain conservative (a receipt must not invent raw green execution).

### rev-36 · 2026-11-20T00:43:09.680Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1891-source-1
commit: f246200d3ce2a7bad9f77503d7f303801f6fd866
scope: full
findings: [{"severity":"medium","text":"P1 (Spec; C1): Flaky reruns re-resolve verificationCommands instead of admitting and checking the failed run's recorded command/step plan. Root fallback or interpolation changes at the same candidate tree can supply different-command greens; the default all diagnostic also omits an original stage T4 step, so that required successful path cannot execute. Pin the original failing steps/commands and bind acceptance to those receipts.","file":"hub/src/hub/suites.ts","line":1955},{"severity":"medium","text":"P2 (Spec; C3): Retained automatic evidence never reaches expiry lint. Creation validates a newly dated manifest, while greenWithReceipt and cached stage admission keep accepting the retained receipt without lintQuarantineManifest; suite-shards validates only the tracked manifest. Implement the required evidence-manifest lint path, including expiry across reopen/cached stage projections.","file":"hub/src/hub/suite-cover.ts","line":10},{"severity":"medium","text":"S1 (Standards; acceptance tests): New stage callbacks and new/reworked batch callbacks use raw TestContext -> suiteUnit/fixture without a whole-caller normal/signal admission fence and join, separately bounded setup, or positively controlled native-launch guard. Partial resource/submission cleanup does not own raw continuations through timeout, teardown and mock restoration. Use the established guarded caller owner and preserve final assertions (merge-batches.test.ts:149,456,479,514,1193,1407; suite-stage-rules.test.ts:9,38).","file":"hub/test/suite-stage-rules.test.ts","line":9},{"severity":"low","text":"S2 (Standards; rule 16): The declared merge-skill consumer still documents one original-tree repeat without the new filed five-round receipt policy or durable-evidence/Coordinator landing flow. Migrate that admission/diagnosis paragraph and record the kept skill's provenance change.","file":".agents/skills/merge/SKILL.md","line":32}]
finding_counts: {"high":0,"medium":3,"low":1}

Source not clear at f246200d3 / tree2cdeb609d. Full read-only review and retained-evidence audit: A-21980, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21980-t-1891-source-review-not-clear-at-f246200d3.md. Spec findings P1/P2 and Standards findings S1/S2 are recorded below with exact locations. Lead957df0e2/86a1787a/8f573b55 and A-21976 confirm the gaps; no omitted owner or approved exception. C1/C3 failed, no criteria verified; C2 remains unverified. A-21976 preserves the 103-file/1135-pass local T1 receipt, all nine named acceptance outcomes, separate failed/pre-final-source epochs, final full typecheck/lint completion excerpts, source-order association and unknown per-check tree/native signal/time metadata. Selected CLI-help T2 is summary-only; configured T0/T3/T4/Web/Linux/QA have not run. No test/probe was executed during review. Native absence is unproved and the earlier contrary claim is withdrawn. Release the source hold for all four corrections together; quiet/window restrictions remain, fresh exact-head source review is required before verification. Coordinator full verify-all-before-merge disposition retained.

Criteria: C1 failed (Reruns do not pin/validate original commands and failing steps; stage T4 cannot execute through the default diagnostic plan, and acceptance callers lack required lifetime/guard ownership.), C3 failed (Automatic retained evidence is linted only when newly created; no expiry-lint path enforces retained evidence admission.).

### impl-1891 · 2026-11-20T01:41:27.247Z

Repair head 48e32228ebdca0d4f0fc4f035b064305c13691d4, tree a5f088c4d8f469af6771ff4ffa66e23a189d09cd: all four source findings addressed. Final exact-head command ran 112 T1 files plus CLI-help T2, 1228 generated outcomes passed, no fail/cancel/skip/TODO. Full typecheck and full test:lint passed (zero refusals, existing report-only advisories). A-22022 retains exact invocation/tiers/outcomes, original repair failures and previous-head successes separately, native unknowns and consumer dispositions. Fresh full source review requested from Reviewer; configured verification, actual Linux, full T0/build, T3/T4, Web browser and QA remain unexecuted. No dev merge after first review and no verification submitted.

### rev-35 · 2026-11-20T01:47:05.266Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1891-source-2
commit: 48e32228ebdca0d4f0fc4f035b064305c13691d4
scope: full
findings: [{"severity":"medium","text":"P3 (Spec/Coordinator b99535ad): filed Web failures can reach five passing reruns then throw in hub/nvim-only manifest lint. Implement the newly required named red Web exclusion, no manifest attempt, a 5/5-but-red control and matching help/docs scope.","file":"hub/src/hub/suites.ts","line":2004},{"severity":"medium","text":"S1a residual: settled fixtureWork does not prove Suites/API/Store closed. After a resource cleanup rejection, suiteCase can restore the native guard/mocks without a positive resource-close fence.","file":"hub/test/suite-case-fixture.ts","line":21},{"severity":"medium","text":"S1b residual: Store construction precedes registration of its partial closer, leaving an opened DB unowned if initialization throws before the constructor returns.","file":"hub/test/suite-unit-fixture.ts","line":103}]
finding_counts: {"high":0,"medium":3,"low":0}

Full source2 not clear; A-22026 records three medium findings. P3: filed Web identity can reach5/5 then throw in hub/nvim-only manifest lint. New primary Coordinator b99535ad explicitly excludes Web and requires named red reason/no manifest attempt, control and help/docs scope; pinned source lacks that behavior. S1a: suiteCase settlement drain does not positively fence guard/mock restoration after resource-close rejection. S1b: suiteUnit constructs Store before a pre-constructor DB owner exists. Lead3b17c51e confirms both ownership gaps. Prior P1 command/producer/T4/shard binding, P2 retained expiry/cache/reopen publication and S2 merge-skill/provenance are repaired. A-22022's113 files/1228 generated passes/static logs remain selected local evidence, not actual Linux/T3/T4/configured or exceptional cleanup proof. C1 failed; C2/C3 stay done/unverified, no new verified marks. Hold released for one correction preserving assertions/evidence, fresh committed-head review before verify. Coordinator full verify-all-before-merge requirement stays; no run slot/window granted.

Criteria: C1 failed (Residual S1: resource-close rejection can restore guards/mocks and Store construction lacks a captured DB owner; newly decided Web exclusion lacks named red handling/docs/control.).

### impl-1891 · 2026-11-20T02:05:47.153Z

Source-review repair consumer audit: suiteUnit/openDatabase/close/reopen and suite-unit-fixture imports searched across hub,nvim,web,QA,docs and skills. Direct consumers: merge-batches, merge-batch-dependencies, suite-{stage-rules,cache,accounting,task-selection,remote-log,remote-budget,log-backfill,bundle-native,duration-budget,queue-policy,progress,scheduling,queue,persistence,landed-load,soak,soak-component,hung-component,cover,coordinator,retention-fixture}, dev-t3-{search,search-component,coverage-component}, executor-run-rules, verification-commands, durations, test-lint-policy; web/test/record-verification.ts and docs/hub/suite-run-references.md read source/receipts. Existing call signatures remain compatible; only T-1891 callbacks opt into outer-root ownership and delayed manual patch restoration. No suiteCase helper change (T-2022). All suiteUnit callers receive pre-constructor native DB capture and success-only/retryable close phases. New Web disposition uses the existing persisted flaky.rejected field; dispatch and retained semantic logs show its structured reason. Shared identity grammar remains hub/nvim-only and lint uses that same parser. Public wire shape unchanged; stage/batch/CLI/readers from the earlier audit remain consumers, including old receipt binding regression.

### impl-1891 · 2026-11-20T02:22:14.814Z

Fresh full source review requested from Reviewer at a81476f5aada7a43120dd1b591e16ce08d0f3f98 / tree07aba665eb01a4b8fbe77b5df601c918acd02b9d; hub assigned rev-35. C1–C3 done. Same-head selected local Darwin arm64 evidence: A-22041, 112 T1 files + CLI-help T2, 1232 generated passes, no failure/cancellation/skip/TODO, all red/fixture-error epochs retained. Final same-head full typecheck and full test:lint exit0: A-22043, zero refusals; existing duration/condition/reachable and installation advisories remain report only. Worktree clean. No dev merge since first review; no configured verification, actual Linux, full T0/build, all T2, T3/T4, Web browser or QA. Await source verdict before asking Coordinator for a verify window; required Coordinator full verify-all-before-merge remains.

### rev-35 · 2026-11-20T02:25:31.686Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1891-source-3
commit: a81476f5aada7a43120dd1b591e16ce08d0f3f98
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source3 clear; A-22047 records Standards/Spec pass at a81476f5aada7a43120dd1b591e16ce08d0f3f98/tree07aba665eb01a4b8fbe77b5df601c918acd02b9d. P3 fixed through shared hub/nvim grammar and durable named red Web refusal/no manifest after5/5, with cover/batch controls and matching help/docs/skills/frozen bytes. S1a fixed at T-1891 call sites by outer fenced cleanup/root ownership and manual patches retained until positive resource close; S1b pre-owns captured SQLite before Store constructor, with confirmed/retryable cleanup steps. Actual registered DB rejection/repair/root/seam controls inspected. Prior original-command/T4/whole-test/shard binding, expiry/cache/reopen/publication and all landing/refusal assertions preserved. No findings. A-22041's1232 generated selected passes and A-22043 final static exits0 remain local/scoped; no configured/Linux/T3/T4/browser proof inferred. C1–C3 done, all run-dependent verified marks pending configured same-head evidence. Hold released for Coordinator-granted mode-free verify; full verify all before merge requirement remains. No Reviewer runtime/source change.

### impl-1891 · 2026-11-20T03:23:03.640Z

Coordinator full verify all fb4501df-29fe-4b41-8389-0fa2721857ae completed exit0 at reviewed a81476f5aada7a43120dd1b591e16ce08d0f3f98 / tree07aba665eb01a4b8fbe77b5df601c918acd02b9d. Durable log A-22065. Completed T0 host check and runtime T1/T2/T3/Web; 9254 tests:9242 pass,0 fail,0 cancelled,12 skipped,0 TODO. T4 unexecuted. Runtime droplet c-8 ams3, Linux x64 6.8.0-149-generic, Node24.21.0, Neovim0.12.5, workers2; lifetime3233s, cost$0.2245. Web owner receipt names chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Existing duration, lint and T3 ratchet diagnostics remain report only; they are not extra passing evidence. Worktree rechecked clean/unchanged after the run. Awaiting Reviewer same-head criterion settlement; no new source review request, no resubmission, no dev merge.

### rev-35 · 2026-11-20T03:24:18.473Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1891-evidence-1
commit: a81476f5aada7a43120dd1b591e16ce08d0f3f98
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear; A-22068 audits Coordinator full fb4501df/A-22065 at a81476f5aada7a43120dd1b591e16ce08d0f3f98. C1 filed cover/batch five-round receipt+stage/landing, C2 all unfiled/non-pass/wrong-metadata and named Web refusals, C3 owner/date/expiry/cache/reopen/publication, and positive cleanup/constructor controls all pass. Each21 new identity has ordinary pass plus5 distinct passing load receipts. Producer pairing unique:9242 ordinary passes/12 explicit skips/0fail/0cancel plus1002 file passes;105 separate load tests+105 envelopes. T0/all234T1/441T2/272T3/55Web complete;18T4 unexecuted, simulated T4 fields not native proof. Skips name missing macOS tools/OpenCode/zsh. Linux x64 c-8 ams3 Node24.21/Nvim0.12.5, HeadlessShell1248/Chrome156, cache:null; canonical treeffebc29e distinct from Git tree07aba665. Advisories report-only; accounting/case/phase timings separate. Verify C1–C3, no findings; full verify-all-before-merge requirement fulfilled. No Reviewer runtime/source changes.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1891 · 2026-11-20T03:26:28.791Z

Coordinator 95efb317 authorized post-ready origin/dev merge after T-1898 help conflict. Merged dev5307ed43c664df534e546ebc64215807d1c162b7 into a81476f5a as430d950371bee8bb5d43e6839a6ec40390f6b3ce / tree5014a110672a5cc0c124ba0cf18fad0821af70c8. Only manual conflicts were SUITE_USAGE and frozen commands.json; resolution preserves both scoped-flaky/Web-refusal text and live verify-executor command. Automatic core/docs/fixture changes are upstream landings. Both requested CLI files passed at the merge head; all reachable T1, typecheck and full lint in progress before narrow merge review. No new verify or enqueue submitted; original full runfb4501df remains evidence for its original head, not this merged head.

### impl-1891 · 2026-11-20T03:30:05.608Z

At clean pushed merge430d950371bee8bb5d43e6839a6ec40390f6b3ce/tree5014a110672a5cc0c124ba0cf18fad0821af70c8, both requested CLI files passed10 tests;111 additional reachable/raw-reader T1 files passed1231, with no overlaps and all graph unknowns included. Full typecheck and full test:lint exit0, zero refusals/764 report-only findings. Local Darwin arm64/Node24.21.0, no browser; no current-head configured/T3/T4/Linux/QA claim. A-22070 retains exact commands, generated outcomes and merge parents; original A-22065 full run remains original-head evidence. Narrow merge review sent to rev-35 per Coordinator95efb317, awaiting verdict before requesting mode-free task verify window. No enqueue.

### rev-35 · 2026-11-20T03:38:41.271Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1891-source-4
commit: 430d950371bee8bb5d43e6839a6ec40390f6b3ce
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge delta clear; A-22072 records integration at430d950371bee8bb5d43e6839a6ec40390f6b3ce/tree5014a110672a5cc0c124ba0cf18fad0821af70c8, parents a81476f5a + authorizeddev5307ed43c. Primary95efb317 permits merge and prescribes mode-free follow-up. Both scoped-flaky/Web refusal and T1898 live-executor help retained; frozen bytes exactly match. Task-only/upstream-only files preserve each parent, no extra paths. Overlapping Suites/fixture/protocol/docs inspected; pinned command/expiry/quarantine/outer ownership methods remain unchanged, incomplete/new resource outcomes supply no extra passing repeat. A-22070's1241 local generated passes/static exits0 remain scoped; no current configured/Linux/T3/T4/browser proof. No findings or criteria newly verified. Original fullfb4501df/A-22065 remains a814-only; current marks await same-head mode-free task verify, with integratedT3 in merge batch under newerprimary plan. Hold released; Coordinator owns window/enqueue, lead must not enqueue. No Reviewer runtime/source edits.

### impl-1891 · 2026-11-20T03:41:00.745Z

Authorized mode-free task verify submitted once at reviewed merge430d950371bee8bb5d43e6839a6ec40390f6b3ce:265f426b-cc23-4e4d-9639-32886eebe8e0, CLI exit0/admission receipt. Durable local host T0 receipt observed:exit0,duration48.365s. Coordinator window released per1bc9a595. Tree remains clean/unchanged. Runtime phases/results still pending; no resubmission and no enqueue.

### impl-1891 · 2026-11-20T04:04:02.997Z

Mode-free task run265f426b-cc23-4e4d-9639-32886eebe8e0 completed exit0 at reviewed merge430d950371bee8bb5d43e6839a6ec40390f6b3ce/tree5014a110672a5cc0c124ba0cf18fad0821af70c8. A-22084 is the durable log. Host T0 plus runtime T1/T2/Web and selected T3/T4 completed;7154 tests:7151 pass,0fail,0cancelled,3reported skips,0TODO. Remaining T3 is deferred to merge batch, not passing coverage. Runtime droplet c-8 ams3 / cland-v0-0489076f / Linux x64 6.8.0-149-generic / Node24.21.0 / Neovim0.12.5 / workers2; lifetime1357s,cost$0.0942. Web native receipt names chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell, Google Chrome for Testing156.0.8078.4. Budget/lint diagnostics remain report only. Worktree rechecked clean and fixed at this head. Reviewer has the result for final same-head settlement. Original fullfb4501df remains original a814-head evidence; no rerun/resubmission, no enqueue.

### rev-35 · 2026-11-20T04:05:10.497Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1891-evidence-2
commit: 430d950371bee8bb5d43e6839a6ec40390f6b3ce
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear at merged head430d950371bee8bb5d43e6839a6ec40390f6b3ce, C1/C2/C3 verified; no findings. A-22086 audits same-head run265f426b/A-22084 and current delta source A-22072 under Coordinator95efb317's mode-free plan. All21 required filed/refusal/expiry/ownership generated identities have one base pass plus five distinct passing load receipts; exact names/base lines recorded. Additional owner/reason/seven-day/expired-manifest control passes6286 and atomic publication control6281. The tested source assertions prove stage/batch green-with-receipt for eligible exact identities, retained red for unfiled or invalid reruns, and dated owner entries with expiry refusal. 8100 unique start/finish pairs match: base7151pass/3macOS-sandbox skips/0fail,736file passes; load105test+105file passes. All236T1/441T2/55Web files complete; selectedT3 roles/verify-prepare/NeovimQA and mappedT4 executor-safety-load once complete. Other269T3 batch-deferred and17T4 unexecuted. T0 exits0; host typecheck not repeated remotely. Linuxx64 c-8ams3 Node24.21/Nvim0.12.5, cached:null, HeadlessShell1248/Chrome156.0.8078.4; advisories report-only. Canonical tree52796c7c distinct identity kind from Git5014a110. Earlier full A-22065 remains bound to a81476f5; no current-head fullT3 claim or new execution by review. Hold released; Coordinator retains enqueue authority.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-20T05:17:45.481Z

Merged 0763a463f67b97aa97c09f09b6d3ca1a0296d059 onto dev.
