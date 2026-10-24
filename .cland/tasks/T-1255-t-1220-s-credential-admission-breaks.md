---
id: T-1255
kind: task
title: T-1220's credential admission breaks seven T3 tests whose fixtures act as sessions without their own credential
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1197
blocked_by: []
regression_of: T-1220
found_by: cover
topic: topic-992
branch: t/T-1255-t-1220-s-credential-admission-breaks
created: 2026-10-24T17:14:10.058Z
updated: 2026-10-24T18:02:46.147Z
---

## Summary

The Linux stage cover d41e7321 at da2d0e6f (A-11286) failed seven T3 tests that T-1220's own verify did not select. Five fail with `session "<name>" credential is missing or invalid` (merge-gate rev, scenarios/stage-close qa-one, subscription-frame coord, suite-human isolated-session). The other two show a credential side effect: adapter-native-boundary finds a leftover `sessions` directory after a ClaudeCodeAdapter failure at bg/log, and request-guard's relaunch case publishes no `session.resume … resumed` timing. As in T-1220's M5 migration, fixtures that act as a session must use owned authenticated clients. Production credential admission stays as it is.

## Acceptance criteria

- [x] C1. All seven listed cases pass on a Linux droplet and on macOS, with each fixture actor migrated to its own credential and no relaxed assertion or production admission change (test).
  - done: impl-1255 · 2026-10-24T17:23:41.429Z
- [x] C2. Named-session fixtures in other T3 files are inventoried statically, with the narrowed list on the item, and a coordinator-submitted verify all on a Linux droplet at the reviewed head passes every T3 file (test).
  - done: impl-1255 · 2026-10-24T18:02:46.147Z

## Comments

### impl-1255 · 2026-10-24T17:15:59.836Z

Original Linux failures quoted individually in A-11289 (including both Claude bg/log identities). Initial lexical T3 inventory has 76 candidate files; checking actual named-session calls and transitive helper users before sequential runs. Local stage dd68da66 still owns slot, so no reproductions or bypass have run yet.

### impl-1255 · 2026-10-24T17:23:41.360Z

Implementation and local evidence complete. A-11291 contains original six-file macOS reproductions (seven original failures); A-11292 contains corrected sequential local runs: merge-gate 7/7, stage-close 1/1, subscription-frame 1/1, suite-human 6/6, adapter-native-boundary 67/67, request-guard 12/12 (94 total), plus docs 3/3. Darwin arm64, local executor, changed source based on da2d0e6f. npm run typecheck exits 0; static lint A-11294 exits 0 with zero refusals, 133 report-only findings. No integrated Linux pass claimed. A-11293 records 76 lexical T3 candidates, eight exclusions and one additional raw-frame file, leaving 69 direct caller files with per-file credential-path reasoning. Coordinator decision 200541cc replaces individual inventory runs with Coordinator-submitted verify all on the reviewed head, then evidence review. No production admission changes. All original assertions retained; timing stimulus change explicitly approved by decision 3c7263ed, due to T-1220's credential await. Claude rollback is a product fix with partial-write credential/peer-preservation cases. Fresh origin/dev fetch/merge before first source review: already up to date.

### impl-1255 · 2026-10-24T17:24:47.920Z

C2 inventory supplement at unchanged pushed d64e5773: a second raw hello/native-entry-point search found four additional named fixtures (daemon.test.ts, session-brief.test.ts, tracker-native-boundary.test.ts, journal-async.test.ts). Each owns its own handshake/core receiver; no borrowed shell claims or further migration needed. Four other matches only carry identity-free client hellos and are excluded explicitly. Final A-11295 supersedes A-11293: 73 inventoried files. Full per-file list/credential reasoning is in A-11295; integrated droplet execution remains pending Coordinator after source clear.

### rev-23 · 2026-10-24T17:27:41.987Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1255-source
commit: d64e57738f3d94243f26fe26c374445e45fa4e11
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1255 full source review — clear

Head d64e57738f3d94243f26fe26c374445e45fa4e11/tree9fd7ebe948bfc1e1969c5f183101051a20528341, sole parent/fixed base da2d0e6f99846275009024eaa2b0cc3c2a82ff02. Branch ref matches. git diff da2d0e6f...d64e5773:11files,120insertions36deletions,onecommit. Scope full, run rev-20261024-1255-source. Reviewer both axes in-session (subagents disabled); static read-only Git/source/tracker/docs/artifact reads only, no tests/probes/install/edits/Git mutation/browser/delegation.

## Standards
No findings. Four fixture migration sites use existing owned authenticated seams: merge-gate CLI sessionCland resolves the registered rev's credential; stage-close and subscription-frame sessionClandWithEnv provision their own QA/coord authority; suite-human reuses f.env from owned suite-caller spoke/sessionShell instead of an unregistered isolated-session label. Permission/role assertions remain unchanged, raw authentication-negative controls remain raw. Production admission/core/CLI/shared credential source unchanged.

Claude private-file rollback is a required product cleanup fix, not admission weakening. LaunchFiles is created before staging; directory tracks only created parents, files capture remove/restore ownership before write. Partial settings failure undoes mcp/settings in reverse order, preserves existing credential/peer bytes and directories, restores prior bytes/modes, and removes only empty newly created parents. Successful launch commits ownership. Background process stop precedes rollback; stop failure throws before file undo, retaining files with existing watched process rather than removing live resources. Existing stop semantics retain watcher until confirmed stop. No new synchronous native boundary.

Two new T3 native-boundary cases plant a real partial settings write before throwing, exercise new-file and previous-file restoration with existing owned credential and peer credential, preserve modes, assert staging failed before native child and retain original bg/log empty-directory/exited-child assertions. Real filesystem/process boundary is appropriate to T3; existing fixture uses sealed owned environment/child teardown. No new process introduced by those cases. Required exact-path guides/index for adapter-native-boundary and request-guard added; README accurately documents rollback and stop-failure preservation. No command/default/permission change requiring unrelated help/role expansion. Whitespace clean; no material smell finding.

## Spec
C1 source implements all seven diagnosed cases in six files without relaxing original assertions. Original Linux A-11289 quotes credential refusals for rev/qa-one/coord/isolated-session, Claude bg/log leftover sessions directory, and aggregate relaunch missing resumed timing. A-11291 reproduces the same seven on Darwin arm64 at base. The two Claude failures now exercise actual cleanup, not changed expectations.

Timing change follows Coordinator3c7263ed read directly: T1220 awaited credential provisioning splits stopped-row publication from adapter-resume work, so two200ms blocks no longer share a resumed continuation. Aggregate relaunch now selects the post-provisioning running row, then consumes the second block in that continuation's state observer. All >=400ms, exactly one slow-request event, tool/client/resumed phase and zero slow-answer assertions remain; nonaggregate/other operations unchanged. No production timing/admission logic changed.

C2 static inventory A-11293 independently checked against normalized string/object T3manifest entries at base:76 lexical files minus exactly eight documented import-only/empty-identity/hook/stub exclusions plus raw-frame executor-run=69unique T3caller files. Credential wrapper/owned-spoke/fallback and shared suite/remote fixture call sites inspected. No additional obvious unauthenticated known-name caller found; static classification is not runtime proof. Item comment references narrowed inventory and reasoning. All69 still await integrated Linux all-T3 evidence; none counted passing from inventory.

A-11292 retains local Darwin arm64 changed-working-tree outputs: merge7/7 Node18536.696083ms,stage1/1 5757.031209ms,subscription1/1 1456.134208ms,suite-human6/6 14118.028625ms,adapter67/67 14702.685125ms,request12/12 5453.321416ms (94total),docs3/3 116.926541ms. New partial-write cases2.681083/2.978333ms. Source is precommit corrected working tree based on da2d0e6f, not per-run captured committed-tree hashes. Native file outputs/counts/timings are retained; standalone per-file process-exit envelopes and total typecheckwall are not present in those adjacent logs and are not inferred. Lead reports typecheck0,staticlintA-11294 exit0/zero refusals/report-only133findings60files. Red README discloses initial nonexistent worktree hub discovery before corrected runner; no refusal bypass or overlapping local suite claimed. No Linux pass/integrated cover/enforced timing proof yet.

Both C1/C2 contain runtime requirements and remain unverified by this source verdict; claimant done marks present. Coordinator200541cc read directly supersedes ordinary task verify: after source clear lead reports to Coordinator, who submits cland verify all on a Linux droplet at this exact reviewed head to cover every T3 file. Lead must not submit its own mode-free run. Return original all-run/head/platform/actual phases/report-mode receipt for evidence review, retaining local macOS attribution separately. No per-itemQA(none/after-stage). Source clear only; no stage/landing claim. Standards0 findings; Spec0 findings.

Durable audit A-11296.

### impl-1255 · 2026-10-24T18:00:05.278Z

Integrated Coordinator run74230bda at d64e5773 failed (A-11305): suite-runner-contract.test.ts legacy-timezone holder: `Error: no frame matched within 5000ms; saw [{"type":"welcome","name":"cli","presence":[]}]`. All seven original cases and both partial-write cases have explicit Linux pass receipts. T0/T1/T2 exited0; T3 exited1; Web had0/unavailable, so no complete cover/ready claim. Linuxx64c-8lon1, lifetime1575s,$0.1094; timing/lint report-only. Additional blocking fixture race fixed at pushed d04f0291425b935406643ecbe1eacb15b8e21ff9/treecce734d7a91f268ce2a66b266431dd80b97e464e, without dev merge or production change: subscribe the buffering UI before starting the hand runner; preserve every original assertion and bound. A-11308 contains controlled late-subscription red and early-subscription green with delayed consumption retained. Unmodified local file initially passed6/6, correctly not treated as a fix. Corrected local full file6/6 and docs3/3 (Darwinarm64, sealed, sequential, precommit working source) retained in A-11309 with exit envelopes. Requesting fresh source review before Coordinator resubmits. This helper-only named CLI actor uses suite-fixture's existing owned f.env; no further credential migration.

### rev-23 · 2026-10-24T18:01:40.747Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-1255-evidence1
commit: d64e57738f3d94243f26fe26c374445e45fa4e11
scope: evidence
findings: [{"severity":"medium","text":"M1: observer subscribes after holder publication; suppressed unchanged queue can leave exact-PID frame wait without its only receipt. Arm buffering subscription before launch, preserve final assertions and 5s bound.","file":"hub/test/suite-runner-contract.test.ts","line":117}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1255 failed Coordinator all-run disposition at d64e5773

Original Coordinator-submitted all74230bda-7d46-4455-a203-3d0adf71d6c3/A-11305 at d64e57738f3d94243f26fe26c374445e45fa4e11 exits1. task.view confirms failed head. T0/T1/T2exit0; T3failed,Webnotexecuted. Native finishes3937ordinarypass/1fail/5skip(554filepasses/1filefail) plus90separate load passes; completed-header4033includesload, ordinary3943total. Linux droplet evidence is partial and failed, not a full T3/all pass.

Actual failure: hub/test/suite-runner-contract.test.ts::verify queue preserves a live legacy package holder across observer timezones — Error: no frame matched within 5000ms; saw [{"type":"welcome","name":"cli","presence":[]}]. Native testfail8.5948759s. M1medium: original subscription occurs only after holder launch/setup and can miss the unchanged queue's single pushed snapshot; arm buffering observer before launch per rule9, retaining exact-PID frame, CLI/queue/owner-token/finalcompletion assertions and bounds. Changed source already supplied for independent review, not approved by this disposition.

All seven original credential/rollback/timing repairs and both new private-file rollback controls passed within the failed run; useful partial scoped evidence only. General lint/durations report-only. No completed Web/all-T3/T4/enforcing-timing/stage/landing claim. C2 fails because Coordinator all run is red; C1 remains runtime pending overall evidence settlement.

Inventory correction: A-11295 supersedes A-11293. Final static inventory has73files:69prior plus daemon/session-brief/tracker-native-boundary/journal-async rawhello/core callers; source unchanged by that supplement. Earlier A-11296's69count described the earlier artifact and is superseded for final inventory. New d04f0291 source request is separate. Reviewer static log/source/tracker/Git reads only.

Durable audit A-11311.

Criteria: C2 failed (Coordinator verify all exits1 on legacy-holder missing queue-frame receipt; Web/full green all evidence absent.).

### rev-23 · 2026-10-24T18:02:32.811Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-1255-source2
commit: d04f0291425b935406643ecbe1eacb15b8e21ff9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1255 corrected source review — clear

Head d04f0291425b935406643ecbe1eacb15b8e21ff9/treecce734d7a91f268ce2a66b266431dd80b97e464e; sole parent prior source-cleared d64e57738f3d94243f26fe26c374445e45fa4e11, no dev merge. Branch ref matches. Scope full, run rev-20261024-1255-source2. Carry full A-11296 fixture/Claude rollback/timing audit; failed old-head all-run separately recorded A-11311/rev-20261024-1255-evidence1. Reviewer static read-only source/Git/tracker/docs/artifact parsing only; no tests/probes/edits/mutation/delegation.

## Standards
M1 resolved, no remaining findings. Only suite-runner-contract subscription placement and exact per-test guide/index change. Both UTC/legacy cases await successful buffering-client subscription before any hand-runner launch. Native marker still bounds setup independently. Later exact-PID verification.queue frame wait retains5000ms bound; harness buffers all pushed frames and checks buffer before installing wait, so the subscribed observer can consume the exact earlier receipt. CLI/queue worktree/since/kind/PID, live child/owner token, no-admission-before-release and final post-release queued completion assertions unchanged. No sleep/proxy predicate/increased timeout or production scheduler/broadcast change. Existing sealed child and teardown remain. T3 justified real lock/process lifecycle; guide describes unchanged-signature suppression and durable buffered receipt correctly; whitespace clean.

## Spec
All original credential fixture migrations, real Claude launch-owned private-file rollback and approved relaunch resumed-scope stimulus remain byte-unchanged. Admission and production behavior unchanged. M1 arose during required integrated all-T3 run, so fixing this additional fixture within task preserves C2's full-run purpose.

A-11308 provides local Darwin controlled reproduction: initial .mjs/TypeScript setup SyntaxError explicitly not counted; first early-observer scheduling attempt passed and did not reproduce. Late-subscription control waits for a separate early observer's exact holder-PID frame, then delays2500ms before tested subscription, reproducing the exact 'no frame matched within5000ms;saw[welcome]' failure. Fixed control preserves delayed consumption and all assertions but subscribes tested client before launch:1/1pass,case7133.435959ms/Node7406.839833ms. Diagnostic delay remains only in control artifact, not shipped test. A-11309 contains corrected precommit Darwin arm64 file6/6exit0(UTC4091.328ms,legacy4096.062625ms,Node16417.946ms),docs3/3exit0/Node116.348458ms and explicit source/exit envelopes. No Linux rerun/current integrated pass inferred; static lint was still pending at request, not claimed executed by Reviewer.

Inventory correction incorporated: A-11295 supersedes A-11293 with73unique normalized T3manifest entries. Independently checked four added rawhello/core callers (daemon/session-brief/tracker-native-boundary/journal-async) against owned-identity/credential-ready handshake or internal-core seam; four supplemental identity-free hello matches excluded. Original69count correctly describes earlier artifact, not final inventory. No additional obvious migration required statically; full runtime remains necessary.

A-11305 atOLDd64e5773 remains failed partial Coordinator all evidence:3937ordinarypass/1fail/5skip plus90separateload, T0–T2green,T3red,Webabsent. Seven original fixes and both new rollback identities passed within it, but no complete Linux all pass. A-11311 failed C2 for that old run, removing its done mark; lead should restore corrected-head claimant C2 done before resubmission. Neither criterion is runtime-verified here.

Clear corrected source permits lead to report source clear to Coordinator200541cc/55ab72df for one Coordinator-submitted Linux cland verify all at exactunchangedd04f0291. Lead submits no separate mode-free run. Return original receipt for evidence review, preserving platform skip/partial/enforce-report limits and local macOS source attribution. No per-itemQA(none/after-stage), stage or landing claim. Standards0remaining findings; Spec0findings.

Durable audit A-11313.
