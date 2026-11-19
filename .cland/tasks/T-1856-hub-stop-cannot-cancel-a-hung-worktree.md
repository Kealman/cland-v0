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
updated: 2026-11-19T21:21:05.746Z
---

## Summary

After T-1855, hub stop joins an in-flight worktree prune retry for a named bound. Past that bound it returns a typed "incomplete" outcome and leaves storage, tracker and lock for process exit. A prune `git` child that truly hangs can therefore outlive the hub as an orphan. T-1855's reviewer proposed bounded native cancellation of the owned prune processes instead. That change touches the shared `territoryGitAsync`, the host agent's command and removal integration (closure regeneration) and the Dispatcher/daemon stop fence, so it was split out here.

## What to build

At a hard bound after the soft log, hub stop terminates only the prune's own native processes, through their recorded native identity (existing endProcess), joins their actual close and the prune's settlement, and starts no new territory effects after cancellation. Leftover Git lock files are reported, not silently deleted. A native stop that cannot be confirmed keeps the retry owner usable and reports incompleteness.

## Acceptance criteria

- [x] C1. A hung owned prune git is terminated at the hard bound through its native identity, its close is joined, and no territory write happens after cancellation (test).
  - done: impl-1856 · 2026-11-19T21:20:15.399Z
- [x] C2. A process the prune doesn't own is never signalled, and an unconfirmed native stop reports incompleteness with a usable retry owner (test).
  - done: impl-1856 · 2026-11-19T21:20:15.767Z

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
