---
id: T-1856
kind: task
title: Hub stop cannot cancel a hung worktree prune git; it can outlive the hub
state: open
status: review
size: M
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by: []
topic: topic-1664
branch: t/T-1856-hub-stop-cannot-cancel-a-hung-worktree
created: 2026-11-14T10:12:33.598Z
updated: 2026-11-20T10:31:19.563Z
---

## Summary

After T-1855, hub stop joins an in-flight worktree prune retry for a named bound. Past that bound it returns a typed "incomplete" outcome and leaves storage, tracker and lock for process exit. A prune `git` child that truly hangs can therefore outlive the hub as an orphan. T-1855's reviewer proposed bounded native cancellation of the owned prune processes instead. That change touches the shared `territoryGitAsync`, the host agent's command and removal integration (closure regeneration) and the Dispatcher/daemon stop fence, so it was split out here.

## What to build

At a hard bound after the soft log, hub stop terminates only the prune's own native processes, through their recorded native identity (existing endProcess), joins their actual close and the prune's settlement, and starts no new territory effects after cancellation. Leftover Git lock files are reported, not silently deleted. A native stop that cannot be confirmed keeps the retry owner usable and reports incompleteness.

## Acceptance criteria

- [x] C1. A hung owned prune git is terminated at the hard bound through its native identity, its close is joined, and no territory write happens after cancellation (test).
  - done: impl-1856 · 2026-11-20T10:29:48.462Z
- [x] C2. A process the prune doesn't own is never signalled, and an unconfirmed native stop reports incompleteness with a usable retry owner (test).
  - done: impl-1856 · 2026-11-20T07:16:36.488Z

## Comments

### coord · 2026-11-14T10:26:14.715Z

Added scope (from T-1855's supervisor check, 2026-11-14 10:26Z): hub.lock and territory.lock use stale-PID recovery. After an incomplete stop, serve exits 1, so the lock's PID is dead. A respawned serve (for example, under the operator's launchctl submit job) can reclaim the locks while an orphan prune git still writes territory.git. Native cancellation, or an orphan-writer fence that survives hub exit, must also cover this respawn case.

### impl-1856 · 2026-11-19T19:21:20.681Z

Consumer inventory (rules 20/41): territoryGitAsync production callers: territory.ts (inspection, create/remove, squash/restore/reconcile, candidate worktrees); territory-publish/push/release.ts; homebrew.ts; release-web.ts; batch-candidate-ownership.ts; tracker/epic-surfaces.ts; host/registry.ts and host/task-worktrees.ts; hub/{merge,demos,merge-batch-territory,dispatch,releases,dev-t3-probe}. Existing five arguments and Promise<string> remain unchanged outside a local prune async context. Host integration: localHost spreads agent/worktrees worktreeOperations; worktreeRemove calls agent/command.run; agent/operations and server wrap remote removal. New context is local-only and never serialized; remote path retains its existing ownership. Regenerate agent/closure.json for the new command import. Tests importing runner: push-component, publish-fixture, claude-code-remote, territory-task-branch, merge-component-support, web-release-publication, push, worktree-host, host-clone-integration, host-relaunch-retry/native, territory-cli, merge-batch-dependencies, host-runtime-join, host-push-on-ref-move, ssh-host-fixture, homebrew-publication, host-flush-native, host-relaunch, tracker-native-boundary. Stop consumers: Dispatcher.close, daemon.stop, CLI serve signals/stdio, joinMergeCleanup, settleRetainedMergeStop, projectHub root-removal guard. Guides: cland-init-and-cland-update merge-cleanup, hub README, merge-recovery/session-native-lifecycle file guidance. Help: HUB_USAGE and frozen cli-usage/commands.json require byte-identical migration. No wire or persisted shape changes. Coordinator decision dce569a6: start native cancellation immediately on stop within existing two-second exit budget rather than waiting 35 seconds.

### impl-1856 · 2026-11-19T19:40:51.532Z

Implemented at 98a3e619661bb0c5b645154849263b0e9f6bf646, pushed to origin with clean tree. Census addendum: all ordinary territoryGitAsync callers now keep their 30 s deadline through the same owned native cancellation/close join; existing Promise<string>, five arguments and TerritoryGitError stdout/code remain. Local prune Host worktreeRemove shares scoped ownership; remote wire has no context change. Final local macOS arm64 Node24.21 checks: reachable T1 117 files/1250 tests; merge-recovery T2 30/30; CLI help 9/9; native fake-Git territory and local-Host routes 2/2 with TERM resistance, SIGKILL positive control, identical-argv unowned no-signal/liveness control, retained index.lock diagnostic and unchanged bytes. Full typecheck and full test:lint pass, 0 lint refusals; report-only advisories remain. A-21885 is scanned durable evidence, including deliberate disconnected-route red control and provenance limits. Source review requested from reviewer; configured verify/load/Web and remaining T2/T3/T4 have not run.

### rev-35 · 2026-11-19T19:47:03.031Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-1
commit: 98a3e619661bb0c5b645154849263b0e9f6bf646
scope: full
findings: [{"severity":"high","text":"H1 · Spec/C2: incomplete native cancellation retains only in-memory prune/settlement owners, while serve still exits and stale-PID lock recovery can admit a replacement hub beside the surviving Git writer. Implement the item's required durable respawn/orphan-writer fence; documentation of the risk is not a scope exclusion.","file":"hub/src/cli/hub.ts","line":367},{"severity":"high","text":"H2 · Standards/rule26 and C2: asynchronous PID probes are not bracketed by the original ChildProcess's exit/signal state. If it exits while inherited pipes delay close and its PID is reused, a replacement birth can become the receipt passed to endProcess. Bind authority to the launched child's lifetime and add a deterministic reuse-interval refusal control.","file":"hub/src/prune-processes.ts","line":56},{"severity":"medium","text":"M1 · Spec: ordinary timeout creates a private PruneProcesses owner; false cancellation leaves run awaiting #confirmed forever, even after native close, and the public Promise<string> caller has no way to retry that owner. Retain a reachable recovery/settlement receipt instead of permanently stranding ordinary consumers.","file":"hub/src/territory.ts","line":400},{"severity":"medium","text":"M2 · Standards/rules20,39: scoped territoryGitAsync bypasses TerritoryGitError conversion, and agent/command.ts:79–82 converts every rejection to unknown code/empty outputs, losing known exit/output/nativeClose facts. Preserve ordinary failure contracts and structured cancellation metadata on both routes, with scoped consumer regressions.","file":"hub/src/territory.ts","line":399},{"severity":"medium","text":"M3 · Standards/rules9,12,38: the two new T3 callbacks and five new merge-recovery callbacks use raw t/resource registrations without a pre-acquisition owner joining the complete setup/body and retaining mock/native seams after cancellation or rejected cleanup. Migrate these additions to a whole-callback owner while preserving the real lifecycle and unowned-signal assertions.","file":"hub/test/prune-process-lifecycle.test.ts","line":18}]
finding_counts: {"high":2,"medium":3,"low":0}

Source1 full review at98a3e619661bb0c5b645154849263b0e9f6bf646/tree90fcc77428e873e9c9772d092e680a1eaa586d9a. Five consolidated findings in A-21887 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21887-t-1856-source1-respawn-launch-identity-recovery-and-contract-gaps.md).

High H1: cli/hub.ts:367 — incomplete native stop retains only in-memory owners; serve exits and stale-PID recovery still permits respawn beside a surviving writer, contrary to explicit item scope.
High H2: prune-processes.ts:56 — later PID birth observations lack an original ChildProcess exit/signal bracket; reused PID can be granted signal authority while close is delayed by inherited pipes.
Medium M1: territory.ts:400 — ordinary timeout hides an unconfirmed owner whose #confirmed wait can remain pending forever after native close, with no consumer retry path.
Medium M2: territory.ts:399 and agent/command.ts:79–82 — prune context drops TerritoryGitError class and known native exit/output/close metadata; ordinary scoped consumers were not migrated.
Medium M3: prune-process-lifecycle.test.ts:18 plus five new merge-recovery callbacks — no encompassing pre-acquisition setup/body owner retaining resources/root/mock/native seams on cancellation or rejected cleanup.

Lead a07dbf26/f77c1026/2433b686 confirm no omitted controls or scope exclusions. Immediate stop cancellation/1.5s bound,30s ordinary Git timeout and35s diagnostic match the Coordinator decisions; those do not waive respawn/authority requirements. Agent closure module/hash migration and help/frozen guide changes checked.

Marks: failed C1,C2; no verified marks. A-21885 is candidate-tree targeted/native ordinary-path evidence, not an exact-head configured run or proof of these exceptional boundaries. No Reviewer runtime/edit. Please correct all five together and request fresh source review before configured verification.

Criteria: C1 failed (Required post-exit/respawn writer fence is absent, scoped failure contracts lose receipts, and new lifecycle controls lack whole-callback cancellation ownership.), C2 failed (Asynchronous birth capture can authorize a reused PID, and ordinary timed-out commands hide the unconfirmed retry owner; respawn protection and rejection-path proof remain incomplete.).

### impl-1856 · 2026-11-19T20:09:01.676Z

Correction census addendum: new git-command-owner record schema is produced by prepareGitCommand and consumed by startup recoverGitCommands, async territory lock admission, per-command admission, and synchronous assertNoGitCommandRecovery (refusal only). Fields searched: PruneProcesses/territoryGitAsync, nativeClose/nativeCleanup, HostRunResult, boundedCommandResult/nativeCommandIncomplete/nativeCommandFailure, owned-exec and gate consumers, stageCase/componentProject/projectHub. Host result consumers: adapters/claude-code-local; host/signin-client, login-card-signin; agent/watch, signin-types, ref-push-worker, prepared, claude, login-disk, command. Metadata is additive; ordinary and older run-only scopes retain prior shapes; bounded cloning now preserves optional close/cleanup facts. Native admission/generation consumers otherwise unaffected because they do not enter local prune context. Fixtures/tests: host-contract/coverage, project-hub, claude-agent-launch, host-command-environment, login-card-signin-owner/trace, host-agent-signin-op, session-pool-placement, doctor-run, claude-code-remote, signin-client. StageCase default fake mode unchanged; optional native mode affects only the new prune native cases. Existing consumers: tracker-summary, stage-closure-component, dev-t3-coverage-component, tip-churn-file-fixture, item-summary-scale, startup-ready-component, startup-listener-scale, fixture-receipt-case and suite-persistence. componentProject adds optional pre-DB ownStop enrollment; all old callers retain their defaults. projectHub adds a fake default at the new recovery native boundary; only the recovery subject injects production checking with fake native receipts. owned-exec is reused unchanged; existing Git-maintenance gate consumer is unaffected. No user CLI syntax or role-permission change.

### impl-1856 · 2026-11-19T21:09:23.149Z

Source2 correction census: recovery now shares the existing territory reservation across processes, reusing an already-held context. withTerritoryLockAsync keeps its four-argument interface and delegates acquisition to exported withTerritoryReservation; only the normal wrapper and Git writer recovery consume that raw reservation. Existing acquisition/release policy is unchanged, context now covers recovery and operation. GitRecoveryServices adds an optional reserve seam; all new T2 recovery fixtures inject it explicitly, including prepareGitCommand parent-probe fixtures. A deterministic overlapping-recovery red/green control proves that a second recoverer cannot retire a stale captured-descendant snapshot. Opened receipt descriptors are checked for regular-file type, actual current uid, private access and a single link before JSON/native classification; publication remains0600, new receipt directories0700. Mode and independent descriptor-uid refusal controls run before native end calls. Record root device/inode are exact decimal strings, checked before checkpoints. The S parser-byte-bound debt accepted by Coordinator remains separate.

### impl-1856 · 2026-11-19T21:20:55.583Z

Source2 pushed at b9edd406c6a616cd7c147792ae1bae7361da7432/tree e97dcc9d514263b695252217ffb742792820012a; C1/C2 re-marked done and review requested from role reviewer in topic-1664. All five source1 findings corrected together. A-21911 records final local macOS arm64 Node24.21.0 typecheck and full lint exit0, selected T1 132 files/1373 tests, component/help53 and native2; configured verification remains unexecuted pending source verdict and a Coordinator verify window. Clean pushed tree, no post-source1 dev merge.

### rev-35 · 2026-11-19T21:32:03.871Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-2
commit: b9edd406c6a616cd7c147792ae1bae7361da7432
scope: full
findings: [{"severity":"medium","text":"M4 · Standards/rule39: after a no-child launch failure, rejected lease.clear reaches owned.incomplete without consulting the selected failure. The public rejection loses the launch code/message/cause and reports default cancellation metadata. Preserve that primary outcome with incomplete cleanup and secondary diagnostics; add a launch-throw plus rejected-clear control.","file":"hub/src/prune-processes.ts","line":91},{"severity":"medium","text":"M5 · Spec/C2: the parser accepts child:null and released:false with nonempty captured identities; recovery at :184–186 then unlinks that record without confirming those descendants absent. Enforce the producer invariant before native classification and retain unsupported records with a no-signal/retained-fence regression.","file":"hub/src/git-command-owner.ts","line":58}]
finding_counts: {"high":0,"medium":2,"low":0}

Source2 full review at b9edd406c6a616cd7c147792ae1bae7361da7432/tree e97dcc9d514263b695252217ffb742792820012a. A-21916 records the consolidated pass and evidence boundary.

Medium M4 (Standards): prune-processes.ts:91,187–195 loses the selected no-child launch error when finish/lease.clear rejects; the existing cleanup-rejection control covers nativeClose only.
Medium M5 (Spec): git-command-owner.ts:58,184–186 accepts child:null/unreleased with captured descendants, then retires that record without independent absence receipts. Refuse the unsupported combination before native classification and retain its write fence.

The five source1 corrections are present in the reworked design. Lead ecc1d1be confirms no additional controls or approved exclusions for these two residual intervals. Coordinator timing decisions and separately filed commondir debt were respected; contract consumers, docs, closure/help/frozen fixture migration checked.

Marks: failed C2; no new verified marks. C1 remains unverified pending corrected source and same-head configured execution. A-21911 remains local candidate-tree targeted/native evidence; configured verification is unexecuted. No Reviewer runtime/edit. Correct both together and request fresh exact-head source review before verification.

Criteria: C2 failed (No-child launch failures lose their selected outcome after cleanup rejection, and parser-accepted contradictory records can retire captured ownership without absence receipts.).

### impl-1856 · 2026-11-19T21:37:48.711Z

Source3 at 8128fb38080e5ac8e586bd4e3be47acd586d747b/tree b25e566ffba6c197c115cb277dc8551f46d33b87 corrects both source2 findings together. M4 preserves selected launch code/message/original cause through cleanup rejection and same-owner retry; M5 parser refuses unsupported null-child/nonempty-captured receipts before native classification, keeping the record and startup writes fenced. Existing record producer/consumers listed in the prior census remain unchanged; no new imports/result fields. A-21919 holds red/green and final-tree evidence. Full typecheck/lint exit0, selected132 T1 files1373/1373, component/help54/54, native2/2 macOS arm64 Node24.21.0. Native slot released; clean pushed head sent for role reviewer source3 review, configured verification unexecuted.

### rev-35 · 2026-11-19T21:39:17.499Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-3
commit: 8128fb38080e5ac8e586bd4e3be47acd586d747b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source3 clear at8128fb38080e5ac8e586bd4e3be47acd586d747b/treeb25e566ffba6c197c115cb277dc8551f46d33b87. Full source review and exact correction disposition: A-21920.

M4 resolved: the no-child incomplete result preserves the selected launch code/message and original Error as cause with its nested cause intact, adds secondary cleanup diagnostics, and retains the same retry/settlement owner until clear succeeds. The new whole-callback-owned control asserts no-process/no signals, rejected retry, repaired retry and final settlement.
M5 resolved: parser rejects null-child/nonempty-captured records before native classification. The production replacement-startup control requires exact-byte retention, unchanged hook, zero parent reads and zero signals; supported recovery assertions remain. Prior source1 corrections, contract consumers, docs/help/closure and lifecycle ownership remain as reviewed. No new imports/result shape; five-file correction only.

Marks: no new verified criteria. C1/C2 remain unverified pending same-head configured execution. A-21919 reports local macOS candidate-tree targeted/native and compiler/lint checks; it is not a configured run. Pre-fix red epochs remain separate. No Reviewer runtime/edit. Source is clear for the lead's Coordinator-granted verification window.

### rev-35 · 2026-11-19T22:01:02.131Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-evidence-1
commit: 8128fb38080e5ac8e586bd4e3be47acd586d747b
scope: evidence
findings: [{"severity":"medium","text":"M6 · Standards/rules20,38,41: the production batch Git adapter's existing execFile-only fake and synthetic /isolated root were not migrated to territoryGitAsync's new durable preparation boundary. Configured run fails ENOENT realpath '/isolated' before whitespace assertions. Migrate the owned fixture/native seam while retaining all byte-preserving path assertions; fresh source review is required before another run.","file":"hub/test/merge-queue.test.ts","line":654}]
finding_counts: {"high":0,"medium":1,"low":0}

Configured2957c24f/A-21922 at reviewed8128fb380 is failed, exit1. A-21923 contains literal failure, static attribution and exact partial receipt audit.

M6 medium: merge-queue.test.ts:654 mocks only execFile and uses /isolated. Actual failure at log34489 is ENOENT realpath '/isolated', before the whitespace assertions. New territoryGitAsync→PruneProcesses durable preparation precedes the old fake; the consumer was not migrated. Preserve the production adapter and all leading/trailing space/tab/newline assertions while correcting its whole-callback-owned disposable/native fixture boundary.

Producer receipts:6304 ordinary pass/1fail plus95 distinct passing load tests; no duplicate/unmatched start/finish identities. T0/all233T1 completed. T2 completed397 hub files (one failed);44 Neovim files unexecuted. All273T3 including changed prune native file,18T4 and55Web unexecuted. Own19 generated component controls passed base+5/5, including M4/M5, but do not complete the failed run.

Marks: failed C1 for incomplete configured acceptance, no verified marks; C2 remains unverified. Exact head/provenance and clean tree checked. Linuxx64/c-8ams3/Node24.21/Neovim0.12.5, browsernull; budget/lint advisories report-only. No Reviewer runtime/edit. Keep2957c24f red; correct M6, request fresh exact-head source review and a new Coordinator window before verification.

Criteria: C1 failed (Configured2957c24f fails in an unmigrated Git-consumer fixture before the changed native acceptance phase; required current-head configured acceptance evidence remains incomplete.).

### impl-1856 · 2026-11-19T22:20:07.037Z

Configured run2957c24f-ca75-4cbf-9eb3-0cc79d436961 is failed at8128fb380: T0/T1 passed, T2 red on merge-queue production whitespace fixture, changed native T3/Neovim T2/Web unexecuted. A-21922/A-21923 retain partial evidence, including6304 ordinary passes/1fail plus95 load passes, not a full pass. Coordinator attributed it to T-1856. Census addendum: Dispatcher passes a real root to batchRebuildReason; synthetic merge-batches cases at /isolated and /scratch/project provide BatchRepository, bypassing owned native Git. merge-recovery /fake-prune cases explicitly inject PruneProcesses or pruneCommand. Other direct territoryGitAsync callers use disposable real roots. Migrating merge-queue execFile-only fake, tracker-native-boundary cached/detached listing-result spies, territory-task-branch publication admission spy, and worktree-host branch-result spy. Host checkout fetch spy remains on native Host.run spawn, outside territory async ownership, so unaffected. Coordinator also approved correcting the new synchronous which call with existing whichAsync, proven red/green by the existing native no-sync guard. No dev merge or verify resubmission.

### impl-1856 · 2026-11-19T22:25:43.128Z

Source4 migration census complete: batchRebuildReason production default is invoked from Dispatcher with real project root; default prep/checkout/remove use real project/candidate directories. All synthetic BatchRepository cases in merge-batches bypass territory native Git; verification-tree/merge-gate/host-allow-list/merge-batch-dependencies use prepared disposable roots. Type-only/fake Git providers in push-component/publish-fixture/merge-component-support inject the whole Git contract. Native wrappers in territory-cli/task-branch, worktree-host, host-clone/relaunch/flush/push-on-ref-move, homebrew/web publication, push and ssh-host-fixture pass real fixture directories. Synthetic /fake-prune controls in merge-recovery explicitly provide fake owned/native or pruneCommand seams. Additional consumers migrated: merge-queue raw execFile fake now complete fake owner; three T3 files/four scenario observers now public PruneProcesses.git admission/result with positive hold receipts and whole-callback cleanup. Host worktree fetch close spy stays on Host.run and is unaffected. New internal executable seam has only default PruneProcesses construction in territory/merge plus fakePrune injection; default now uses existing whichAsync and rechecks cancellation before unchanged synchronous launch/gate capture. Native no-sync guard red before/green after; four migrated scenarios and prune routes passed under granted slot, released. Fresh source review and a new configured window will follow final checks.

### impl-1856 · 2026-11-19T22:29:36.988Z

Source4 committed/pushed f6d8fc317e5d86b40aca5bb5f572b95b4649bb48/tree1200f1eac176fd0582fd731947fe9d584dee40b0, clean. M6 plus expanded observer census and async executable correction are sent for fresh role reviewer review. A-21929 separates failed configured2957c24f from targeted source4 proof. Full typecheck/lint exit0; selected132 T1 files1373/1373; component/help94/94; approved native cases all passed with provenance limits recorded, slot released. C1/C2 re-marked done; no configured resubmission or post-source1 dev merge.

### rev-35 · 2026-11-19T22:33:07.879Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-4
commit: f6d8fc317e5d86b40aca5bb5f572b95b4649bb48
scope: full
findings: [{"severity":"medium","text":"M7 · Standards/rules12,24: territoryHub's new required closer owns only returned wrappers; Tracker is assigned after construction without openDatabase capture. A DB opened before constructor rejection leaves tracker undefined, so cleanup can falsely resolve and release root/seams. Use shared pre-owned native DB/Tracker acquisition with confirmed close, preserving the constructor failure and rejected cleanup obligation.","file":"hub/test/tracker-native-boundary.test.ts","line":23}]
finding_counts: {"high":0,"medium":1,"low":0}

Source4 full review atf6d8fc317e5d86b40aca5bb5f572b95b4649bb48/tree1200f1eac176fd0582fd731947fe9d584dee40b0. A-21931 records one residual medium finding M7 and complete correction dispositions.

M7 tracker-native-boundary.test.ts:23–35: pre-registering hub?.close/tracker?.stop does not capture DBs opened before a rejecting Tracker constructor returns. The required closer may resolve with tracker undefined. Reuse shared ownedTracker/ownedDatabases with the positive-close resource fence and a constructor/rejected-close interval control. Lead a6a938d0 confirms no omitted owner/control/exclusion.

M6 is resolved: real disposable cwd, complete fake owned boundary, all whitespace assertions and11 observed calls. Expanded native admission/result observers retain original work and command owners and positively prove holds; original lifecycle assertions stay. Async whichAsync lookup/cancellation recheck, constructor census, guides/index and prior durable/result fixes checked; no additional production finding.

Marks: failed C1, no verified marks; C2 remains unverified. A-21929 is scoped local candidate evidence, not configured exact-head or partial-constructor proof. Prior2957c24f stays failed with unexecuted phases unchanged. No Reviewer runtime/edit. Correct M7 and request fresh source review before configured verification.

Criteria: C1 failed (The migrated native Tracker fixture can authorize cleanup after constructor rejection without closing a DB acquired before wrapper assignment.).

### impl-1856 · 2026-11-19T22:37:45.035Z

M7 correction census: territoryHub moved unchanged into shared territory-hub-fixture so the T2 rejection control and native scenarios use exactly the same setup path. Consumers are tracker-native-boundary (all prior calls retain raw defaults; cached/detached cases supply the existing owner) and the new merge-recovery fake-preparation control. Only the owned route now calls existing ownedTracker/ownedDatabases before native DB acquisition; required positive-close receipt persists on rejected close. The helper retains its return fields and default preparation/Git/hub behavior. Optional prepare/openDatabase seams are fixture-only and injected together in the T2 control; native defaults unchanged. No production module, wire or config change. Native affected tracker cases passed9/9 at exact candidate e4831e17f7b8f62d186936184b75532d663c9bb5 and slot released. Prior failed configured2957c24f remains failed; source4 source verdict A-21931 stays separate until fresh review.

### impl-1856 · 2026-11-19T22:41:22.437Z

Source5 committed/pushed d246076e4dcfda4a7ed9e35408f543e285c93b79/tree e4831e17f7b8f62d186936184b75532d663c9bb5, clean. M7 uses shared pre-owned Tracker/DB seam with constructor-rejection, close-refusal, actual guarded-removal and repaired-close proof. A-21933 holds scoped red/intermediate/final evidence. Full typecheck/lint exit0; selected132 T1 files1373/1373; component/help95/95; affected native tracker9/9 at exact tree, slot released. C1/C2 re-marked done and fresh role reviewer source5 requested. No production change from source4; no dev merge or configured resubmission; failed2957c24f retained.

### rev-35 · 2026-11-19T22:43:01.231Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-5
commit: d246076e4dcfda4a7ed9e35408f543e285c93b79
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source5 clear atd246076e4dcfda4a7ed9e35408f543e285c93b79/treee4831e17f7b8f62d186936184b75532d663c9bb5. A-21934 records the five-file correction and full Standards/Spec pass; no findings.

M7 resolved: shared territoryHub owner route uses existing ownedTracker/ownedDatabases before construction. A native connection survives wrapper-constructor rejection under a required positive-close receipt. The extracted helper is used by both native cases and the T2 companion. The control preserves constructor error identity, rejects native close, retains DB/root/manual seam/native guard through actual guarded removal, repairs that close and observes DB closure before root/seam release. Independent guarding/fallback protects the red control. Raw defaults and native assertions remain.

No production change from source4; earlier durable/result/lookup and consumer corrections remain as reviewed. A-21933 retains red/intermediate/final local macOS candidate observations and exact-tree native tracker evidence, with older native receipts separately scoped. Configured2957c24f remains failed; no current configured proof yet.

No new verified marks: C1/C2 remain runtime-unverified pending same-head configured execution including changed native consumers. No Reviewer runtime/edit. Source clear for the lead's Coordinator-granted verification window.

### rev-35 · 2026-11-19T23:09:11.752Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-evidence-2
commit: d246076e4dcfda4a7ed9e35408f543e285c93b79
scope: evidence
findings: [{"severity":"medium","text":"M8 · Shared read-contract regression: any command record triggers recovery-reservation acquisition before healthy live ownership is recognized at :172–183. An ordinary concurrent rev-parse outside the held ALS context is now refused while the same-process merge holds territory.lock. No approved contract change exists. Correct admission with deterministic coverage while retaining actual-recovery serialization and unknown-writer fences.","file":"hub/src/git-command-owner.ts","line":145},{"severity":"low","text":"L1 · Existing fixture-cleanup aside (Bugs/S reported to lead): writing/merging are started without a failure-path join. A-21939:37084 records a later merge timeout/unhandledRejection after the interim read fails. If touched, give the callback controlled release and an encompassing join; otherwise file/deduplicate the observed bug.","file":"hub/test/tracker-native-boundary.test.ts","line":253}]
finding_counts: {"high":0,"medium":1,"low":1}

Configured13e92659/A-21939 at source5 d246076e is failed exit1. Full audit A-21941 preserves literal failure and partial evidence.

M8 medium: git-command-owner.ts:145–151 takes the reservation on any record before recognizing healthy live ownership. Existing tracker-native-boundary:259 concurrent `rev-parse dev` now throws CLAND_GIT_RECOVERY_REQUIRED/another territory operation holds the lock, before release of the held verdict write. Lead248dc347 confirms no approved read-contract change and Coordinator attribution; admission-policy decision forwarded. Preserve unknown/cleanup/copied writer fences while correcting compatibility.
L1 low: existing callback leaves writing/merging unjoined on failure; log37084 records post-test merge timeout/unhandledRejection. Reported Bugs/S to lead for filing/deduplication.

Ordinary6769pass/1fail plus100 separate load passes (20identities×5), paired unique records. T0/all233T1/all441T2 pass. All4changedT3 files execute once,1failed; remaining269T3 deferred.18T4/55Web unexecuted. Native prune territory/local-host passes and current M4/M5/M6/M7 controls retained as partial evidence; whole-case times are not stop latency. Printed allowance JSON is a suggestion, not an approved exception. General advisories report-only.

Marks: failed C1, no new verification; C2 unverified. Exact head/clean tree checked; Linuxx64/c-8ams3/Node24.21/Neovim0.12.5, browsernull. Prior2957c24f remains separately red. No Reviewer runtime/edit. Correct/disposition M8 then fresh source review before configured verification.

Criteria: C1 failed (Configured13e92659 fails because shared Git admission refuses an existing concurrent read while a healthy merge holds the territory reservation; current acceptance is not clear.).

### impl-1856 · 2026-11-19T23:30:41.725Z

Run13e92659-2df3-44e3-b492-1ea3bd722681/A-21939 remains failed atd246076e: T0/T1/allT2 passed, changed native T3 one failure/51 passing identities, Web/Neovim later phases unexecuted; Reviewer A-21941 records M8 and L1. Coordinator policy80281/eaa46: only current in-process birth/admission proof captured under its still-held reservation can avoid re-acquisition; persisted-only, orphaned, stale/reused, invalid and unconfirmed records still serialize/fence. Source6 implements private proof registration via additive optional GitCommandLease.onLive, called only after durable gate admission and original-child birth capture. Proof rechecks original lifetime, tuple, record/parent/root identity, reservation and phase; no fresh PID probe. Only prepareGitCommand and PruneProcesses use the production proof; fake leases remain compatible. Serialized recovery rereads under reservation and rejects birth mismatch against current owner. Native held-gate reproduction red before fix, green after; stale-start/reused-birth writers denied before launch. Verdict callback now owns/releases/joins write and merge, and observes healthy admission then view behind held write. Final native epoch6696d4be0d7a8d461ea5a97e69771255ff8a1bab passed2/2 after separately confirmed typecheck exit0; slot released. Earlier bbf native launch missed the typecheck precondition and is ineligible, explicitly reported to Coordinator. No production changes after initial green; final component96/96. Fresh source review will precede any configured retry.

### impl-1856 · 2026-11-19T23:34:12.383Z

Source6 committed/pushed232d1d517a2efeba79ca555172a0ce11c8f32bfd/tree6696d4be0d7a8d461ea5a97e69771255ff8a1bab, clean. M8 and folded L1 are sent for fresh role reviewer review. A-21947 retains configured failures2957c24f/13e92659, native red, proof/fencing controls, ineligible missed-typecheck epoch and corrected authorized final proof. Exact final tree: corrected typecheck/full lint exit0; selected132 T1 files1373/1373; component/help96/96; authorized native2/2, slot released. C1/C2 re-marked done. No post-source1 dev merge or configured resubmission.

### rev-35 · 2026-11-19T23:39:01.707Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-6
commit: 232d1d517a2efeba79ca555172a0ce11c8f32bfd
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source6 full review clear at232d1d517a2efeba79ca555172a0ce11c8f32bfd/tree6696d4be0d7a8d461ea5a97e69771255ff8a1bab. A-21948 records the admission redesign, Coordinator policy and evidence limits; no findings.

M8 resolved under primary80281e3c/eaa46f11: only private current-owner/native birth admission captured under its still-held reservation avoids reacquisition. Exact row object/parent+child tuples/root/phase/close/captured state and original-child lifetime are checked and rechecked; no fresh PID probe or read-only bypass. Other records retain serialized reread/recovery and birth mismatch refusal. Optional onLive is additive; persisted/result shapes unchanged. Native read+normal-write control and stale/reused writer refusals retain fence assertions; fake original-exit control keeps zero fresh probes/signals.

L1 resolved per5a084b11: write/merge held work is released and both original promises joined in finally under whole-callback ownership. Exact native admission and merge-view-behind-write receipts precede final dev/not-clear assertions. Earlier ownership/result/fixture fixes remain as reviewed.

No new verified marks: C1/C2 require same-head configured execution. A-21947 retains local final proof and explicitly ineligible missed-typecheck epoch; Coordinator36ebfa22 authorized the corrected final rerun after confirmed typecheck0. Both configured reds remain red. Scope clarification: run2 completed all441T2 including44NeovimT2; remainingT3/T4/Web were unexecuted. No Reviewer runtime/edit. Source clear for a Coordinator-granted window at this pinned head.

### impl-1856 · 2026-11-19T23:39:20.425Z

Source6 review clear rev-35-1856-source-6 at232d1d517; A-21948. Evidence clarification supersedes ambiguous Neovim wording in earlier notes/A-21947: run13e92659 completed all441 T2 files including44 Neovim T2 files; its unexecuted Neovim coverage was remaining T3/T4, with Web unexecuted separately. Source6 still requires same-head configured receipts; window requested, no resubmission yet.

### rev-35 · 2026-11-20T00:08:55.743Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-evidence-3
commit: 232d1d517a2efeba79ca555172a0ce11c8f32bfd
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head audit clear for77d243dd-e0e0-4f60-9aca-c24d227937ae/A-21951 at source6-reviewed232d1d517a2efeba79ca555172a0ce11c8f32bfd. A-21954 maps exact case/producer facts; no findings.

7123 ordinary tests pass (6951top-level/172nested),733 file envelopes; separately105 load tests/105 envelopes,21 component identities×5 distinct repetitions. All records paired/unique, no nonpass, no finish-identity overlap with either prior red. Manifest matches all233T1/441T2/55Web plus4changedT3 files; T0 exit0.53 changed-native identities pass once; remaining269T3 batch-deferred,18T4 unexecuted.

C1/C2: native territory/local-host prune cases pass36801/36810, asserting durable captured birth, owned SIGKILL, complete stop with native-close/prune join, retained Git-lock diagnostic, unsignalled matching peer positively alive and retired owner/no later writes. Whole-case2.152s/1.541s are not stop-latency measurements. Four stop/deadline×confirmed/unconfirmed component cases each pass+5/5, preserving usable same-owner retry, close/settlement distinction and final later-write refusal. Replacement startup, original-child exit/reuse, selected errors/cleanup, partial-constructor and scoped result controls each pass+5/5 as applicable. Current live admission/read/write/stale refusal36959 and joined verdict-write36971 pass once; whitespace23544 passes.

Exact head/worktree clean. Canonical candidate tree1fb12ef2 distinct from Git tree6696d4be; Linuxx64/c-8ams3/Node24.21/Neovim0.12.5/workers2, actual Chrome Headless Shell1248/Chrome for Testing156.0.8078.4. General duration/lint/ratchet advisories report-only; printed allowance proposals are unapplied. Both earlier configured runs stay red; source/ineligible native epochs remain separately labelled. No Reviewer runtime/edit.

Marks: verified C1,C2; no findings.

Criteria: C1 verified, C2 verified.

### impl-1856 · 2026-11-20T02:15:34.009Z

Batch 98dafc92 remains failed (A-22024): T0 passed, T3 failed, load identities incomplete/unknown. Four correction causes: (1) ownership checkpoints use atomic replacement; an opened old inode can have nlink=0 while the current path is a new private inode. Bounded reopen validates the new FD; all UID/mode/link/birth fences remain. (2) processStartedAsync is imported directly from its existing DB-free hub/lock module rather than the adapters/processes facade, preserving the same function and database-free release import graph. (3) host-flush's planted-parent-symlink fixture must allow an already created .cland/run parent; exact symlink and replacement-directory assertions stay. (4) Lead preparation/landing/recovery barriers must observe PruneProcesses.git results rather than execFile callbacks; positive holds and complete callback ownership preserve each real authority race.
Consumer census supplement: processStarted users retain the same function; adapters/processes exports remain unchanged for existing callers. Shared receipt readers are prepareGitCommand.clear, recoverGitCommands and recoverReserved; persisted format and wire schema unchanged. Relevant clients/fixtures: merge-policy, host-flush-native, cli-imports and the lead-permissions native callback. Broader execFile raw/alias searches: rule-fixture and lead-permissions-component use injected no-territory/fake probes (unaffected); daemon's held Git log remains Tracker.gitIn's unchanged execFile boundary; adapter-native-boundary and claude-code-environment spies target harness spawn/exec boundaries, not territoryGitAsync. Existing migrated tracker-native-boundary, merge-termination-native and worktree native observers remain on public owned-Git seams. Help/frozen usage bytes are unchanged by this correction.
Static stop budget: MERGE_CLEANUP_STOP_MS=1500 is the product stop receipt deadline. Native end receives an absolute 1000ms deadline with up to 200ms persisted-close joining. Test observation bounds are 30000/60000ms and do not choose incomplete status. Product deadlines unchanged by Coordinator decision. Quiet macOS production load gate: 2 ordinary cases plus 5/5 per route, exit0, two gate workers, min/max 1m load2.59/2.89. This does NOT reproduce or supersede the loaded Linux failure. Coordinator will run verify all at the freshly reviewed correction head, retaining bounded native-end and child-close diagnostics on failure. First overlapping policy/Lead runs are ineligible; their serial reruns were observed exited before each next launch.

### impl-1856 · 2026-11-20T02:16:06.706Z

Census filename correction: the existing public owned-Git observer consumers are tracker-native-boundary.test.ts, territory-task-branch.test.ts and worktree-host.test.ts (plus shared prune-case.ts), now also lead-permissions.test.ts. The preceding comment's merge-termination-native/worktree native wording referred to those existing migrated lifecycle consumers, not additional files. New batch correction changes no endProcess interface or signalling logic.

### rev-35 · 2026-11-20T02:30:01.697Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-7
commit: 83faefd5eff0ca3f09d53e2b8cd39d7404e61362
scope: full
findings: [{"severity":"medium","text":"M9 (Standards/rule9): migrated Lead callback's root/copy/write/push and projectHub acquisition lack separately named setup deadlines; pruneCase's whole-case bound does not separately bound setup.","file":"hub/test/lead-permissions.test.ts","line":74},{"severity":"medium","text":"M10 (Standards/rule12): projectHub startup join owns returned resources, but this new caller lacks pre-constructor openDatabase capture for Tracker/Store rejection before daemon return.","file":"hub/test/lead-permissions.test.ts","line":98}]
finding_counts: {"high":0,"medium":2,"low":0}

Source7 not clear; A-22049 records two medium Standards findings in newly migrated Lead callback. M9: root/copy/write/push plus hub acquisition are outside separate setup deadlines; whole60s pruneCase is narrower than rule9's separate setup requirement. M10: projectHub startup join cannot capture a DB opened before Tracker/Store constructor failure; use pre-owned openDatabase seam. Leadd1632138 confirms both without exclusion. Bounded current-inode retry, exact DB-free birth-function import, host parent fix, positive public owned-Git holds and permanent bounded diagnostic inspected; no additional finding. Primary315dc376/bdeb6674 keeps1500ms product stop/1000ms native deadlines unchanged. Batch98dafc92/A-22024 stays failed, Mac gate did not reproduce Linux; no stop-fix claim accepted. C1 failed; C2 done/unverified; no current runtime marks. Hold released for narrow correction and fresh source before Coordinator-owned Linux verify all. Preserve diagnostics/assertions and all failed/ineligible/older-head evidence; no run window granted.

Criteria: C1 failed (M9/M10: migrated Lead setup lacks separate owned deadlines and projectHub's partial Tracker/Store construction lacks pre-owned database capture.).

### rev-35 · 2026-11-20T02:35:55.090Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-8
commit: 974e71cbcee743fb139e0596ff1f8b16d17f9326
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source8 clear; A-22051 records full Standards/Spec pass at974e71cbcee743fb139e0596ff1f8b16d17f9326/treebaf77f5dc0f6bea720c3311550b222433577506c. M9 repaired with separate30s original repository/hub setup observations retaining original continuations. M10 pre-registers shared ownedDatabases before acquisition, forwards openDatabase through actual projectHub startup, transfers successful shutdown to hub.dispose and preserves direct captured-DB close proof on constructor rejection. Shared failed-close/root/seam control and all3 real Lead holds/exact assertions inspected. Four batch corrections and permanent stop diagnostic unchanged; no findings. Primary315dc376/bdeb6674 keeps1500/1000ms product deadlines; batch98dafc92/Linux incomplete stays unresolved. A-22050 local frozen-tree2/2 Lead/1T2/static checks are scoped, not Linux/configured proof; source7T1 not promoted. No new criteria verified; C1/C2 runtime settlement pending Coordinator-owned exact-head Linux verify all. Hold released; this is source clear, not final runtime/ready clearance. No Reviewer runtime/source changes.

### impl-1856 · 2026-11-20T04:42:07.040Z

Coordinator performance decision5157d9c4/56a0cc6a/1ab1d71c/1ef88918 supersedes the all-commands durable ownership policy: known read-only argv uses direct Git with in-memory stop ownership and --no-optional-locks; unknown argv remains writer; admission recovery still precedes reads. Writers retain a committed plain-JS gate and one durable PID/birth checkpoint before release; normal close retires without a redundant close fsync. Captured cancellation ownership still persists before signals. New requirements: every territory Git callsite's class is listed/asserted, and a real hub crash after release/restart recovers the record. Target readonly median<=30ms (~2x direct) on this Mac, then narrow review + Coordinator full rerun.
Consumer search before integration: gate path references in prune-processes.ts, git-maintenance-owner.ts, git-maintenance-fixture.ts, git-maintenance-cli.test.ts, prune-process-lifecycle.test.ts and tracker-native-boundary.test.ts; same-PID execve ABI kept. Lease producer prepareGitCommand is consumed by PruneProcesses plus direct merge-recovery controls; fields/path reader consumers remain recoverGitCommands/recoverReserved/assertNoGitCommandRecovery and lease.clear. Schema version1/legacy preparing records remain readable. Fake boundary migration: prune-case.fakePrune and injected prepare callbacks, merge-recovery/merge-queue observers, native original-child gate observer. Public owned result observers additionally in Lead/territory-task-branch/worktree-host remain intact. Whole source/raw-symbol census includes QA briefs, skills, startup probes, all test tiers and nvim; no other gate basename reader found. Current full Linux193fc203/A-22090 remains functional green at974e71cbc, audited A-22091, no final ready. Performance source change will need fresh source review and same-head run; no reuse claim for the changed source.

### impl-1856 · 2026-11-20T04:56:41.032Z

Classifier census is now frozen and executable in hub/test/fixtures/git-command-call-sites.json and git-command-policy.test.ts: 209 source callsite/wrapper entries across all16 producer modules, including import aliases, namespace/private/local wrappers and legacy cwd forms. 95 instantiated argv samples are read-only; 93 writer/conservatively unsupported samples retain durable ownership; 21 runtime argv forwarders have explicit dispositions rather than a fabricated fixed class (their class depends on actual argv at the shared runner). The local run-wrapper search deliberately also lists non-Git api/auth/release calls as unaffected/excluded from Git admission. Source comparison fails on any new/changed consumer; parser has positive alias/namespace/private/legacy controls. Current test takes~91ms and bounds source census to2000 current files, batches32 reads. Read grammar additionally covers log/show/diff families (external diff/textconv disabled), ls-tree/ls-files/for-each-ref, merge-base/check-ref-format/show-ref/rev-list, one-operand symbolic-ref and explicit read config modes. Unsupported flags, output files, write symbolic-ref/config and all unknowns stay writers. The new in-memory-read and one-publication-writer component regressions were both shown red before their fixes; they and the full component suite currently pass. Real hub crash/restart and final native/measurement coverage remain pending.

### impl-1856 · 2026-11-20T05:21:43.734Z

Performance-policy consumer census addition: runtimeTreePath admits only the committed hub/bin/owned-exec.mjs gate. Its shared consumers runtimeBundle, deliverRuntime/serialized installer, verifyAgentTree and host runtime manifest/delivery/restart fixtures use that parser; unrelated .mjs remains refused. Closure regenerated through generateAgentClosure. Git-command-call-sites fixture lists 209 producer/forwarding sites in 16 modules with independent read/write expectations and explicit dynamic dispositions. Config mode selection now comes from the shared grammar parser after consuming option values, with negative --file --get/--list controls (red observed before fix). Read commands retain admission fencing plus in-memory native stop ownership; writer publication and cancellation/recovery fences remain durable.

### rev-35 · 2026-11-20T05:40:39.261Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-9
commit: a565483adbf94c2a7cb29b60ad65245ee3c4b594
scope: full
findings: [{"severity":"medium","text":"M11 (Spec): direct object-reading commands can trigger promisor lazy fetch/pack writes; the policy suppresses optional locks/fsmonitor/diff helpers but not lazy fetch. No supported-repository exclusion exists. Fence the implicit write or retain writer ownership, with a deterministic regression.","file":"hub/src/git-command-policy.ts","line":70},{"severity":"medium","text":"M12 (Standards/rules9/26/39): !pidAlive accepts every non-EPERM observation error as absence, and the crash test has no structured writer exit/recovery/absence receipt bound to the captured child birth. Distinguish positive ESRCH/exact-owner settlement from unknown and keep an error control.","file":"hub/test/prune-crash-case.ts","line":157},{"severity":"medium","text":"M13 (Standards/rule9): the new root/preload/hub/client/create/claim setup has individual helper/step bounds and a whole-case bound, but no separate encompassing setup deadline. Add a named owned setup boundary without losing original-work/resource joins.","file":"hub/test/prune-crash-case.ts","line":31},{"severity":"medium","text":"M14 (Spec/Coordinator1ef88918): private #git calls always select argument1, so demos.ts's two one-array literal consumers are frozen as null/forwarded instead of having their classes asserted. Cover both private signatures and correct the concrete census dispositions.","file":"hub/test/git-command-call-sites.ts","line":30}]
finding_counts: {"high":0,"medium":4,"low":0}

Source9 not clear at a565483adbf94c2a7cb29b60ad65245ee3c4b594/tree551ca9ca: four medium findings, no lows; A-22103 records separate Standards/Spec review and primary Git documentation. Implementer7ae063f4/d2cde697 confirms all four without exclusion. The Coordinator-authorized class split, shared parser, one complete durable release record, serialized retirement, committed typed/static-checked MJS gate, exact runtime packaging/closure and compatibility consumers otherwise inspected. A-22102 final-tree samples independently match owned read p50 8.433/9.072/8.560ms against direct8.050/8.960/8.147, within <=30ms; writer p50 32.520/32.250ms and2 observed fsyncs. Measurement/prune policy treecd466 differs only in maintenance observer/skill provenance; local base4+5pernative identity is scoped quiet-Mac evidence, not new-head configured/Linux proof. Old193fc203/A-22090 stays at974e71cb; failed98dafc92 retained. Product1500/1000ms deadlines unchanged. C1/C2 failed for remaining gaps, no new verification. Hold released for one consolidated correction/fresh source before Coordinator full Linux run; no Reviewer test/check/native/provider/scanner or performance probe.

Criteria: C1 failed (M11/M13/M14: implicit lazy-fetch writes escape the read class fence; crash setup lacks an aggregate deadline and two concrete private consumers lack class proof.), C2 failed (M12: crash recovery's writer-absence assertion accepts unknown PID observation errors without an exact-birth positive native settlement receipt.).

### impl-1856 · 2026-11-20T05:55:03.563Z

Source9 correction census M11–M14: read capability is shared by PruneProcesses/territory/local Host commands. The harmless capability command is itself a conservatively owned writer through #execute; no unowned native probe is added. Cache key includes resolved executable path + dev/inode/size/mtime/ctime; concurrent consumers share the original receipt and unconfirmed cleanup preserves its error. Supported read argv adds --no-lazy-fetch (upstream2.45); unsupported/unconfirmed capability uses original argv + durable gate. gitReadLog ALS binds fallback reporting to the daemon's actual journal logger (once per executable/logger); ordinary CLI defaults to a structured stderr notice. No permission or remote wire change. Native fake support/refusal producers, fakePrune's explicit capability seam, policy/cache T1, daemon startup, five-route prune file and docs/help/frozen usage migrated. Private-wrapper census now distinguishes one-array from legacy cwd/argv:209 textual entries include97 concrete reads,93 writer/conservative/non-Git dispositions,19 real dynamic forwarders. Crash setup has a named aggregate owned deadline; exact writer observation returns captured-owner/structured native probe and birth facts, with ESRCH-only absence or positive replacement-birth and unknown errors retained. Consumer search covers shared tests/helpers, T3/T4/raw callers/QA/skills; no other new native constructor exists beyond fakePrune and production territory/merge owner construction.

### rev-35 · 2026-11-20T06:55:00.790Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-10
commit: 9e3f639d68ae082c4639e576fc18cc3dc0becd3f
scope: full
findings: [{"severity":"medium","text":"M15 (Standards/rule39): an incomplete nested capability/config probe is rethrown, then the outer read's no-child catch overwrites nativeAdmission/nativeCleanup with no-process/complete. Preserve the producer receipt and usable recovery owner through the full facade, with a nested incomplete-probe control.","file":"hub/src/prune-processes.ts","line":230},{"severity":"medium","text":"M16 (Spec): old-Git ordinary proof can outlive effective config changes because empty XDG uses the wrong path and system config paths are guessed. Coordinator45ef702c now requires a current direct in-memory-owned effective-config proof before every old-Git direct read; drop repository TTL/cache and control newly created global config/error fallback.","file":"hub/src/git-read-capability.ts","line":19},{"severity":"medium","text":"M17 (Standards/rule9): public trace JSON is rewritten on native close with writeFileSync while the parent parses it directly outside a publication retry. A partial close rewrite can fail healthy recovery. Publish complete snapshots atomically and retain bounded incomplete diagnostics/assertions.","file":"hub/test/prune-crash-case.ts","line":81},{"severity":"medium","text":"M18 (Spec): the promisor predicate omits remote.*.partialclonefilter, which alone registers a promisor remote in Git2.39/2.45. Such a repository can be falsely admitted direct without lazy-fetch suppression. Add that conservative key and its independent control.","file":"hub/src/git-read-capability.ts","line":11}]
finding_counts: {"high":0,"medium":4,"low":0}

Source10 not clear at9e3f639d68ae082c4639e576fc18cc3dc0becd3f/treeafbd2636: four medium findings, no lows; A-22108 records Standards/Spec and primary Git source references. M12–M14 exact native observation/aggregate setup/private census corrections are sound in source; M11's new-Git path is fenced, but old ordinary proof remains unsafe. fbfdc9fb/ade9b5cc/b654472e confirm metadata/config/trace gaps; acc09f03 identifies partialclonefilter condition. Marker-only and60s-origin-TTL proposals were rejected after source review; current primary45ef702c requires a fresh non-fetching in-memory-owned effective-config query before every old-Git direct read, unknown/promisor owned, no repository TTL cache. Re-measure<=30ms before further progress if exceeded. A-22107 exact-tree local1952T1/77focused/base6+30gate and200sample timing audited, not new-head configured/Linux/Web/T4 proof. Current cached-policy read p50 8.682/9.427/8.870ms meets prior target; cold85.503ms retained, new per-read policy unmeasured. Old193fc203 at974e71cb and failed98dafc92 remain separate. Product deadlines/native authority unchanged. C1/C2 failed, no verification; hold released for one consolidated correction/fresh source before Coordinator Linux run. No Reviewer runtime/edit/probe performed.

Criteria: C1 failed (M16/M18 permit an old-Git implicit writer without durable admission; M17 can reject partial trace JSON in the native crash proof.), C2 failed (M15 overwrites a nested probe's incomplete native cleanup/admission metadata with complete at the outer read facade.).

### impl-1856 · 2026-11-20T07:09:49.278Z

Source11 correction census (M15–M18): searched PROMISOR_CONFIG_KEYS, repositoryConfigKey, GitReadCapabilities.ordinary/supports, native ordinaryRepository, nested #execute probe calls, owner-traces/save/readers, cached ordinary/config-stamp wording across hub/src, hub/test, docs, .agents and nvim. Production consumers: PruneProcesses (current effective config-only direct/in-memory probe and public facade metadata); GitReadCapabilities (uncached ordinary receipt, executable support cache unchanged). Test consumers: git-command-policy, merge-recovery, prune-case fake/native seams, five prune lifecycle routes and prune-crash-case preload/reader. Docs: init/update ownership classes, SSH host, host-agent, three file guides; frozen HUB_USAGE/commands.json migrated. No wire/persisted owner shape changed; writer fences and product1500/1000ms deadlines unchanged. Reds retained for facade cleanup complete vs incomplete, config query count1 vs2, partialclonefilter false match, partial trace JSON. Accidental zero-selected T1 launcher started default discovery; cancelled by Coordinator direction, ineligible for all coverage. Coordinator attributed residual fake-opencode PID45855 to that cancelled fixture and authorized cleanup; its SIGTERM cleanup gap is noted separately, not corrected in this item.

### rev-35 · 2026-11-20T07:21:10.931Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-11
commit: d9df81bde2608904877791a7c9e7a7248294bac8
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source11 clear at d9df81bde2608904877791a7c9e7a7248294bac8/tree53f491d7; no findings. A-22110 records Standards/Spec review. M15 preserves nested producer native cleanup/output/recovery through the actual public territory facade and repairs/joins that same owner. M16 follows Coordinator45ef702c with a fresh effective-config-only in-memory-owned query before every old-Git direct read; no guessed origins/repository cache/TTL, unknown/promisor stays durably owned. M18 shared case-insensitive conservative key shapes include partialclonefilter-only. M17 shared atomic0600 temp/rename publication plus bounded original-child trace reader has an armed deterministic write-interval control. Existing exact-owner/aggregate-setup/census fixes, real assertions,1500/1000ms product deadlines and writer authority remain. Docs/help/frozen bytes migrated. A-22109 exact-tree Mac scoped receipts independently audited: explicit234hubT1/1953passes,76focused,base6+five per native identity with paired producer records; timing200samples gives owned read medians16.949/17.714/17.108ms below30, cold56.650ms retained,589/589captured child closes. These are ordinary Mac receipts, not current-head configured Linux/Web/T4 proof. Accidental default discovery is wholly ineligible and earlier reds preserved. No criteria newly verified; current C1/C2 runtime settlement awaits Coordinator's exact-head full Linux verification. Hold released; no Reviewer runtime/edit/probe.

### rev-35 · 2026-11-20T08:26:31.839Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-evidence-4
commit: d9df81bde2608904877791a7c9e7a7248294bac8
scope: evidence
findings: [{"severity":"medium","text":"M19: same-head Linux base legacy-read and four load repetitions return structured incomplete instead of required complete. Base producer diagnostic records native-end inspection deadline/state:threw with targeted close pending; other producer causes remain unknown. Preserve deadlines/assertions and resolve actual native close/settlement proof.","file":"hub/test/prune-process-lifecycle.test.ts","line":127},{"severity":"medium","text":"M20: five separate load repetitions fail 'leftover Git lock is reported' after complete/settled assertions. Establish the required report receipt without removing the lock or weakening assertions; do not classify these as the incomplete-stop failures.","file":"hub/test/prune-process-lifecycle.test.ts","line":129},{"severity":"medium","text":"M21: the compiler fixture's minimal hub source omits the new owned-exec.mjs input; its real workspace typecheck fails TS18003. Migrate the source fixture while retaining all root/worktree compiler-contract assertions.","file":"hub/test/typecheck.test.ts","line":34},{"severity":"medium","text":"M22: raw $1=show and push.test.ts:378 $1=rev-parse fault wrappers miss the new leading read flags. Reopen sees already-merged instead of the injected inspection error; both lost-publication CLI cases return0 instead of2. Migrate/prove fault engagement and complete raw-argv consumer coverage.","file":"hub/test/merge.test.ts","line":107}]
finding_counts: {"high":0,"medium":4,"low":0}

Evidence not clear at source11 head d9df81bde2608904877791a7c9e7a7248294bac8: producing bba8a07d/A-22118 finished failed/exit1. Four medium findings/no lows, A-22120 (corrects one drafting file-count sentence in retained A-22119). Exact counts: five base failures plus nine load failures =14, not14ordinary;8730basepasses/9skips,231loadpasses. Native legacy-read base fails incomplete; territory load1/local-host1,2/read-only1 also incomplete. Territory5/local-host3,4/read-only4/legacy-read5 instead fail required lock report. Only base legacy-read retains complete native-end diagnostic: state:threw, inspection deadline1000ms, target close pending, stop elapsed1501.747725ms; other native causes unknown. Raw$1 fault readers miss leading flags in merge/push; compiler fixture lacks new MJS input (TS18003). Source review missed those two consumer categories. T0/all234T1/441T2 complete;246hubT3files finish failed,27NeovimT3/55Web/18T4unexecuted, browsernull. No failed sibling/retry is promoted; old Mac gate and974e71cb Linuxgreen remain separate. C1 failed;C2done/unverified with no partial marks. Hold released for consolidated diagnosis/correction with Coordinator, fresh source before any changed-head verify. Product deadlines and final assertions retained; no retry/experiment authorized or performed by Reviewer.

Criteria: C1 failed (Same-head Linux required native stop/report assertions fail, and configured raw-Git/compiler consumers regress; A-22120 records the exact ordinary/load failures.).

### impl-1856 · 2026-11-20T08:44:19.439Z

Source12 diagnostic correction census (M19–M22): raw $1/case/args[0] search across hub/test, nvim/test, QA, shipped skills/docs and frozen fixtures. Migrated merge.test's show fault and push.test's territory rev-parse confirmation fault to public original-argv PruneProcesses.git observation with positive fault counts. release.test worktree remove/prune, merge-support/merge-native-support read-tree/write-tree/update-ref and executor-prepare fetch/ls-remote remain original-argv writers/conservative calls; other stubs consume the original injected Git/remote interface. Compiler fixture adds the exact committed owned-exec.mjs asset; root/inherited/local compiler checks remain. New callbacks use pre-acquisition root/resource/database ownership; the initial root/resource-context cycle failed locally, was retained, and was corrected by separating fixture roots from native resource acquisition. All three migrated native files are green (7/14/1). M20 deterministic red proved incomplete result lost the lock report before later same-owner settlement; result publication now attaches bounded lock facts for both incomplete and confirmed paths without overwriting the selected outcome. OwnedCommand.incomplete is internal; its consumers are cancellation aggregation and native-close/acquisition rejection handlers, now joined. No wire/record/classification shape or deadline changes. M19 remains unresolved pending Linux per-step tracing; fixture-only bounded OS probe/close/signal/checkpoint/proc-read diagnostics are embedded in assertions. Coordinator afc1f9c1 authorizes the next full Linux run as diagnostic only, not a merge gate; C1 stays failed/unverified.

### rev-35 · 2026-11-20T08:57:04.712Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-12
commit: f398047d5896ce07a37fc51b62018c079fba12b2
scope: full
findings: [{"severity":"medium","text":"M19 carried runtime gap: the required Linux native stop-completion assertion remains unresolved; source12 adds tracing without a stop fix. Coordinator afc1f9c1 authorizes a diagnostic occasion only, and C1 stays failed/unverified.","file":"hub/test/prune-process-lifecycle.test.ts","line":131},{"severity":"medium","text":"M23: the new uncertainty control's mkdir/writeFile setup is outside its named setup step, and push.test.ts:402,405,411 similarly leave event-read/lock-repair actions outside named bounds. Whole-case ownership joins the work but supplies no separate setup/action deadline (rule9).","file":"hub/test/merge-recovery.test.ts","line":129},{"severity":"medium","text":"M24: the newly migrated finally awaits hub disposal directly; push.test.ts:411–412 also awaits lock repair/disposal. A cleanup rejection replaces an earlier selected assertion/step error before fixtureWork can preserve it, losing the primary outcome (rule39).","file":"hub/test/merge.test.ts","line":137}]
finding_counts: {"high":0,"medium":3,"low":0}

Intermediate diagnostic source12 not clear at f398047d5896ce07a37fc51b62018c079fba12b2/tree8669909f. A-22128 records Standards/Spec review: carried medium M19 plus two new medium findings M23/M24, no lows. M20 lock-report publication and M21/M22 compiler/original-argv migrations are sound in source, with original assertions retained; new setup/action segments lack separate bounds and rejecting finally cleanup can replace the selected primary. Implementer14d7056a confirms both, no exclusion. A-22127 local retained pass counts audited with pre-final-message epochs distinguished; final raw-timestamp native6/6, typecheck/lint0 claimed/logged,0refusals/131report-only. Mac stop375.798–403.321ms and bounded trace do not establish Linux cause or fix. Prior bba8a07d/A-22118 remains failed per A-22120. Coordinator primary afc1f9c1 explicitly authorizes a diagnostic-only Linux occasion after intermediate review, not a merge gate; C1 stays failed/unverified until stop fix plus later full green. C2 remains done/unverified. No criteria newly verified; hold released for consolidated correction/fresh source. No Reviewer runtime/edit/probe.

Criteria: C1 failed (M19 Linux stop completion remains unresolved; source12 adds diagnostic tracing only. M23 missing setup/action bounds and M24 cleanup replacing primary errors remain in the new controls.).

### impl-1856 · 2026-11-20T09:08:48.424Z

Source13 (M23/M24) stays test/docs-only; no production, trace or native deadline changes. Shared fixture cleanup policy now re-exports the existing production withCleanupAsync, used by merge/push and the two component controls. Before changing that policy, extracting the callbacks' old finally behavior made the selected-error identity control red: cleanup's native-disposal refusal replaced the original assertion. Final shared policy preserves original error/code/output, attempts disposal even when repair rejects, retains the same failed-close root/seam guards, and repairs/joins them. M23 bounds aggregate uncertain-writer root/mkdir/write setup, final lock bytes, persisted event bytes, lock planting and both body/failure repair paths. Raw resource-close retry remains registered before effect and within the stage cleanup owner. Consumers searched: prune-case users in prune-crash-case, merge-recovery, lead-permissions, merge, push, territory-task-branch, worktree-host, merge-queue, typecheck, prune-process-lifecycle and tracker-native-boundary; only merge/push and the new controls use the additive export. Old exports/signatures and remaining consumers stay unchanged. Local exact candidate tree f792f936736b2cb6963bfc115eb798cd7510e204: full typecheck0, merge7/7, push14/14, component/policy69/69. C1 remains failed/unverified; the already-bundled 0ffd5580 is a diagnostic occasion at f398047d5, independent of these fixture corrections.

### rev-35 · 2026-11-20T09:14:37.424Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-13
commit: 835fe79156e36e3e5428e8fd5d1a5e34acad85a1
scope: full
findings: [{"severity":"medium","text":"M19 carried runtime gap only: required Linux stop completion remains unresolved. Source13 fixes the fixture bounds/cleanup policy but changes no production inspection or 1000/1500ms deadlines; C1 must remain failed/unverified until the stop fix and later full green.","file":"hub/test/prune-process-lifecycle.test.ts","line":131}]
finding_counts: {"high":0,"medium":1,"low":0}

Intermediate source13 reviewed at835fe79156e36e3e5428e8fd5d1a5e34acad85a1/treef792f936. A-22132: M23/M24 resolved, no new source findings/lows; overall not clear solely for carried M19. Complete uncertainty setup/lock read and push event/plant/repair actions have named bounds. Shared withCleanupAsync preserves the selected Error/code/output, with nested repair/disposal ordering; two exact-policy controls retain real root/seam fences after rejected cleanup and repair/join the same resource. Original native assertions retained. A-22131's extracted-finally identity red and final2/2 controls,69components,1953cases over234T1files,merge7/push14 passes audited as scoped local Mac evidence; full typecheck/lint exit0 reported,0lintrefusals/131report-only. No production/trace/authority/deadline/allowance change. Primary069149d7/61ab1907 permits these edits after source12 diagnostic0ffd5580 T0/bundling; afc1f9c1 explicitly makes that older-head occasion diagnostic, not a merge gate. C1 stays failed/unverified for M19; C2 done/unverified. No new criterion marks; hold released, no further M23/M24 correction or duplicate run requested. Await Linux cause before stop correction and later exact-head review/full green. No Reviewer edits/runtime/checks/probes.

Criteria: C1 failed (Carried M19 only: Linux native stop completion remains unresolved; source13 resolves M23/M24 fixture corrections but contains no stop fix or later full green.).

### impl-1856 · 2026-11-20T10:15:07.244Z

Source14 scoped-inspection census (Coordinator7b681a2a): only the two PruneProcesses.native.end calls opt into additive ProcessEndOptions.inspection='owned-tree'. Shared systemProcesses retains its existing signature and row shape; default endProcess still uses full views. Production direct/indirect consumers searched: executor/local, host/local, orphans, fixture-processes, suite-command, git-command-owner, termination-owner, remote/poller-lease; no persisted/wire contract or CLI byte changes. Test consumers in all tiers searched: system-process-probe/system-processes, host-boundary(.ts/.test), fake-claude-cleanup, merge-recovery, suite-timeouts, claude-code-remote/sessions-lifecycle, fixture-orphans(-lifecycle), session-resume-lifecycle, measure-memory/memory-producer, suite-cancel/suite-command, scenarios/hook-bridge, orphan-servers-perf, session-async-processes, host-revoke-native. QA E-1531/stage3 and shipped docs host-agent, modules, adapters-and-sessions, coordinator-subscription, declining-accepted-verifier and system-processes/measure-memory/suite-cancel guidance searched. These callers remain unaffected by opt-in; scoped tests and matching prune/system-process guidance migrate. Numeric Linux extraction is A-22137; original diagnostic green A-22135 is ancestor-only, not source14 proof. Work-count regression red on source13 production:5,471 ps rows. Local scoped stop green:84–85 rows, no full scans/omissions; all61 system-process controls pass. Native1000ms and merge1500ms bounds, original birth/close/unknown-owner fences and trace remain.

### rev-35 · 2026-11-20T10:25:42.174Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1856-source-14
commit: 45d2e73218ca90bcf26f7686c864a7340bd33dca
scope: full
findings: [{"severity":"medium","text":"M25: the assertion, guide at docs/agents/tests/hub-test-prune-process-lifecycle.test.ts.md:29, broad test name and A-22138 describe inspection as independent of machine population, but the cap counts only cland's returned/parsed ps rows; pgrep -P still enumerates natively. Coordinator08c85d55 accepts that algorithm only with narrowed test/docs/artifact wording and explicit pgrep disclosure. Apply that wording correction before source clearance; no production algorithm/deadline change is required.","file":"hub/test/prune-process-lifecycle.test.ts","line":136}]
finding_counts: {"high":0,"medium":1,"low":0}

Source14 reviewed at45d2e73218ca90bcf26f7686c864a7340bd33dca/tree65a1bd1e. A-22139 records one medium M25/no lows: parsed-ps cap excludes native pgrep enumeration, so machine-population independence/broad whole-work wording must narrow. Implementer1cdf8fca confirms no bound receipt; primary Coordinator08c85d55 explicitly accepts pgrep with wording-only correction and final Linux evidence, leaving task-children walk to T-2031. No production algorithm/deadline change requested. M19 has a responsive source correction: only two prune calls opt in, separate denial-only caller ancestry, selected ownership view, before/after+per-signal birth checks, reservations/checkpoint/freeze/late forks/retry/native close retained; default callers unchanged. M23/M24 intact. A-22138 audited: real work-count red5471rows;61system-process/1953T1 passes; production Mac gate67paired IDs,base6+load30/30files,each6identities1+5pass. Five base native-end samples350–418ms/101–102parsed rows,0full ps snapshots/omissions. Repetition native-end traces missing; whole-case seconds present and not cancellation latency. Fulltypecheck/lint0 reported,0refusals/131report-only. No current Linux/fullT2/Web/T4 proof; ancestor diagnostic/prior reds remain separate. C1 failed for M25, C2 done/unverified, no verified marks. Hold released for one narrow wording correction/fresh source; no new timing/native run requested or Reviewer runtime/edit.

Criteria: C1 failed (M25: narrow the test/docs/artifact work-count claim and disclose remaining native pgrep enumeration per Coordinator08c85d55; corrected-head Linux completion evidence remains pending.).

### rev-35 · 2026-11-20T10:31:19.563Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1856-source-15
commit: ee302b2de1891b572feba1e05a71c9fc9756860e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source15 clear at ee302b2de1891b572feba1e05a71c9fc9756860e/tree20124ee5; no findings/lows. A-22141 records Standards/Spec. M25 resolved: test names/messages/guides/artifact now identify cland-parsed rows/birth reads, disclose native pgrep enumeration and remove population independence, matching primary08c85d55. A-22140 corrects A-22138 wording and separates present whole-case repetition seconds from missing native.end timings/T-2027. Production subtree identical to source14 at887239535b2ead718a93a3a703d7df18ec33502c; predicates, authority/birth/freeze/checkpoint/retry/close/trace and1000/1500ms budgets unchanged; M23/M24 intact. Current local full typecheck/lint0 reported by retained footers,0refusals/131report-only. Source14 native base6+six5/5,61process and1953T1 passes remain ancestor local evidence; no source15 runtime proof inferred. Earlier Linux reds and source12 diagnostic green remain separate. C1/C2 done/unverified; no criterion verified. Clear source for Coordinator's planned exact-head final full Linux suite; final settlement requires producer/generated-case/per-step evidence at this head. Hold released; no ready/merge claim, Reviewer runtime/edit/check/submission.
