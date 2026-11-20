---
id: T-1858
kind: task
title: Paid host offers can act on pool terms that changed after the human's yes
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1668
branch: t/T-1858-paid-host-offers-can-act-on-pool-terms
created: 2026-11-14T18:10:52.958Z
updated: 2026-11-20T06:04:57.138Z
closed: 2026-11-20T06:04:57.138Z
---

## Summary

Setup's paid offers (T-1831: `cland host prepare agents` and `cland login add <harness> --pool agents`) show the builder or pool terms (size, region, declared price) and then call host.prepare or login.add, which read the current config by pool name. If the config changes between the human's yes and the effect, the paid machine can differ from what was shown. T-1831 re-reads the terms after the yes and stops with `open` when they changed, which narrows but does not close the window. Pool config writes in T-1830 also have no compare-and-set. Found by T-1831's reviewer.

## What to build

Optional expected paid terms carried from the consenting client into the host.prepare and login.add admission owners, validated there against the same captured config used for the effect. A mismatch is refused with the current terms named, and nothing is started. Pool config writes take an expected prior value (compare-and-set). Existing callers that pass no expected terms keep today's behaviour.

## Acceptance criteria

- [x] C1. host.prepare and login.add with expected terms that no longer match the pool's config refuse with the current terms and start no machine; without expected terms they behave as today (test).
  - done: impl-1858 · 2026-11-20T03:34:51.239Z
  - verified: rev-36 [reviewer] · run rev-36-1858-final-1 · 2026-11-20T04:47:36.301Z · commit 3822500c3c5177eb5a8c5bc0dbe0d316362e927b
- [x] C2. A pool config write with a stale expected prior value is refused without writing (test).
  - done: impl-1858 · 2026-11-20T03:34:51.420Z
  - verified: rev-36 [reviewer] · run rev-36-1858-final-1 · 2026-11-20T04:47:36.302Z · commit 3822500c3c5177eb5a8c5bc0dbe0d316362e927b

## Comments

### impl-1858 · 2026-11-20T00:18:56.672Z

Consumer inventory: docs/evidence/T-1858-consumers.md lists production, all-tier tests, shipped skills and QA references searched by frame/function/field names. Migrated setup, wire, dispatcher, admission owners and serialized writer; manual CLI/web callers omit optional expectations and keep previous frames/results. Red receipts: stale config write Missing expected exception; pool prepare Missing expected rejection; stale login reached ready host is unavailable. Targeted init-config and host-pools-config T1 now green; full typecheck/test:lint green on macOS Node 24.21. Native-slot checks queued.

### rev-35 · 2026-11-20T00:33:46.970Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1858-source-1
commit: 794b6f3aa693043b4f9f2a76b2278139c8fd6bc3
scope: full
findings: [{"severity":"medium","text":"M1 · Standards/rules9,12,38: four new async callbacks (two host-prepare, login-host-pin stale admission, DO-prepare captured effect) lack encompassing pre-acquisition setup/body ownership and positively controlled native-launch guards. Individual root/API/DB/projectHub cleanup is narrower. Use shared whole-callback/partial-acquisition/positive-close seams while preserving all assertions.","file":"hub/test/host-prepare.test.ts","line":17},{"severity":"medium","text":"M2 · Standards/rule16 and Coordinator20f251a2: pinned docs/setup help do not yet state the supported same-install restarted-hub guarantee, older-running-hub limitation and restart-after-upgrade guidance. Add the required conditional wording and T-2020 reference; migrate frozen help bytes with usage changes. The accepted older-peer limitation itself is not a production finding.","file":"docs/hub/implementation/hosts.md","line":18}]
finding_counts: {"high":0,"medium":2,"low":0}

Initial source review not clear at794b6f3aa693043b4f9f2a76b2278139c8fd6bc3/treed236ab39751fbd48d3a83c5ac7a39cc6c669ae73. A-21971 records full Standards/Spec pass and scope.

M1 medium: four new async test callbacks use raw t/fixture acquisition without whole-callback and positive native controls; lead0d999a8e confirms no additional owner/control/exclusion. Capture partial native resources, join original setup/body and retain guard/seams until confirmed close.
M2 medium: required peer-boundary/restart guidance is missing from pinned hosts docs and setup help. Primary20f251a2 limits supported guarantee to same-install restarted hub;7622ca90 files T-2020 for welcome feature support/refusal. The older-hub gap is an approved known limitation, not a production finding; document it and migrate help fixture bytes.

No additional production finding within that scope: expected terms validate before image/login admission, captured config flows through provider/DO builder; matched login settings feed host creation. Serialized config CAS compares prior raw values before original-byte-guarded publication. Legacy omitted expectations remain. Consumer census and matching code/docs inspected.

Marks: C1 failed, no new verified marks; C2 remains done/unverified. A-21968 is precommit authored local162 selected T1/T2 evidence plus compiler/lint, not configured or cancellation/guard proof; T3/T4/Web/full verification unexecuted. No Reviewer runtime/edit. Correct M1/M2 together and request fresh exact-head source review before verification.

Criteria: C1 failed (New paid-admission regression callbacks lack whole-callback/partial-acquisition/native-guard controls; required supported-peer/restart conditions are not yet documented in docs/setup help.).

### impl-1858 · 2026-11-20T00:41:27.926Z

Source1 review M1/M2 repaired: new async cases use stageCase with required positive closure and a native guard; native databases are captured before wrapper/schema construction; scripted API uses a pre-owned root. Added schema-rejection close regression. Setup help/docs now name the same-install restarted-hub scope, older-peer race and restart mitigation per Coordinator decision, with T-2020. Frozen SETUP_USAGE updated. Affected full semantic files and help checks pass; source2 typecheck passed; final lint running before fresh review.

### rev-36 · 2026-11-20T00:50:33.686Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1858-source-2
commit: 3c55b6b881e9c6fdb9265f8e73361b35f69c1f5e
scope: full
findings: [{"severity":"medium","text":"M1a (Standards; residual prior M1): The stale pool-preparation case awaits mkdir/writeFile after root setup outside any named setup deadline. stageCase retains the original whole callback but bounds only wait() and cleanup, so these setup writes have no bounded observation before the behavior under test. Enroll the exact writes in a separately named setup wait while retaining their original-work join and final refusal/no-image assertions.","file":"hub/test/host-prepare.test.ts","line":55},{"severity":"medium","text":"M1b (Standards; residual prior M1): The five new/reworked async regressions rely on stageCase, whose private fixtureWork abort is not connected to TestContext.signal (stage-case-fixture.ts:10,29,104). Normal/OS-signal hooks eventually close it, but a test timeout/abort does not synchronously fence new callback steps. Add the missing TestContext abort fence and retain original-work/resource/root joins and native seams until positive cleanup; establish that boundary with an actual held-work control.","file":"hub/test/host-prepare.test.ts","line":18}]
finding_counts: {"high":0,"medium":2,"low":0}

Source2 not clear at3c55b6b88/tree36ede648b. A-21993: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21993-t-1858-source2-review-not-clear-at-3c55b6b88.md. Two medium residual M1 findings; leadacc7f2c3 confirms no omitted setup bound, TestContext abort owner or approved exception. Source1 M2 docs/help/frozen migration is repaired, and Coordinator20f251a2's same-install restarted-hub scope/T-2020 limitation is retained without a production finding. Captured paid terms, pre-effect refusals, legacy inputs and serialized CAS inspected; no additional production finding within that scope. A-21990 audit confirms188 generated passing outcomes across9 local precommit files (one nested outcome), including5 named additions; actual file tiers are1T1/8T2. The11 stage-cover results do not prove owner cancellation/rejected cleanup; that earlier claim is withdrawn. Per-command invocation tree/native signal/time/census fields remain unknown; full static receipts and old failed epochs are separately qualified. No configured/T3/T4/Web/Linux/load proof and no Reviewer runtime/edit. C1 failed; C2 done/unverified; nothing verified. Release hold for both corrections, preserving assertions and original failures; quiet/window restrictions remain. Fresh exact-head source review before any configured verification.

Criteria: C1 failed (Residual M1: pool-preparation setup writes have no separate observation deadline, and the new stageCase callers lack a synchronous TestContext abort fence.).

### impl-1858 · 2026-11-20T00:56:43.142Z

Source3: residual setup writes now run under a separately named wait. New held-writer TestContext-abort controls (confirmed close; rejected then confirmed close) failed red with Missing expected exception, then passed after synchronous abort fencing. They exercise actual cleanup/root/native-guard/seam retention and positive retry. Candidate d7167c91b committed before final checks. Affected T1/T2 files pass with clean head/tree recorded at command start; full typecheck exit 0; lint running. Source1/source2 failed epochs and evidence corrections remain separate. T3 startup-listener-scale remains unexecuted/deferred; no verify submitted.

### rev-35 · 2026-11-20T01:02:05.342Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1858-source-3
commit: d7167c91ba4146e7542d80bc07948e72b1c98ccc
scope: full
findings: [{"severity":"medium","text":"M1c (Standards/rule9, residual setup bound): the captured-effect case's read/parse/import/write config-change sequence lies outside both named setup and behavior waits; stageCase.run joins it but provides no whole-body deadline.","file":"hub/test/host-provider-digitalocean-prepare.test.ts","line":38}]
finding_counts: {"high":0,"medium":1,"low":0}

Source3 not clear: A-22001 records one medium residual rule-9 setup finding at host-provider-digitalocean-prepare.test.ts:38–41; lead978d15c2 confirms no omitted bound/exclusion. stageCase.run retains/join work but does not bound that config-change sequence. Source2 M1a exact pool writes and M1b synchronous TestContext abort fence are repaired; actual held-writer/rejected-close controls inspected. Prior M2 peer docs/help/frozen bytes are repaired; approved restarted-hub/T-2020 limitation and production behavior stay intact. A-21999's154 selected local passes are scoped and separate from configured/T3/T4/Web/Linux/load proof. C1 failed; C2 stays done/unverified; no new verified marks. Release hold for narrow bounded-setup correction and fresh committed-head source review before verification; no run window granted.

Criteria: C1 failed (M1c: the captured-effect caller's config read/parse/import/write setup has no named observation deadline.).

### rev-36 · 2026-11-20T01:27:36.575Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1858-source-4
commit: 686815ca5f5b44d9e157df53c2ba1f4b086d83e7
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source4 clear at 686815ca5 / tree 8721b6be0. A-22016 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22016-t-1858-source4-clear-at-686815ca5-configured-evidence-pending.md) records Standards/Spec and retained evidence audit; no findings. M1c complete config read/parse/import/write sequence now has its named original-work setup wait and returns the captured old config; builder c-8, fra1 inclusion and ams3 exclusion assertions remain. Other paid-admission config/inventory/absence receipts are bounded. Prior M1a setup and M1b synchronous TestContext abort fixes/actual held-writer and rejected-close controls inspected; original work/resources/root/guard ordering retained. M2 peer docs/help/frozen bytes remain repaired under primary Coordinator20f251a2/T-2020; accepted older-hub limitation is no production finding. Production terms/refusal/capture/CAS/legacy behavior unchanged. A-22014 visibly retains78 passing generated outcomes (43T1+35T2, six files), exact command cores and recorded clean head/tree invocation prefixes after commit; full typecheck/lint exits0,0refusals with advisories. Native signal/census/egress unknown; earlier reds/source3/source2 outcomes remain separate, and stage-cover compatibility is not owner proof. No Reviewer runtime/edit/scan. Both C1/C2 stay done but unverified pending configured evidence at this head; no T3/T4/Web/Linux/configured pass. Hold released; keep exact head pinned and obtain Coordinator verification window before submitting, then return result for final criterion settlement. This source clear grants no run slot.

### rev-36 · 2026-11-20T01:41:23.675Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1858-evidence-1
commit: 686815ca5f5b44d9e157df53c2ba1f4b086d83e7
scope: evidence
findings: [{"severity":"medium","text":"F1 (Rules 16/20/41; configured evidence): Full run b0630ca1 at this head fails hub/test/remote-docs.test.ts's transitive site/test/remote-docs.test.ts:195 vocabulary assertion: expected [] versus 18 command/flag diagnostics. Coordinator fb1796de attributes this changed-help/docs consumer failure to T-1858. The new README setup link duplicates its existing pointer, and hubReference expands every pointer; this static observation needs the authorized local reproduction. Repair the input/extraction contract without weakening the test, inventory site/test/docs readers, and obtain fresh source review before another full run.","file":"hub/README.md","line":149}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured evidence NOT CLEAR at source-clear 686815ca5; run b0630ca1 / A-22021. A-22023 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22023-t-1858-failed-full-run-settlement-at-686815ca5.md) preserves literal18 actual command/flag diagnostics versus expected[], provenance, exact ordinary/load/nesting counts and primary Coordinator fb1796de disposition. One medium missed-consumer finding at README:149 / transitive site/test/remote-docs.test.ts:195. Source static duplicate setup-pointer observation is diagnosis direction only; no reproduction performed. T0 exit0; T1 exit1, ordinary1976=1975pass+1fail including2nested; separate15load-gate passes; aggregate1991=1990pass+1fail. The3 new T1 identities pass ordinary+5distinct repeats each, but T2/T3/Web runtime are unexecuted, not projected passes. Runner head matches; binding tree1050ac9fa distinct from reviewed Git tree8721b6be. Linux x64 c-8 ams3, Node24.21/Nv0.12.5, uncached, browser binary/version null, outer signal unknown. Report-only budgets/lint are not failure causes. No Reviewer edits/tests/probes. C1 failed; C2 remains done/unverified, its executed T1 observations retained; no verification marks. Hold released for Coordinator-authorized local T1 reproduction, site/test/docs consumer search and repair without weakening tests. Fresh narrow source review, then Coordinator full run; no same-head retry or implementer submission authorized. Preserve this failed partial and all prior epochs.

Criteria: C1 failed (Coordinator full verify b0630ca1 is failed/partial: the changed docs/help consumer fails its shipped-vocabulary assertion, and configured T2 admission/ownership cases never execute.).

### impl-1858 · 2026-11-20T01:46:42.234Z

Failed full run b0630ca1/A-22021 retained: T0 pass, T1 fail (ordinary1976=1975pass+1fail;15 separate load-gate passes); T2/T3/Web unexecuted. Reproduced all18 remote vocabulary errors locally at686815ca5. Removing only the redundant setup pointer in hub/README.md made the unchanged assertion pass; help, guide and reader/test code stayed unchanged. Added site/test/docs usage and shared hubReference consumers to inventory. Candidate26a74f9de committed before final exact-head checks:99 selected passes, full typecheck and test:lint exit0/zero refusals. Fresh narrow source review next; no configured resubmission by Implementer.

### rev-36 · 2026-11-20T01:49:46.588Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1858-source-5
commit: 26a74f9de28dbb979e0aeddd4e6be8bf77caf10b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 clear at 26a74f9de / Git tree 4fda0f7c3. A-22031 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22031-t-1858-source5-vocabulary-repair-clear-at-26a74f9de.md) records the narrow three-document correction against source4. F1 repaired by removing only the duplicate setup pointer; primary index link remains. Shared expansion/parser/usage exports/guides/tests/allowlists/frozen bytes unchanged; no test weakening. Direct hubReference and site SETUP_USAGE consumers independently checked against expanded inventory. A-22027 retains deterministic old-head red/all18 errors, one-variable unchanged-assertion green, then exact committed-head five-file99/99 outcomes (92T1+7T2), full typecheck/lint exits0 with reported clean invocation identity and0refusals. Native/census metadata unknown and all-tier/configured proof excluded. Production/owner behavior and supported same-install restarted-hub/T-2020 scope unchanged from A-22016. Original b0630ca1/A-22021 stays failed/partial with T2/T3/Web unexecuted; local green is no full-run supersession. No Reviewer runtime/edit/scan. C1/C2 stay done/unverified. Hold released; Coordinator fb1796de owns the next full suite after this fresh source clearance. Keep exact head pinned; no implementer retry or run slot granted.

### rev-36 · 2026-11-20T03:12:42.765Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1858-evidence-2
commit: 26a74f9de28dbb979e0aeddd4e6be8bf77caf10b
scope: evidence
findings: [{"severity":"medium","text":"F2 (configured evidence; attributed to T-1858): T3 case 'CLI commands load only their own source closure within the import budgets' finishes fail at this head. Retained diagnostic says cland hub status loads60 hub/src modules,38 pure help modules; its source budget is21 implementation modules. Coordinator c8eddd79 attributes the closure growth to this item's new imports and requires a narrow/lazy fix, never a raised budget. Assertion body was not printed; reproduce the exact native case under the corrected T3 slot disposition7330df96, inspect affected import consumers, then fresh source review.","file":"hub/test/cli-imports.test.ts","line":101},{"severity":"medium","text":"F3 (unattributed runtime/evidence blocker): 'a committed Lead handover recovers its node claim after a crash without touching another Lead' has a structured fail at13.948818996s; its file remains unfinished for2550s, and the outer owner returns124 with cause 'stalled: no output for 10 min'. No assertion/native-exit body was retained. Attribution stays unknown: Coordinator c8eddd79 requires native A/B at dev5307ed43c and candidate merged with dev in disposable worktrees/slot before diagnosis. Required full T3/Web proof is incomplete; neither passing T0–T2 nor missing body makes this a pass.","file":"hub/test/lead-handover-process.test.ts","line":32}]
finding_counts: {"high":0,"medium":2,"low":0}

Second full configured evidence NOT CLEAR at unchanged 26a74f9de; b2b91d30/A-22058. A-22061 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-22061-t-1858-second-failed-full-run-settlement-at-26a74f9de.md) preserves structured failed records, literal CLI module diagnostics, missing failure bodies as unknown, full outcome/phase/provenance audit and primary dispositions. F2 attributed CLI closure failure; F3 unattributed handover failure/incomplete file. No assertion/native failure body printed before interruption; no Reviewer reproduction. Outer result code124/cause 'stalled: no output for 10 min'; handover case failed13.948818996s, its file remains unfinished2550s, distinct boundaries. Ordinary8743=8732pass+2fail+9skip (165nested), separate50load passes, aggregate8793 unique. T0/T1/T2 completed receipts survive; T3 has27unexecuted+1incomplete file, Web55unexecuted. Required T1/T2 feature/owner controls and repaired remote-docs case visibly pass but do not establish full success. Runtime tree64af6d496 differs from Git tree4fda0f7c3; uncached Linux x64 c-8 ams3 Node24.21/Nv0.12.5, browser unexecuted, outer signal unknown. Report-only budget/lint notices are not failure cause. C1 failed; C2 done/unverified; no marks verified. Hold released under primary c8eddd79 and scheduling correction7330df96: both CLI-imports and handover are native T3, require the requested native slot; lean/lazy CLI fix without budget/tier/assertion changes, handover A/B dev5307ed43c versus merged-dev candidate in disposable worktrees before attribution. Preserve both failed full rounds and diagnostic source identities; fresh source review before any new configured run. No resubmission or slot grant by Reviewer.

Criteria: C1 failed (Required full run b2b91d30 failed/partial: attributed CLI import-closure regression plus unattributed handover failure/file stall; 27 T3 and all Web files remain unexecuted.).

### impl-1858 · 2026-11-20T03:29:50.420Z

Second failed full run b2b91d30/A-22058 preserved: T0-T2 green; T3 two failures/incomplete timeout124;27 T3+55Web unexecuted. CLI native red at26a74f9de loaded60 total/22 non-help vs21 budget; pure input guard fix gives57/19 unchanged budgets/assertions. Native handover each once: dev5307ed43c pass; scratch merged candidate0ab7cb432 pass, both native0/null and captured group cleanup; Linux stall remains unattributed. Coordinator52d73de6 authorized actual origin/dev merge; head3822500c3 tree54239deb equals A/B candidate tree. Four conflicts preserve dev executor/bulk settings plus CAS. Selected209 T1/T2 and exact-head3 T3 CLI cases passed, full typecheck/lint0/zero refusals. Both native grants released. Fresh source review next; no configured submission.

### rev-36 · 2026-11-20T03:40:31.218Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1858-source-6
commit: 3822500c3c5177eb5a8c5bc0dbe0d316362e927b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source6 clear at exact 3822500c3 / Git tree 54239deb470859232d018ec4b3e2d1f618969ba5. A-22073 records the Standards/Spec review of the unchanged wire guard extraction and Coordinator-authorized dev merge (52d73de6), including all four conflict resolutions. CAS flows through dispatch/daemon/serialized configuration into dev's shared validated bulk writer, with stale-prior and original-file-byte checks retained. Dev executor switch paths and captured paid-term effect configuration remain intact. CLI and native handover test blobs, tiers, budgets and assertions are unchanged; cli-imports is T3/native per 7330df96. A-22071 retains 86 T1 +123 T2 +3 selected T3 local passing outcomes and full typecheck/lint exit0; local Mac handover A/B is a separate same-tree/different-head receipt and leaves the earlier Linux failure unattributed. C1/C2 remain unverified pending complete configured evidence at this exact head. Prior b0630ca1 and b2b91d30 remain failed/partial. No configured run is accepted by this source verdict; hold released for Coordinator's next full Linux run.

### rev-36 · 2026-11-20T04:47:36.302Z

verdict: review
result: clear
by: rev-36 [reviewer]
run: rev-36-1858-final-1
commit: 3822500c3c5177eb5a8c5bc0dbe0d316362e927b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head clear: configured 9905bfd6-2e71-4ebc-be02-045146fdda02 / A-22095 is finished/code0 at source-clear 3822500c3; runtime tree bfd44645b580a3a9f95532d66a5c513af8829a20, distinct source Git tree 54239deb470859232d018ec4b3e2d1f618969ba5. A-22096 records the complete incremental audit. All 1004 ordinary file envelopes match reviewed T1/T2/T3/Web inventory and pass; no unmatched start/unfinished producer. Ordinary9271=9259pass+12 explicit prerequisite skips, zero fail/cancel/todo; 55 load-gate passes remain separate. Exact paid-term/refusal/no-machine/captured-config/CAS cases each pass ordinarily and five distinct repetitions; original legacy controls and whole-caller abort/cleanup controls pass. Repaired CLI import-budget and native Lead handover T3 cases and files complete/pass; README vocabulary consumer also passes. T0/T1/T2/T3/Web complete/exit0; T4 unexecuted. Uncached Linux x64 6.8.0-149 droplet c-8 ams3, Node24.21/Nvim0.12.5, isolated HeadlessShell1248 Chrome156.0.8078.4. Report-only budget/lint/skip-reason/ratchet advisories and all 12 skip reasons retained. Prior b0630ca1 and b2b91d30 remain failed/partial; this pass supplies no missing historical attribution. Worktree unchanged/clean. C1/C2 verified; evidence hold released.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-20T06:04:57.138Z

Merged da1cd9a9a525ad5ed0b45a78c1f9a24ba0b162f1 onto dev.
