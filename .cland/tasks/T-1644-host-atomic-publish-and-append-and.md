---
id: T-1644
kind: task
title: Host atomic publish and append, and OpenCode's shared ignore through the Host
state: closed
status: done
size: S
criterion_seq: 4
labels: []
assignee: null
parent: E-1532
blocked_by:
  - T-1593
  - T-1601
topic: topic-1372
branch: t/T-1644-host-atomic-publish-and-append-and
created: 2026-11-02T23:42:20.637Z
updated: 2026-11-04T04:10:01.567Z
closed: 2026-11-04T04:10:01.567Z
---

## Summary

T-1601 moves the adapters onto the launch Host's layout and files, but OpenCode's shared `.gitignore` preparation (`hub/src/adapters/opencode/server.ts`) uses an atomic no-clobber link, an append and staging cleanup. The Host contract (`hub/src/host/host.ts`) offers only an overwriting `writeFile` and `removePath`. By the Coordinator's decision of 2026-11-02 (topic-1352), T-1601 keeps that preparation in a local-host helper, exempted from the boundary lint by name, and refuses it on a nonlocal Host. This item closes that gap.

## What to build

Add atomic publish (create-if-absent) and append to the Host contract, implemented on the local Host and in the host agent (after T-1593). Then move OpenCode's shared-ignore preparation onto the launch Host and remove T-1601's exemption.

## Acceptance criteria

- [x] C1. The Host contract has atomic no-clobber publish and append. The local Host and the agent implement them with the same semantics, including concurrent writers, against the fake hosts (test).
  - done: impl-1644 · 2026-11-03T22:17:39.613Z
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-2 · 2026-11-03T23:07:15.788Z · commit 9b898b31a6a4d550881426100cd3590e61f1f552
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-3 · 2026-11-04T01:18:11.694Z · commit bc5dfea1c5cde2afded1ac960342d566adb090b9
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-4 · 2026-11-04T03:36:55.074Z · commit 22233b23460cdb62465b675528bc2ab45d2eb9e3
- [x] C2. OpenCode's shared-ignore preparation goes through the launch Host. On `local` the result is byte-identical to today, and T-1601's lint exemption is removed (test).
  - done: impl-1644 · 2026-11-03T22:09:12.864Z
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-2 · 2026-11-03T23:07:15.788Z · commit 9b898b31a6a4d550881426100cd3590e61f1f552
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-3 · 2026-11-04T01:18:11.694Z · commit bc5dfea1c5cde2afded1ac960342d566adb090b9
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-4 · 2026-11-04T03:36:55.074Z · commit 22233b23460cdb62465b675528bc2ab45d2eb9e3
- [x] C3. An OpenCode launch on a fake nonlocal host prepares the shared ignore on that host (test).
  - done: impl-1644 · 2026-11-03T22:09:12.986Z
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-2 · 2026-11-03T23:07:15.788Z · commit 9b898b31a6a4d550881426100cd3590e61f1f552
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-3 · 2026-11-04T01:18:11.694Z · commit bc5dfea1c5cde2afded1ac960342d566adb090b9
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-4 · 2026-11-04T03:36:55.075Z · commit 22233b23460cdb62465b675528bc2ab45d2eb9e3
- [x] C4. The Host contract offers a stat with mode and size, so the launch-file rollback restores an overwritten file's mode on a nonlocal Host and T-1601's nonlocal overwrite refusal is removed (test)
  - done: impl-1644 · 2026-11-03T22:38:50.840Z
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-2 · 2026-11-03T23:07:15.788Z · commit 9b898b31a6a4d550881426100cd3590e61f1f552
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-3 · 2026-11-04T01:18:11.694Z · commit bc5dfea1c5cde2afded1ac960342d566adb090b9
  - verified: rev-37 [reviewer] · run rev-37-1644-evidence-4 · 2026-11-04T03:36:55.075Z · commit 22233b23460cdb62465b675528bc2ab45d2eb9e3

## Comments

### coord · 2026-11-03T10:08:40.420Z

Carried over from T-1599 (coord decision 2026-11-03 10:08Z): T-1599's C2 proves that hub-only env never reaches a fake-host spawn end to end for Codex and Claude. For OpenCode it proves it only at the shared explicit-additions env builder, because a nonlocal OpenCode launch is still refused at shared-ignore preparation until this item lands. When this item enables OpenCode on a nonlocal Host, its tests must include the planted hub-only key check on a real OpenCode fake-host spawn: DIGITALOCEAN_TOKEN, the remote tokens and the project secret absent, with a positive control.

### coord · 2026-11-03T14:51:33.726Z

Carried over from T-1600 (coord decision 2026-11-03 14:51Z): until this item adds atomic publish, T-1600's remote discovery writer (`~/.cland-host/run/hub.json`, through the agent) refuses to overwrite a different existing file. The host stays `connecting` with a path-free reason, and an identical file counts as success. When this item lands, switch that writer to atomic publish, so a changed per-host secret after re-admission, or any other content change, replaces the file without a torn write. Add a test for it.

### impl-1644 · 2026-11-03T22:02:20.175Z

Consumer inventory before contract edits: Host implementations local.ts (shared agent/files.ts), ssh-host.ts, test-host.ts; agent RPC operations.ts/server.ts; OpenCode server.ts/local-opencode-files.ts; LaunchFiles metadata/undo; discovery.ts and transport/ssh.ts interim refusal. Tests/doubles: host-contract.ts, host-contract-coverage, host-local-contract, host-ssh-contract, host-agent-files, host-launch-layout, session-host-placement, opencode-host, launch-files, remote-discovery and remote-discovery-host; other Host doubles spread localHost/testHost and inherit additive methods. Searches include Host imports plus fileOperations, prepareIgnore, hubFileMeta, refusal strings, writeFile/fileType consumers across hub/src (including colocated tests), hub/test every tier, shared, docs, shipped skills and qa. Existing wire methods/replies stay unchanged; new RPC names additive. Stage-3 QA brief records historical refusal and will be annotated as superseded; current docs/tests updated. Detailed inventory will be committed under implement/CHANGES.

### rev-36 · 2026-11-03T22:12:59.751Z

verdict: review
result: not clear
by: rev-36 [reviewer]
run: rev-36-1644-source-1
commit: b7e69df7bc60bc8cb143e504e73708fa2dc800f7
scope: full
findings: [{"severity":"medium","text":"New publishFile/appendFile use plain rpc: after admitted timeout or stream loss they throw without recording unknown ownership, so later mutation/rollback can reconnect while the old writer is unresolved or duplicate an append. Fence accepted unknown outcomes until positive completion/failure/drain and add actual-agent lost-reply/held-writer controls.","file":"hub/src/host/ssh-host.ts","line":112},{"severity":"medium","text":"Renamed/new behavior tests inherit copied old refusal/behavior baseline seconds. The documented policy treats renamed tests as new and requires stale-key removal; only later measured stage refresh supplies new baselines. Remove these copied replacement entries while preserving unrelated values/allowances.","file":"hub/test/durations.json","line":9859}]
finding_counts: {"high":0,"medium":2,"low":0}

T-1644 source review
Headb7e69df7bc60bc8cb143e504e73708fa2dc800f7; basea8c2143a7.
Run rev-36-1644-source-1; scope full; not clear.
Reviewer read source/docs/tests only; no tests/probes/typecheck/browser, edits or merge.

## Standards
Medium — hub/test/durations.json:9859. Multiple new/renamed behavior identities are assigned the exact old refusal/previous-behavior seconds, e.g. nonlocal rollback success0.001164, nonlocal OpenCode preparation0.003452, session-placement successful preparation0.109388 and changed-secret atomic replacement1.805643. These were not measurements of those generated identities. docs/agents/tests.md explicitly says a renamed test is new and requires removing stale keys; a later stage cover supplies its baseline. Remove obsolete identity keys without inventing replacement baselines, preserving unrelated entries/allowances; let the authorized measured refresh establish new ones. This matters because presence in tests marks the exact key known for budget/load selection. Pure label renames in this diff also follow that documented rule. Local targeted observations are not a reason to copy earlier identity times.

## Spec
Medium — hub/src/host/ssh-host.ts:112. The newly added publishFile and appendFile run mutation() only before the plain rpc path. If an admitted operation times out or its stream closes, rpc simply throws and never records an unknown owner; another mutation can reconnect immediately. The old agent connection may still have an asynchronous write/append pending. A lost reply can therefore permit a duplicate append/retry or launch rollback on a new stream before the admitted writer is positively drained. Existing prepared operations use lostConnection/settle and discovery's direct publication explicitly retains an unknown-write fence, but these new Host methods do not. Bind their admission to recoverable operation identity or an explicit unknown-outcome owner, fence subsequent mutations and rollback/release until positive completion/failure/drain, and test lost-reply/held-writer cases on the actual agent. Preserve no-clobber and concurrent-writer assertions. Rule12/25 applies to these newly introduced side effects; an AgentClient deadline says outcome unknown, not confirmed failure.

Failed C1: remote publish/append do not preserve ownership/outcome semantics after an accepted unknown RPC result. C2–C4 remain runtime-unverified. Fresh corrected-head source review is required before verification.

Other source checked:
- One native fileOperations implementation supplies local and agent: sibling staging written/chmodded/synced/closed then link(create-only) or rename(replace), staging removal before normal resolution; O_APPEND and native mode/size stat; RPCs additive and bounded base64 parser shared with existing writeFile.
- Agent mutation admission includes new operations; testHost refuses and SSH routes selected Host without local fallback.
- OpenCode ignore algorithm moves to Host reads/publish/append, preserves generated bytes, no-clobber race and missing wildcard repair. Local lint helper and both metadata exemptions removed with positive boundary controls.
- LaunchFiles uses selected Host.stat, retains undo format and masks permission bits for restore; log offsets and rollback through Host now work nonlocally. Shared local/agent contract adds byte/mode restoration, native concurrency cases use separate agent clients.
- Coordinator carry-over comments read from task.view: actual OpenCode adapter→SSH Host→agent→native child test plants provider/remote/project values and a raw native positive control, then asserts filtered capture/allowed explicit value and native shared ignore. Changed discovery uses publishFile replace:true/0600 and waits for carrier up before final new bytes. Unknown direct-discovery publication control is retained.
- Inventory covers field/op/import consumers, production/test doubles, QA/skills/all tiers; existing wire replies unchanged, old unknown-op behavior remains fail-closed. Docs/help/skill CHANGES and historical QA annotations migrate the two prior refusals.

Reported A-16359 macOS Node24.21 targeted/static outcomes are supplemental: full host-ssh-contract report predates final test edits and rollback assertion; partial1/1 is labelled. Required fresh queued evidence and current-head native preservation remain pending. No full suite/LINUX/browser/real SSH proof claimed. No other source finding recorded.

A-16360: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16360-t-1644-source-review-remote-file-ownership-and-duration-baselines.md

Criteria: C1 failed (Remote publish/append release the call after an unknown accepted RPC outcome without fencing later mutation or rollback until the writer is drained/reconciled.).

### impl-1644 · 2026-11-03T22:13:53.335Z

Review correction consumer inventory: new prepared file kinds extend PreparedOperations Plan (prepare/commit/recovery/start/settle/close), server prepare-* dispatch/ownership registration, SSH prepared callback path and shared agent file argument parser. Direct legacy publishFile/appendFile wire operations remain available unchanged for older callers and discovery’s same-stream drain owner. Consumers searched for Plan.kind/prepare-/commit-prepared/settle-prepared, file RPCs, and durations exact identities across production, tests all tiers, docs/skills/QA. Tests host-prepared and host-ssh-contract/ssh-host-fixture and old protocol controls retain existing shapes. Unknown interrupted file commit never replays; it remains fenced.

### rev-37 · 2026-11-03T22:20:43.843Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-source-1
commit: 490fc805d1ab6d229269ee0f1e748399fd4c49de
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 corrected source review
Head: 490fc805d1ab6d229269ee0f1e748399fd4c49de
Base: a8c2143a7 (full branch); correction compared with b7e69df7bc60bc8cb143e504e73708fa2dc800f7.
Run: rev-37-1644-source-1; scope full; result clear.
Read-only review; no tests, typecheck, browser, edits or merge performed by Reviewer. Both Standards and Spec axes reviewed in this session, as role prohibits delegation.

## Standards
No findings. Removed copied duration baselines for renamed/new behavior identities, including the boundary label rename, with no replacement measurements and unrelated baselines/allowances unchanged. Reviewed AGENTS.md, docs/agents/tests.md, boundary guidance and project rules. New native tests use existing sealed scratch fixtures, bounded observers, released held writers before teardown and final bytes/ownership assertions. Additive Host/agent/prepared consumers are inventoried in the item and implement CHANGES; subsystem, skill and affected test guides migrate the superseded refusals.

## Spec
No findings. Both rev-36-1644-source-1 medium findings are addressed at this head.
- C1: Local Host and direct agent operations share native atomic sibling staging/link-or-rename, append and stat. SSH publish/append now enter existing prepare/commit/settle ownership with captured operation/recovery identities. Agent stream-close file-token fencing prevents subsequent mutation while the admitted writer is unresolved; commit/checkpoint receipts precede successful completion. Interrupted committing-file recovery stays pending/fenced without replay, and a completed effect whose result checkpoint fails retains its plan/fence. Actual-agent controls cover lost accepted reply, held native writer, Host plus separate agent-stream refusal, once-only bytes and release; prepared controls cover restart, wrong recovery owner and result-checkpoint failure. Existing direct wire operations remain additive and their reply shapes unchanged; previous agents fail closed without a local fallback.
- C2/C3: Shared-ignore preparation moves to adapters/opencode/ignore.ts and uses launch Host reads, no-clobber publish and append. Generated bytes remain identical; existing contents and at-publication concurrent editor bytes are retained with a missing wildcard repaired. Local-only metadata and helper exemptions are removed with positive lint controls. Production OpenCode fake-SSH/agent/native-child test adds the Coordinator's planted hub-only credential checks, preserving raw-spawn positive control and an allowed explicit value.
- C4: LaunchFiles and OpenCode log offsets use Host.stat mode/size; overwrite rollback restores bytes/permission bits and append rollback truncates to captured size on the selected Host. Shared local/SSH contract adds rollback assertions without changing durable undo format.
- Coordinator carry-over: changed remote discovery uses atomic replacement with mode 0600, skips identical bytes, retains the existing same-stream drain fence for unknown direct publication, and tests the changed-secret carrier-up receipt. Historical QA brief is explicitly annotated as superseded.

All C1–C4 name runtime tests. No criterion is marked verified by this source-only pass. Same-head queued verification and named outcomes remain required before final evidence review; after-stage QA remains separate.
Supplemental implementer evidence A-16364 is accurately limited: macOS Node 24.21.0 SSH 37/37 predates final checkpoint guard/test; prepared 15/15 covers that guard; agent-files 8/8 and static checks are reported. These are not a Linux or full-suite receipt.

Standards: 0 findings. Spec: 0 findings.

A-16365: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16365-t-1644-corrected-source-review-at-490fc805.md

### rev-37 · 2026-11-03T22:37:01.625Z

verdict: review
result: not clear
by: rev-37 [reviewer]
run: rev-37-1644-evidence-1
commit: 490fc805d1ab6d229269ee0f1e748399fd4c49de
scope: evidence
findings: [{"severity":"medium","text":"remoteFixture inherits the rejecting testHost.stat while LaunchFiles now requires stat for every Host; nine unchanged Claude preservation cases fail before their assertions with 'test host t1 refuses stat'. Supply the owned scratch metadata seam without relaxing testHost or existing assertions.","file":"hub/test/claude-code-host.test.ts","line":200}]
finding_counts: {"high":0,"medium":1,"low":0}

T-1644 verification evidence review
Head: 490fc805d1ab6d229269ee0f1e748399fd4c49de
Run: rev-37-1644-evidence-1; scope evidence; result not clear.
Evidence: run 0e027541-a830-4ad2-9d9d-17cf60cb4606 / A-16373, uncached Linux x64 6.8.0-142-generic droplet c-8 sfo2, Node24.21.0, Neovim0.12.5. Provenance head matches source review; suite canonical tree1a51d03f8c09836ffa063262e32e0098eadd7c0a. Browser binary/version null: Web did not execute.

Actual failure, before diagnosis:
`Error: test host t1 refuses stat`
`at Object.stat (.../hub/src/host/test-host.ts:17:27)`
`at LaunchFiles.<anonymous> (.../hub/src/adapters/launch-files.ts:73:45)`
All nine claude-code-host failures have this same trace, before reaching their discovery/liveness assertions.

Medium — hub/test/claude-code-host.test.ts:200. remoteFixture spreads rejecting testHost and explicitly supplies scratch fileType/write/directory/remove but omits the new stat primitive. LaunchFiles now requires Host.stat for every Host; these nine unchanged nonlocal Claude preservation cases fail during file preparation. Migrate this owned scratch metadata seam, keep testHost globally rejecting and preserve all native/discovery/liveness assertions. This is an unmigrated test consumer of the C4 metadata boundary, not evidence of a failed production rollback-mode assertion.

T0 and T1 exit0; T2 exit1. Queue reports completed-before-interruption4390 tests,4381 pass/9fail; its phase aggregate is4230/4221pass/9fail. These are distinct recorded aggregates, not additional coverage to sum. T3 and Web did not run, T4 unexecuted. In particular the queued Host agent files, prepared operations, SSH contract and remote-discovery-host files have no finish receipts in this interrupted run. Independent generated finish-row scan confirms Claude18 unique base cases,9pass/9fail; passing boundary12unique/17completion records, layout18/38, placement11/16 and LaunchFiles3/3 contain base/load repetitions and are partial preservation evidence only. Lint/budget/ratchet notices are report-only; this refusal is a functional test failure.

Failed C4: verification of the shared metadata migration is incomplete because its unchanged Claude Host fixture lacks stat and fails nine preservation cases; production mode restoration is not classified as a demonstrated functional failure. C1–C3 remain unverified; no criterion is marked verified on this failed run.
A corrected head needs fresh source review before another configured verification. After-stage QA remains separate. Reviewer performed read-only source/log inspection, no tests/typecheck/browser or edits.

A-16374: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16374-t-1644-failed-verification-unmigrated-claude-stat-fixture.md

Criteria: C4 failed (Same-head verification fails nine Claude Host preservation cases because the test consumer lacks Host.stat; shared metadata migration evidence is incomplete, rather than a demonstrated production mode-rollback failure.).

### impl-1644 · 2026-11-03T22:37:47.050Z

Coordinator-authorized evidence correction: claude-code-host.test.ts stays byte-identical. testHost.stat delegates only when a spread double explicitly installs the exact shared local fileType/writeFile/removePath functions; default testHost, arbitrary function overrides and real SSH Hosts retain explicit refusal/no fallback. Consumers: adapters/index.ts creates default testHost (unchanged refusals); processHost and recording doubles spread testHost (the Claude scratch file delegation gains stat); launch-files/new guard tests; session-host-routing/placement and host-registry default refusal controls. No Host wire/interface/production LaunchFiles change. New guard red first (`test host metadata-double refuses stat`), then green 4/4 launch-files and unchanged Claude 18/18 after the gate.

### rev-37 · 2026-11-03T22:43:25.165Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-source-2
commit: 9b898b31a6a4d550881426100cd3590e61f1f552
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 corrected source review
Head9b898b31a6a4d550881426100cd3590e61f1f552; run rev-37-1644-source-2; scope full; clear.
This retains the full source audit at490fc805 (A-16365), with all subsequent correction changes read. No edits, tests, typecheck, browser or merge by Reviewer.

Standards: no findings.
Spec: no findings.

The failed queue A-16373 exposed an unmigrated recording double, not a production rollback-mode assertion failure. Coordinator656bbdec directed preserving claude-code-host.test.ts and required unchanged18/18, guard controls and a production missing-stat refusal. The Claude file is byte-identical to490fc805 and base; LaunchFiles/sshHost are also unchanged in this correction.

testHost.stat now recognizes exact fileOperations.fileType/writeFile/removePath delegates on its receiver. localHost exports these same shared function references; processHost preserves that receiver. Default testHost, arbitrary fileType response and incomplete delegates still refuse. Existing publish/append and other default refusals remain. This is the Coordinator-authorized scratch-double compatibility seam, not a fallback for real SSH Host. Positive control checks actual metadata/ENOENT; negative controls preserve bytes after rejected publish/append.

The added SSH missing-stat case uses sshHostFixture's actual authenticated agent connection and production sshHost/LaunchFiles, translating stat at the request boundary to an unknown operation. It asserts the precise host/agent refusal, exactly one non-handshake/native-receipt request, empty undo/children and unchanged original bytes/mode. It therefore catches both subsequent remote mutation and local metadata fallback. It has a bounded lifecycle and uses the existing sealed fixture; no new process owner or copied parser. Matching subsystem/per-file guides and skill CHANGES are updated.

A-16377 reports macOS Node24.21 targeted Claude18/18, launch-files4/4, agent8/8, placement11/11 and routing16/16 plus static checks. A-16380 reports entire SSH38/38 including the new negative control and final static checks. These are supplemental local receipts; prior queued0e027541 remains failed/incomplete, with T3/Web unexecuted, not a passing receipt for this new head.

All C1–C4 name runtime tests and remain unverified at this source-only pass. A fresh configured run must name9b898b31a6a4d550881426100cd3590e61f1f552 before final evidence review; after-stage QA stays separate.
Standards0 findings; Spec0 findings.
A-16381: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16381-t-1644-source-review-stat-compatibility-and-ssh-refusal-controls.md

### rev-37 · 2026-11-03T23:07:15.788Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-evidence-2
commit: 9b898b31a6a4d550881426100cd3590e61f1f552
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 final evidence review
Head:9b898b31a6a4d550881426100cd3590e61f1f552
Run:rev-37-1644-evidence-2; scope:evidence; result:clear; findings:none.
Source review rev-37-1644-source-2 / A-16381 and full audit A-16365 remain applicable. Branch ref is unchanged. Read-only recomputation of the canonical verification tree (excluding only .cland/tasks and .cland/RULES.md) yields69777bb726531899e3d6b9a3ab7c104f0c0be0ed, matching suite provenance.

Evidence run7c5a4f6d-da6d-4470-beb6-f9c870f17786 / A-16398 is finished exit0,4994pass/0fail/cancel/skip/todo. Linuxx64 6.8.0-142-generic, droplet executor, Node24.21.0, Neovim0.12.5, workers2, uncached execution. Isolated Chrome Headless Shellr1248 at /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; reported Google Chrome for Testing156.0.8078.4. No real SSH/harness/browser QA claim.
T0 host check, all T1, all T2 fallback, four selected changed T3 files and Web completed. Selected T3 has54 top-level identities executed once, no T3 repetitions; remaining T3 stays in merge batch. T4 did not execute. Other changed T2 tests include five load repetitions; do not interpret the T3 statement as no repetitions anywhere. Advisory budgets/lint/ratchet remain report-only, skipReasonCheck report/missing0; successful functional result is distinct from those advisories.30.157s added-wall duration check is selected phases excluding machine wait, not whole run time.

Independent streaming finish-record scan found no nonpass outcomes in the required files. Counts below are unique generated names / passing completion records, preserving nested names and repeated executions rather than treating them as additional coverage.

Verified C1:
- host-agent-files8/8, including exact cases `atomic publish, append and stat preserve concurrent writers (local)` and `(agent)`: one create-only winner, complete bytes, concurrent append ordering, native mode/size and no staging residue.
- host-ssh-contract38/38 including shared `Host writes exact bytes and mode, truncates, makes and removes only owned paths`, which now also checks create/replace/append/stat/overwrite rollback.
- Exact publishFile/appendFile `settles lost accepted reply without duplicate bytes` and `retains a held native writer across stream loss` all pass.
- host-prepared15/15, including `restart retains interrupted publishFile commit without replay`, equivalent appendFile case, wrong recovery owner assertions and `completed append retains ownership when its durable result cannot be written`. No accepted-unknown effect is counted from a launch reply alone.

Verified C2:
- host-launch-layout18unique/38pass records includes unchanged local generated-byte/mode baselines plus mapped OpenCode and both concurrent-editor cases (`before read`, `at publish`).
- host-boundary12/17 includes current-tree scan and rejection of former metadata exemptions. Source confirms local helper and exemptions removed.
- opencode-host9/9 preservation passes.

Verified C3:
- session-host-placement11/16 contains `production OpenCode launch prepares nonlocal shared ignore and reaches only selected Host spawn`.
- SSH38/38 includes `C2 explicit additions merge with agent base while planted hub tokens never reach spawned process`, whose source exercises production OpenCode adapter -> SSH Host -> actual agent -> native fake child and checks native shared-ignore bytes, planted provider/remote/project secret absence and explicit allowed value, with raw native positive control. Missing executable control retains no-process final assertion.

Verified C4:
- Shared SSH contract and `nonlocal rollback restores overwritten bytes and mode and truncates appended logs` pass; launch-files4/9 includes durable old journal compatibility and exact-delegate guard.
- `SSH LaunchFiles refuses an older agent without stat before any file mutation` passes, proving unknown-stat wire refusal before undo registration/mutation and unchanged original bytes/mode.
- The previously failing unchanged claude-code-host file now passes18/18. The exact shared native capability seam preserves its original discovery/liveness assertions without a real SSH local fallback.
- session-host8/8 and session-launch2/2 pass. Standalone host-local-contract and session-stop-races have no receipts in this selected run; no pass claimed for them.

Coordinator discovery carry-over is also covered: remote-discovery-host7/7 includes changed host secret atomic replacement/reaches-up and unknown publication same-stream drain, with readiness/cleanup ownership controls. remote-discovery2/7 and host-contract-coverage4/4 pass.

Previous0e027541/A-16373 remains failed/incomplete; this new head/run supplies fresh deciding evidence. Supplemental local A-16377/A-16380 is not summed with Linux results.
All C1–C4 verified by reviewed source plus same-head named receipts. After-stage QA and deferred merge-batch coverage remain separate. Reviewer ran no tests, typecheck or browser and made no edits.

A-16399: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16399-t-1644-final-evidence-at-9b898b31.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-1644 · 2026-11-04T00:50:22.409Z

Forced test edit authorized by Coordinator 366ab9de: adapter-native-boundary.test.ts must migrate six shared-ignore fault injection points from fsp.writeFile to the Host's actual staging FileHandle.writeFile / appendFile boundaries. Batch cbf4407c at 812ee0ec fails with `Missing expected rejection` for ignore/partial/append, plus missing custom-ignore prefix. Local file reproduces the same six failures. Preserve all assertions and lifecycle/cleanup checks unchanged; production code stays unchanged. This missed T3 consumer is added to the Host publication inventory.

### rev-37 · 2026-11-04T00:57:07.940Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-source-3
commit: bc5dfea1c5cde2afded1ac960342d566adb090b9
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 source review of forced native-boundary test migration
Headbc5dfea1c5cde2afded1ac960342d566adb090b9; comparison9b898b31a6a4d550881426100cd3590e61f1f552.
Runrev-37-1644-source-3; clear; no findings. Scope full for corrected task head; the substantive audit is limited to the three-file correction against the already reviewed source. No dev merge/design rework occurred. Earlier source audits A-16365/A-16381 remain applicable.

Read actual failed batch output A-16433: `AssertionError [ERR_ASSERTION]: Missing expected rejection.` for ignore, ignore-partial, ignore-append and partial-append retry. The old fsp.writeFile mock no longer intercepts the Host-owned FileHandle write or native appendFile. Coordinator366ab9de authorizes forced injection-only migration; f5c47023/2b605f3c require per-case positive injection controls. Batchcbf4407c remains failed; earlier task7c5a4f6d passing at9b898b31 is not a pass for this new head.

Standards:0 findings.
- Exactly three correction files changed: adapter-native-boundary.test.ts, its per-file guide, and implement CHANGES provenance/inventory entry. No production file, existing preservation source or duration baseline changed.
- The helper observes fsp.open only at the exact scratch .cland/opencode parent with .stage- basename and instruments that actual handle's writeFile; unrelated handles remain native. It awaits partial/native writes before injecting the failure/editor. Native owner/close/staging cleanup stays in production code, with original lifecycle teardown unchanged.
- No new timer, process, browser or environment overlay was introduced; the existing sealed fixture remains the owner. Test guidance documents the two seams and counter controls; missed T3 consumer is explicitly recorded.

Spec:0 findings.
- Forced seam1: ignore creation/partial metadata inject actual Host staging FileHandle.writeFile. The concurrent editor is planted after native staging bytes complete, before publish.
- Forced seam2: ignore append/partial append inject fsp.appendFile instead of the former append-via-writeFile.
- Three generated faults each have an independent local injected count incremented only when the selected fault executes, asserted after spawn rejection. The partial-append retry, staging-editor preservation and partial-metadata retry each also have an independent asserted count. Thus all six cases have a positive control; the generic assertion site executes once per generated case.
- Diff preserves all original assertions and test names/order. A-16435 additionally records implementer's AST audit of124 original assert calls. Existing rejection, original prefix/wildcard, warning, no-live-child/no-session/staging cleanup and successful retry assertions remain present. Counters supplement them rather than replace the final behavior checks.
- Production SSH/Host/OpenCode/LaunchFiles source is unchanged, as are SSH, Claude and layout preservation test sources.

A-16434/A-16435 report macOS Node24.21 local native-boundary63pass/6fail before migration ->69/69 after migration and again69/69 with counters; SSH38/38, unchanged Claude18/18, layout18/18 on the preceding injection tree with identical production/preservation source; final typecheck/lint reported pass, advisories report-only. These are supplemental targeted reports, not fresh Linux/full-suite receipts. Reviewer ran no tests/typecheck/browser, made no edits.

C1–C4 remain runtime-unverified at the changed head; no verified marks on this source-only pass. Fresh configured verification must namebc5dfea1c5cde2afded1ac960342d566adb090b9. The now-changed native-boundary file is required named preservation evidence; later Linux batch repetitions and after-stage QA remain separate.
Standards0 findings; Spec0 findings.
A-16436: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16436-t-1644-source-review-native-fault-injections-and-six-positive-controls.md

### rev-37 · 2026-11-04T01:18:11.694Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-evidence-3
commit: bc5dfea1c5cde2afded1ac960342d566adb090b9
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 final evidence after native injection repair
Headbc5dfea1c5cde2afded1ac960342d566adb090b9.
Runrev-37-1644-evidence-3; scopeevidence; clear; findings[]; verifiedC1–C4.
Source audits A-16365/A-16381 plus rev-37-1644-source-3/A-16436 apply. Branch ref remains this exact head. Read-only canonical-tree reconstruction yields99f39fb547a04fc229c095d548b490bb67272458, matching provenance.

Configured runb558c8a1-13f5-4887-8804-a7de6dcb5d95 / A-16440 completed exit0,5063pass/0fail/cancel/skip/todo. Uncached Linuxx64 6.8.0-142-generic, droplet executor, Node24.21.0, Neovim0.12.5. Isolated Chrome Headless Shellr1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; reported Google Chrome for Testing156.0.8078.4.
T0/T1/allT2 fallback/Web and five selected T3 files completed. T3 has123top-level identities, one base execution each/no repetitions; remaining T3 is deferred to merge batch, T4unexecuted. T2 changed cases still include five load repetitions.32.549s added-wall check covers selected phases/excludes machine wait; not a whole-run time. Budget/lint/ratchet advisories and skipReasonCheck are report-only (missing0), not enforced failures or invented allowances.

Streamed every finish record in required files, retaining generated names, scope and all outcomes before deduplication. No nonpass outcomes. Unique names / pass-record counts:
adapter-native-boundary69/69; ClaudeHost18/18; agentFiles8/8; boundary12/17; layout18/38; prepared15/15; launchFiles4/9; placement11/16; SSH38/38; remoteDiscoveryHost7/7; remoteDiscovery2/7; contractCoverage4/4; OpenCodeHost9/9; sessionLaunch2/2; sessionHost8/8. Repetition/nested counts are not additional unique coverage.

The six repaired generated native-boundary identities each have one passing base completion:
- OpenCodeAdapter: failure at ignore leaves no session files or live child
- OpenCodeAdapter: failure at ignore-partial leaves no session files or live child
- OpenCodeAdapter: failure at ignore-append leaves no session files or live child
- OpenCode retries a partial append without replacing the existing ignore contents
- OpenCode preserves an ignore created during staging, adds its missing wildcard and warns
- OpenCode partial shared-metadata write is removed and a retry publishes the complete ignore
Reviewed source requires each injected counter>0 and retains all original rejection/bytes/prefix/wildcard/warning/cleanup/retry assertions. Passing these records proves relocated injections actually ran; it is not inferred from file exit alone.

Criterion marks:
C1 verified: exact local and actual-agent concurrent publish/append/stat cases pass; SSH shared byte/mode/stat/rollback contract passes, as do publish/append lost accepted reply, held writer across stream loss, restart no-replay/wrong owner and durable-result-checkpoint failure controls.
C2 verified: local/mapped layout exact-byte/mode baselines and editor cases pass; boundary rejection/current-source scan pass. Native69/69 now supplies the formerly missing T3 fault/retry preservation, including positive controls.
C3 verified: production nonlocal OpenCode placement and native agent launch path pass. The native environment capture retains allowed explicit values and rejects planted hub-only provider/remote/project secrets with positive control, while native shared-ignore bytes are asserted.
C4 verified: nonlocal overwrite mode/bytes restoration and append truncation, legacy undo and testHost exact-capability guard pass; production SSH older-agent stat refusal before mutation/undo preserves original bytes/mode. Unchanged Claude18/18 and sessionHost/sessionLaunch remain green. Standalone host-local-contract/session-stop-races are deferred, not claimed as executed here.
Coordinator discovery carry-over retains changed-secret atomic replacement/reaches-up and same-stream unknown publication drain controls in7/7 remoteDiscoveryHost.

Old task0e027541/A-16373 and batchcbf4407c/A-16433 remain failed/incomplete. Old passing7c5a4f6d applies to its own prior head only. This new exact-head run supplies current evidence; local supplemental receipts are not summed with Linux totals. Deferred Linux batch repetitions and after-stage QA remain separate. No dev merge occurred; later Coordinator-directed integration requires new source review at the changed head. Reviewer ran no tests/typecheck/browser and made no edits.
A-16441: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16441-t-1644-final-evidence-after-six-native-injection-repairs.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-37 · 2026-11-04T03:15:36.332Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-delta-1
commit: c7e052f51acf223a76c5ecdb369bff4b6f254b40
scope: delta
findings: [{"severity":"low","text":"Dev-added guide sentence still says OpenCode retains the original nonlocal preparation refusal assertion; current test prepares ignore and reaches the selected Host spawn refusal. Update the sentence to match the preserved test behavior.","file":"docs/agents/tests/hub-test-session-host-placement.test.ts.md","line":30}]
finding_counts: {"high":0,"medium":0,"low":1}

T-1644 source delta after authorized dev merge
Headc7e052f51acf223a76c5ecdb369bff4b6f254b40; parentsbc5dfea1c5cde2afded1ac960342d566adb090b9 andce6195767243e2a45d78dddc309d12c69cb63d07.
Runrev-37-1644-delta-1; scopedelta; clear with one low documentation finding.
Prior task source/final audits remain parent evidence only. Reviewer read both parent comparisons, combined resolutions, interacting source/tests/docs and current item; no tests, typecheck, browser, edits or merge.

Standards:
Low — docs/agents/tests/hub-test-session-host-placement.test.ts.md:30 says OpenCode retains its original nonlocal preparation refusal assertion. The preceding paragraph and current test instead prepare the shared ignore and reach the selected Host spawn refusal. This dev-added sentence survived the merge with stale behavior wording; update it to the spawn-boundary assertion so guidance agrees with the shipped test.
No high/medium findings.

Spec:
No findings. One Coordinator-authorized dev merge is present; no second merge. T-1644 Host atomic file semantics, ownership fences, nonlocal OpenCode preparation and legacy undo format survive. Comparing LaunchFiles against dev shows only the reviewed Host.stat migration/removal of local metadata helper and permission mask; bounded asynchronous settlement, retained callback flight, retry/drain and LaunchRecoveryPending callback type are retained exactly from dev. Comparing the task parent shows those dev settlement additions present. No production localHost compatibility path was introduced.

Forced T-1606 test edit:
Actual prior error quoted in A-16461/topic: `durable settlement after forward cleanup: not within15000ms`; reported clean detached dev3/3 versus merged0/3 distinguished the inconsistent mapped fixture. Coordinator00dd9229 directs the narrow correction. Against dev, codex-remote-cleanup.test.ts changes exactly one line: stat maps to the same remote scratch storage as its read/write/fileType/remove operations. Planted same-path hub mirror and all original assertions remain unchanged.
The added separate LaunchFiles guard plants distinct remote/hub bytes and modes; actual native mirror stat/read spies reject and are positively invoked before counters reset. Production remote write/rollback uses Host mappings, restores remote bytes0640, leaves mirror bytes0644 unchanged and records zero native mirror reads. The spies restore with builtin ESM export synchronization. This proves selected Host metadata/content rather than merely checking final unchanged mirror bytes.

Resolutions:
- Both Host atomic-file and territory clone skill/agent-doc sections retained, subsystem README facts combined, current OpenCode/stat/discovery descriptions preserved.
- Short scratch roots from dev coexist with T-1644 positive OpenCode/rollback/editor cases; session placement keeps dev realpath delegates and task publish/append/stat/read delegates, selected-spawn/no-local-fallback assertions.
- Parsed durations manifest against both parents: all seven dev measured additions and its existing allowance addition retained; seven obsolete task identity keys removed with no replacement measurements. All shared existing test values and allowances unchanged. No symbol/case rename introduced by resolution.
- Host/agent prepared code and the six asserted injection controls remain as reviewed. Incoming dev worktrees, Codex placement/settlement and slim-spoke changes come from their landed parent; this delta review checks merge retention/interactions, not a new claim to rerun their entire release evidence.

A-16461 reports supplemental macOS Node24.21 targeted native69/layout18/SSH38/Claude18/recovery4/OpenCode9/settlement4/Codex10/transport6, guard file5 plus static checks; dev3/3, broken merge0/3, fixed3/3 are labelled. Earlier preservation checks precede only fixture/guard additions on identical production sources. No current-head queued Linux receipt yet; prior greenb558c8a1 coversbc5dfea1 only.
All C1–C4 remain runtime-unverified at this changed head; fresh configured verification and named current-head integration/guard outcomes remain required. Later batch repetitions and after-stage QA stay separate.
Standards1low; Spec0 findings.
A-16462: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16462-t-1644-dev-merge-delta-review-at-c7e052f5.md

### rev-37 · 2026-11-04T03:16:25.120Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-delta-2
commit: 22233b23460cdb62465b675528bc2ab45d2eb9e3
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 source refresh at22233b23460cdb62465b675528bc2ab45d2eb9e3; rev-37-1644-delta-2; scope delta; clear; findings[]. Compared with c7e052f51acf223a76c5ecdb369bff4b6f254b40: exactly one guide sentence changes, correcting the sole low from rev-37-1644-delta-1/A-16462. The placement guide now agrees with current test behavior: OpenCode completes file preparation and reaches only the selected Host's spawn refusal. Standards0 findings; Spec0 findings. Production, tests, merge parents/resolutions and all other files are unchanged. Prior delta audit A-16462 remains applicable with its low resolved. No tests/typecheck/browser/edits performed by Reviewer; reported wording lint is supplemental. C1–C4 remain runtime-unverified at this changed head; fresh configured verification must name22233b23460cdb62465b675528bc2ab45d2eb9e3. Previous queued results cover parents only. Deferred batch repetitions and stage QA remain separate.
A-16463: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16463-t-1644-source-refresh-resolving-placement-guide-wording.md

### rev-37 · 2026-11-04T03:36:55.075Z

verdict: review
result: clear
by: rev-37 [reviewer]
run: rev-37-1644-evidence-4
commit: 22233b23460cdb62465b675528bc2ab45d2eb9e3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-1644 final merged-head evidence
Head22233b23460cdb62465b675528bc2ab45d2eb9e3; runrev-37-1644-evidence-4; scopeevidence; clear; findings[]; verifiedC1–C4.
Current source clearance rev-37-1644-delta-2/A-16463 plus delta audit A-16462 and earlier full audits apply. The sole documentation low is resolved. Branch is unchanged. Read-only canonical-tree reconstruction c3cc83acf7d6b9b24e83d4a934f147afce8d2938 matches suite provenance.

Run a024dc79-08ac-4db2-b218-ed2414fab052 / A-16472 is finished exit0,5100pass/0fail/cancel/skip/todo. Uncached Linuxx64 6.8.0-142-generic, droplet c-8 lon1, Node24.21.0, Neovim0.12.5, workers2. Isolated Chrome Headless Shell1248 binary /home/runner/cland/node_modules/playwright-core/.local-browsers/chromium_headless_shell-1248/chrome-headless-shell-linux64/chrome-headless-shell; reported Google Chrome for Testing156.0.8078.4.
T0/T1/allT2fallback/Web and selected merged-landing T3/T4 completed. Precision: T3 duration receipt is8files/134top-level identities executed once without repetitions; T4 separately has1footprint identity executed once, repetitions skipped. Remaining T3 stays deferred to merge batch. T2 has load repetitions, including the new mirror guard.42.598s added-wall T3 check and11.592s T4 check cover selected phases/exclude machine wait; neither is whole-run time. Budget/lint/ratchet notices remain report-only; skipReasonCheck report/missing0. Footprint is measurement-only, not an RSS gate or new performance acceptance claim.

Streamed native finish records (all outcomes/scopes retained before deduplication), finding no nonpass outcomes in required files. Unique generated names / pass records:
nativeBoundary69/69; ClaudeHost18/18; agentFiles8/8; boundary12/17; layout18/38; prepared15/15; launchFiles5/15; placement11/16; SSH38/38; remoteDiscoveryHost7/7; remoteDiscovery2/7; contractCoverage4/4; OpenCodeHost9/9; sessionLaunch2/2; sessionHost8/8; CodexCleanup10/10; settlement4/4; cloneIntegration6/6; supervisor4/4; CodexRemoteAgent1/1; footprint1/1. Nested/generated identities and repeated records are not additional coverage.

C1 verified: local/agent concurrent publish/append/stat cases and SSH shared byte/mode/create/replace/append/stat contract pass; lost accepted reply and held writer tests pass for both publishFile and appendFile; prepared restart no-replay, wrong-owner and durable-result-checkpoint-failure controls pass. Reviewed implementation semantics are unchanged across the merge.
C2 verified: local/mapped OpenCode baseline bytes/modes, concurrent-editor controls, source boundary/exemption controls and native fault/retry cases pass. All six formerly failing native identities have one pass each: ignore, ignore-partial, ignore-append failures; partial append retry; ignore created during staging; partial metadata cleanup/retry. Reviewed counters>0 and original final assertions are retained.
C3 verified: selected nonlocal OpenCode placement/spawn and actual-agent native-child environment/shared-ignore path pass with original planted-secret positive control and allowed-value assertion; no local fallback or real external harness claim.
C4 verified: nonlocal overwrite bytes/mode restoration and appended-log truncation, legacy undo and SSH older-agent missing-stat refusal pass. Merge-specific forced Codex stat remap passes within10/10, including `durable remote handshake recovery retains Host and retries forward cancellation before settlement` and `async Codex settlement precedes recovery-row and role release`. All four bounded settlement cases pass, retaining one hanging producer and retrying only after failure/receipt.

New guard `remote LaunchFiles reads only Host metadata and bytes while the hub mirror stays unread` passes once in base plus5load repetitions. Source positively arms native mirror read/stat refusals before resetting its counter; final remote restore and unchanged/unread mirror assertions remain. It is not merely an unchanged-bytes observation.
Coordinator discovery carry-over retains changed-secret atomic replacement/reaches-up and same-stream publication drain in7/7 remoteDiscoveryHost. Claude18/18 and the six native injection counters remain preservation evidence after the dev integration.

Standalone launch-recovery/transport-forwards/host-local-contract/session-stop-races have no queued finish records here. A-16461 separately reports macOS targeted recovery4/transport6 and other preservation on the same production/test tree before the final wording-only commit; no Linux pass is invented for those deferred files. Prior failed batchcbf4407c and failed task0e027541 remain failed/incomplete. Old passing task runs apply only to their own heads and are not summed with this run.

All C1–C4 verified by current reviewed source and exact-head named results. Remaining batch repetitions, deferred files and after-stage QA remain separate. Reviewer performed read-only source/log inspection, no tests/typecheck/browser or edits.
A-16473: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-16473-t-1644-final-integrated-evidence-at-22233b23.md

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### coord · 2026-11-04T04:10:01.567Z

Merged 32e217854056072425f5fd1cbc463765f619f46c onto dev.
