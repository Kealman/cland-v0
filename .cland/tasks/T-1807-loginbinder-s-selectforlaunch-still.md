---
id: T-1807
kind: task
title: "LoginBinder's selectForLaunch still walks rejected reader-intent history: reuse the maintained capacity eligibility"
state: closed
status: done
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1884
blocked_by: []
topic: topic-1631
branch: t/T-1807-loginbinder-s-selectforlaunch-still
created: 2026-11-10T23:04:20.883Z
updated: 2026-11-18T22:36:10.743Z
closed: 2026-11-18T22:36:10.743Z
---

## Summary

`selectForLaunch`'s candidate query, used by `LoginBinder`, still visits matching rejected reader-intent rows. A-18500's raw run recorded about 2000 visits on a synthetic corpus before T-1784 extracted `heldForLaunch`. T-1784 made the scheduler's verdict path bounded, but deliberately left the selection body unchanged (Coordinator decision 7bbdaa44), so the launch-time bind can still walk that history.

## Context

Found by impl-1784 during T-1784, 2026-11-10. No timing or slowness claim beyond the measured work count. T-1784 adds the maintained `pending_bindings` counter and a partial capacity index that a fix can reuse.

## Acceptance criteria

- [x] C1. `selectForLaunch` decodes at most a bounded number of rows on a synthetic corpus of 10,000 retained logins and reader intents, shown by decode-count and query-work controls (test).
  - done: impl-1807 · 2026-11-18T19:39:49.898Z
  - verified: rev-35 [reviewer] · run rev-35-1807-evidence-2 · 2026-11-18T20:11:35.356Z · commit 0e260885b61a2e6d7c8ac5bb0f8c18340ad6f7bc
- [x] C2. The selection order (account, then name) and the T-1778/T-1786 selection contract are unchanged: their selection tests pass unchanged (test).
  - done: impl-1807 · 2026-11-18T18:47:33.475Z
  - verified: rev-35 [reviewer] · run rev-35-1807-evidence-2 · 2026-11-18T20:11:35.356Z · commit 0e260885b61a2e6d7c8ac5bb0f8c18340ad6f7bc

## Comments

### impl-1807 · 2026-11-18T17:45:45.314Z

Consumer inventory (rule 20): repository-wide search for selectForLaunch, heldForLaunch, login_ready_launch and login_reader_launch. Production selectForLaunch caller/result reader: LoginBinder.#prepare in hub/src/host/login-binding.ts reads held login/binding phase and ready Login; no wire/result shape changes. Direct test callers: hub/test/login-selection.test.ts (ready/key/held selection and migration), new login-capacity regression. Index consumer outside selection: LoginRecords.signedOut (login_ready_launch state prefix), covered by login-records.test.ts and login-signed-out tests/docs. Existing binder contracts: login-binding.test.ts, login-exclusive.test.ts, login-exclusive-native.test.ts; unchanged. Documentation/fixtures: docs/hub/logins.md, per-file login-selection/login-capacity/login-signed-out guides, qa/briefs/E-1535-stage-2.md (historical source assertion), E-1535-stage-3.md follow-up. No shipped skill, startup probe, raw socket/client reader or frozen help fixture consumes this private method/result. No reply/schema contract change; public Login and selection result shapes unchanged. Reusing maintained eligibility in existing indexes per Coordinator decision 4493ce37.

### rev-36 · 2026-11-18T18:20:05.751Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1807-source-1
commit: dd00cc584eca4ceaecad8703d21beb288cae760d
scope: full
findings: [{"severity":"medium","text":"Spec/C2: full capacityEligibleSql also excludes ready disks with null volumeId, so an earlier null-volume row is skipped for a later valid row where the old LoginBinder refused before provider acquisition. insert/transition allow that state. Coordinator67e95dbb directs pending-counter-only equality, preserved selection/refusal and an earlier-null-volume equivalence regression; update matching docs.","file":"hub/src/host/logins.ts","line":378},{"severity":"medium","text":"Standards/rule38: the new in-memory T2 regression has SQLite cleanup via ownMetadata and tracing via sqliteProbe, but no positively exercised native-launch guard across setup/body/DB cleanup and restoration. Author confirms no omitted guard/disposition. Use the existing owned guard pattern, retaining all SQL work/decode controls; no unrelated provider/process/lease fixtures are needed.","file":"hub/test/login-capacity.test.ts","line":225}]
finding_counts: {"high":0,"medium":2,"low":0}

A-21344 full first source review at dd00cc584eca4ceaecad8703d21beb288cae760d/tree0753c508aaf0a931cd879abe3065fba7b001ab47 vs fixedd7050e7e2c210bed4210cd16d37eb576192a1f09. Clean matchingorigin,6files. NOT CLEAR: Standards1medium/Spec1medium,nohigh/low. Author87b412e2 confirms reachable ready null-volume/no specific exemption and no guard. Coordinator67e95dbb explicitly narrows equality key/query to maintained pending counter, preserving old null-volume selection and binder refusal; add equivalence regression. Shared state/index prefix, held/key branches, maintained triggers, savepoint migration and intended ordering otherwise inspected positively. Approved4493ce37 one-time rebuild/timing scope retained; T1952 separate. Exact C2 fixture exception b563a662 checked: selection file1added/0removed earlyDROPindex line104; capacity migration same setup at202; all oldtitles/assertions unchanged. New work/decode/oldSQL/migration controls are source-only and unexecuted, not positive receipts. All T1/T2/T3 consumers and QA scopes listed with unexecuted dispositions; publicshape/help/wire/frozen unchanged. A21338/requestreport fulltypecheck/lint0refusals on localmacOSNode24.21 with advisories; no Reviewer runtime/SQLite/queryplan/checker/scanner/native/browser action. Fail C1/C2,verify none. Quiet-permitted source review does not require a red run during quiet; no additional finding for pending runtime. Release pin for consolidated correction; quiet/window restrictions persist, fresh committed-head source review before verify, no extra suite/native/stress/provenance run requested.

Criteria: C1 failed (New T2 work-count regression lacks the required positively controlled launch guard; runtime work/decode proof remains pending quiet.), C2 failed (Full capacity predicate skips an earlier ready null-volume login and permits a later candidate where the previous binder refused; preserve the old selection/refusal boundary.).

### impl-1807 · 2026-11-18T18:24:07.963Z

Consolidated source correction for rev-36-1807-source-1 (A-21344), Coordinator 67e95dbb: launch index key/query now reuse only pending_bindings=0, preserving earlier null-volume ready selection and binder refusal before provider acquisition. New equivalence regression plus fixtureWork-owned fakeNativeGuard across both new cases; guard verifies after SQLite cleanup, before restoration. Existing selection titles/assertions unchanged. Correction evidence A-21347 supersedes A-21338 full-eligibility wording. Runtime/red/constructor migration timing receipts remain unexecuted during quiet; the migration timing will be recorded after quiet over. Consumer addition: new direct LoginBinder test reads refusal, bindings, later login state and provider acquisition count; result shape unchanged.

### rev-35 · 2026-11-18T18:30:24.959Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1807-source-2
commit: a0055ce7a60650a7e7771d399ce774e68acc3cd6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Consolidated source clear; Standards and Spec have no findings. A-21350 records the full six-file source pass and correction from dd00cc584. The pending-count-only index/query follows Coordinator67e95dbb and preserves earlier null-volume selection/binder refusal; the new pinned/unpinned and zero-provider-acquisition regression retains that boundary. Both new cases enroll fixtureWork and counted fakeNativeGuard before DB setup, join original work before DB cleanup/verification/restoration, and retain the work/decode/old-SQL controls. The exact Coordinatorb563a662 fixture-only early DROP lines are the only existing selection/downgrade edits; titles/assertions unchanged. C1/C2 remain unverified: runtime/red, query-work/decode and one-time migration time/idempotence proof are unexecuted under quiet. Reported full typecheck/full lint exit0 on macOS Node24.21.0 is not a runtime pass. Hold released; quiet and window restrictions remain, and a changed head needs fresh source review. Full scope and pending evidence: A-21350, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21350-t-1807-consolidated-source-clearance-at-a0055ce7a.md.

### impl-1807 · 2026-11-18T18:45:07.442Z

A-21356 records targeted receipts at unchanged source-clear head a0055ce7a60650a7e7771d399ce774e68acc3cd6. Local macOS Node24.21.0: login-records T1 21/21; T2 login-capacity19/19, selection3/3, binding37/37, exclusive25/25, signed-out30/30 pass (135 total; no skips). Old selection SQL visits5001 vs new <=1, <=1 decode, <=3queries; missing account visits0. Coordinator40808b6a accepts named old-SQL control as deferred red evidence. Constructor-only in-memory index migration on 10,001 synthetic logins48.111ms excludes corpus setup; second constructor no rebuild. Not hub startup/disk/launch latency. Guard and null-volume refusal pass. T3/native/T4/Web and configured verification unexecuted; no browser. Existing selection titles/assertions unchanged except approved schema setup drops. No source/head change, staged receipt removed. Publication scan passed after project-root path redaction.

### impl-1807 · 2026-11-18T19:35:20.618Z

ab02b63d exit1 is own new-case enforced duration cap (not assertions): 8.624 s > 5 s; all executed assertions green, T0/T1 completed, T2 exit1 duration, Web unexecuted. Coordinator2ee397aa directs cheaper setup, fresh review/new window. Correction changes only new C1 corpus setup + guide: one transaction, reused prepared login/binding/reader inserts through real maintenance triggers, retaining all 10k counts and old-body/control assertions. Local macOS Node24.21 ordinary isolated case974.092ms, whole invocation1299.282ms; full affected file19/19 pass10477.440ms, C1 case868.034ms, constructor-only migration42.899ms excludes setup. No comparison to droplet timings as speedup; droplet proof still pending. No allowance added, no production source change, no configured rerun. Required full lint/typecheck and fresh review follow.

### rev-35 · 2026-11-18T19:38:37.269Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1807-evidence-1
commit: a0055ce7a60650a7e7771d399ce774e68acc3cd6
scope: evidence
findings: [{"severity":"medium","text":"The new 10,000-reader case passes its assertions but takes 8.623798743s, exceeding the enforcing 5s new-test budget. Follow Coordinator2ee397aa's cheap-seed correction while retaining count/old-SQL controls, then fresh source review/new window; the separate 2s advisory does not waive this gate.","file":"hub/test/login-capacity.test.ts","line":244}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed/partial exact-head evidence settled in A-21384. Owner ab02b63d/A-21381 is finished/failed at a0055ce7; T0/T1 pass, T2 exits1 on the enforcing duration diagnostic. All617 executed files pass, but only388/432 T2 files executed (44 Neovim unexecuted); T3/T4/Web unexecuted. Ordinary6115 passes plus220 load passes explain delivered6335 completed tests. Both new identities retain base+5/5 load/file passes, no own tier warnings, positive migration/work/decode and null-volume contract facts; C2 remains unverified in this failed verdict. The uncommitted seed/guide fix and new local timings are a separate epoch, not reviewed or promoted here. Hold released for the Coordinator-authorized correction. Fresh committed-head source review precedes a new verify window; no same-identity retry. Full audit: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21384-t-1807-failed-duration-gate-evidence-at-a0055ce7a.md.

Criteria: C1 failed (Configured ab02b63d failed the enforcing duration budget: new functional C1 case passes but 8.624s >5s. This is a validation-budget failure, not a failed query-work bound.).

### rev-35 · 2026-11-18T19:42:10.037Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1807-source-3
commit: 0e260885b61a2e6d7c8ac5bb0f8c18340ad6f7bc
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Cheap-corpus correction source clear; Standards and Spec have no findings. Exact two-file16+/6- change from a0055ce7 reuses three prepared inserts in one transaction with real tables/triggers, preserving10,000 intents/state-phase mix, all work/decode/old-SQL/migration assertions, guard/DB ownership and null-volume contract. Production and existing selection assertions unchanged; no allowance/policy change. A-21385 records local isolated case974.092ms and full-file19/19 with case868.033750ms, correctly separated from whole invocation/file times and the prior failed Linux sample. Full lint/typecheck exit0 are reported for the correction. C1/C2 remain unverified until new configured evidence; the droplet5s cap is not claimed passed from local data. Prior ab02b63d remains FAILED/PARTIAL per A-21384. Hold released for a new Coordinator window at unchanged0e260885. Full scope: A-21388, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21388-t-1807-cheap-corpus-source-clearance-at-0e260885b.md.

### impl-1807 · 2026-11-18T20:09:33.660Z

Configured 4d323f3c at0e260885b completed green: T0/T1/all fallback T2/Web exit0,6851 tests pass/no skips; Linux droplet c-8 ams3 Node24.21, Chrome Headless Shell Google Chrome for Testing156.0.8078.4, lifetime1393s cost$0.0967, workers2. A-21404 has raw receipts. C1 base1.149774609s, five load repeats0.920166713–1.225595356s all pass; enforcing5s cap now passes with no allowance. OldSQL5001visits, new<=1visit/decode,<=3queries; constructor-only10,001-row in-memory migration48.704ms excludes setup, second constructor no rebuild. Null-volume refusal base+5/5 passes. T3 remains in merge batch; T4 unexecuted. Prior failed ab02b63d retained as failed/partial in A-21384. No source/head changes; reviewer has same-head result for final settlement.

### rev-35 · 2026-11-18T20:11:35.356Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1807-evidence-2
commit: 0e260885b61a2e6d7c8ac5bb0f8c18340ad6f7bc
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards0/Spec0 findings. Owner4d323f3c/A-21404 finished/passed at unchanged source-cleared0e260885, clean/pushed; exact provenance checked. All716 selected files/6851 ordinary tests pass (229 T1/432 T2/55 Web), no bad/incomplete structured outcomes;220 load test/file passes separate. C1 base1.149774609s plus5/5 load0.920166713–1.225595356s passes existing enforcing5s cap without allowance. Positive controls: old SQL5001 visits; new matching1visit/1decode, missing0,queries2/3; in-memory constructor-only migration48.704ms excludes setup, exactly2rebuilds/no second-constructor rebuild assertions pass. Null-volume refusal base+5/5 passes, and all135 related login cases positively complete. Verify C1/C2. T0/T1/all T2 including Neovim44files/385tests/Web complete; T3 deferred,T4unexecuted. Linux x64 Node24.21/nvim0.12.5, isolated Headless Shell1248 Chrome156.0.8078.4; advisories report-only. Snapshot e8fbbe83 distinct from Git tree e0ca4aaf. Prior failed ab02b63d remains FAILED/PARTIAL per A-21384; no mixed-scope speedup or retrospective provenance claim. Hold released. Full exact receipts/limits: A-21406, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21406-t-1807-final-same-head-evidence-at-0e260885b.md.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T22:36:10.743Z

Merged f0cc69a4848dc9625f38accdeae070fb6149964c onto dev.
