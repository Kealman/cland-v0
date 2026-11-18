---
id: T-1672
kind: task
title: Renaming a remote OpenCode session moves its config and password directory on the hub's machine, not on the host
state: open
status: ready
size: S
criterion_seq: 3
labels: []
assignee: null
parent: E-1884
blocked_by:
  - T-1603
topic: topic-1622
branch: t/T-1672-renaming-a-remote-opencode-session-moves
created: 2026-11-04T04:18:17.821Z
updated: 2026-11-18T15:20:16.024Z
---

## Summary

impl-1603 found during T-1603 (2026-11-04) that `OpenCodeAdapter.renamed` still uses `existsSync`/`renameSync` on Host-derived paths. Renaming an OpenCode session on a remote host therefore cannot move its per-session config and password directory on that host: it operates on the hub's file system. T-1603 keeps the existing rename contract and leaves this open.

## What to build

The OpenCode session rename goes through the session's Host as an asynchronous, Host-owned move: atomic, with refusal on an existing target. The watcher and client identity then migrate to the new name. A remote rename never touches a hub-side path.

## Acceptance criteria

- [x] C1. Renaming an OpenCode session on a fake host moves its config and password directory on the host, and the session keeps receiving deliveries under its new name (test).
  - done: impl-1672 · 2026-11-18T13:31:47.276Z
  - verified: rev-35 [reviewer] · run rev-35-1672-source-4 · 2026-11-18T13:35:11.682Z · commit cf15c3400a654c58712dcd268530ee731863f1e4
  - verified: rev-35 [reviewer] · run rev-35-1672-source-5 · 2026-11-18T14:29:28.337Z · commit aa082b69625e861b461e6e0433a4c969bfe51dfa
  - verified: rev-35 [reviewer] · run rev-35-1672-source-6 · 2026-11-18T14:48:22.074Z · commit 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
  - verified: rev-35 [reviewer] · run rev-35-1672-evidence-2 · 2026-11-18T15:20:15.802Z · commit 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
- [x] C2. The rename never reads or writes a hub-side path of the same name: a planted mirror stays untouched (test).
  - done: impl-1672 · 2026-11-18T12:22:04.007Z
  - verified: rev-35 [reviewer] · run rev-35-1672-source-4 · 2026-11-18T13:35:11.682Z · commit cf15c3400a654c58712dcd268530ee731863f1e4
  - verified: rev-35 [reviewer] · run rev-35-1672-source-5 · 2026-11-18T14:29:28.337Z · commit aa082b69625e861b461e6e0433a4c969bfe51dfa
  - verified: rev-35 [reviewer] · run rev-35-1672-source-6 · 2026-11-18T14:48:22.074Z · commit 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
  - verified: rev-35 [reviewer] · run rev-35-1672-evidence-2 · 2026-11-18T15:20:15.802Z · commit 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
- [x] C3. A local OpenCode rename behaves as before, and its existing tests pass unedited.
  - done: impl-1672 · 2026-11-18T14:48:46.860Z
  - verified: rev-35 [reviewer] · run rev-35-1672-evidence-2 · 2026-11-18T15:20:15.802Z · commit 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c

## Comments

### coord · 2026-11-04T16:20:31.608Z

More evidence (impl-1666, 2026-11-04): `OpenCodeAdapter.renamed` (hub/src/adapters/opencode.ts ~390) can update the display and watch name while leaving the config and password at the previous host path. A later resume or retirement then derives the new name and misses those files. C1 and C2 should cover resume and retirement after a remote rename.

### impl-1672 · 2026-11-18T11:18:56.722Z

Consumer map before edits: HarnessAdapter.renamed is called only by Sessions' Core.onRenamed listener (sessions.ts:1039), through generationAdapter's generic process dispatch; fake harness has its own synchronous implementation and capability test. Core rename listeners are synchronous, so Sessions must explicitly observe async adapter rejection. Directory readers: OpenCodeAdapter #files -> launch/prepareFiles, attachCommand, #client/inject, #watch, resume, releaseHostGeneration; privateDirectory adapterState persists path+canonical+inode and must migrate. server.ts owns serverFiles/readPassword/privateServerPaths/retainedPrivateServerFiles; Sessions retirement inventory reads serverFiles layout. Consumers/tests found by renamed, serverFiles, privateDirectory, .cland/opencode and password searches: opencode-{host,adapter,native,remote,remote-cleanup,launch-policy}, adapter-{generation,native-boundary}, host-{attach,orphans,launch-layout,ssh-contract}, approval-restart, session-host-placement, fakes/{scripted-opencode,remote-approval-harness}, fixtures/host-launch-opencode.json; QA E-1536-stage-2,E-414 and stages 2/3,T-229,E-1532-stage-4; docs/adapters-and-sessions and opencode harness docs. Existing directory layout/bytes remain unchanged; those readers need no migration. New optional Host move operation must be implemented by local fileOperations and agentOperations/sshHost, with explicit absence refusal for older hosts. No CLI/help/wire reply fields change.

### impl-1672 · 2026-11-18T11:24:10.529Z

Capability/receipt consumer extension: move-directory-v1 is additive AgentHello.capabilities metadata; old-agent fake preserves the prior capabilities shape and refuses with code CLAND_HOST_CAPABILITY_MISSING, capability move-directory-v1, message 'host agent lacks moveDirectory'. AgentClient accepts additive hello fields. Agent server advertises capability and admits prepare-moveDirectory; PreparedOperations validates one shared parser, checkpoints plan/outcome, joins file operations and fences unknown interrupted commits. SSH uses the existing prepared settlement path; no direct unowned move RPC. Existing prepared-file tests and host hello/client/registry/settlement tests retain original shapes. Agent source in T-1672 is destined for v0.4.1: paired hosts receive via versioned agent update, newly prepared images include it; older images refuse until updated. Coordinator approved capability travelling in this item; no live host changed. Hub-side code requires restart after integrated cover. Initial red on macOS Node 24.21.0: ENOENT opening remote/new/password after current adapter moved the hub mirror. New 3 tests and all 14 pre-existing opencode-host T2 tests pass locally; no suite/remote/browser evidence yet.

### impl-1672 · 2026-11-18T11:34:20.224Z

Additional consumer obligations discovered by the exhaustive reachable T1 batch: agent/closure.json pins source hashes and host-contract.ts is the reusable Host member inventory. Both migrated; host-agent-closure.test.ts and host-contract-coverage.test.ts now pass 15/15 on local macOS. Original T1 batch retained as 861/863, not relabelled green. New direct Host/local regression and existing opencode-host cases passed 18/18 after those fixes. Coordinator explicitly keeps synchronous Core/socket rename; T-1967 owns pre-admission async name reservation and wire failure propagation. T-1672 persists structured host rename phase/cause, blocks delivery/resume/retirement across restart, and exposes the existing stateReason field in CLI/web. Commit bdbcf60ed; fetched and merged origin/dev before first review (already up to date). Native slot still queued for unchanged OpenCode adapter and shared local/SSH Host contract cases; no native run or verify submitted yet.

### rev-35 · 2026-11-18T11:47:41.250Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1672-source-1
commit: 94944819c13e16a59a15dbedd16b8503307199a0
scope: full
findings: [{"severity":"medium","text":"Four new Host/adapter callbacks and the new shared Host move callback lack pre-acquisition whole-body ownership/adoption/join; later directory cleanup/try-finally does not cover cancellation. A-21201 M1.","file":"hub/test/opencode-host.test.ts","line":14},{"severity":"medium","text":"Native guard restores in finally even after cleanup rejection; client prototype seams are t.mock-owned without positive cancellation lifetime; the new local fake case lacks a launch guard. Retain shared positive guard/manual seams through original completion (M2).","file":"hub/test/opencode-host.test.ts","line":22},{"severity":"medium","text":"The move's reservation has no captured/revalidated identity before rename or rmdir cleanup; adapter.renamed also reads the private source owner only after mutation. Replacement paths can be moved/overwritten/removed without ownership proof. Validate both captured owners and fence replacements (M3).","file":"hub/src/host/agent/files.ts","line":36},{"severity":"medium","text":"Running-only stateReason hides a persisted failed/unknown rename for stopped/exited rows although resume/retirement stay fenced. Coordinator's visible-status/CLI requirement has no such restriction; preserve/test the reason across restart (Spec M4).","file":"hub/src/adapters/sessions.ts","line":1205},{"severity":"low","text":"Add file-specific rename/mirror/capability/settlement/fence and ownership-control guidance; include relevant shared Host wrapper guidance (L1).","file":"docs/agents/tests/hub-test-opencode-host.test.ts.md","line":1}]
finding_counts: {"high":0,"medium":4,"low":1}

Full source pass at94944819c/basebb8a8344: Standards3medium+1low, Spec1medium; A-21201. Lead confirmed ownership/guard and path/status gaps08459f49/06c38456. Kept synchronous Core/socket contract is approved, not a finding; T-1967 owns broader pre-admission transaction. Capability rollout/old-agent structured refusal and prepared durable settlement audited. C3 implementation/selected local positives retained, queued unchanged T3 compatibility unverified. A-21198 preserves failed861/863 vs corrected15/exact33 and full typecheck/lint0 with unknown raw/hash/signal facts; no provenance rerun. No Reviewer tests/probes. Pin released; consolidate corrections and retain quiet/native-slot restrictions, then clean pushed-head source review before verify.

Criteria: C1 failed (Host move lacks captured path ownership and stopped-row failure visibility, and new test callbacks/guards lack complete cancellation ownership; M1–M4.), C2 failed (The new mirrored-host regression has unowned setup/body and premature guard/seam lifetime; correct its ownership proof (no claim that current mirror bytes were mutated).).

### impl-1672 · 2026-11-18T11:53:16.248Z

Correction plan for A-21201: M1/M2 new renameCase helper pre-enrolls caseDeadlines whole-body ownership and directory join guards, bounds setup separately, fences each continuation, keeps fixture-owned method descriptors and positive native guard installed until every resource closes; incomplete cleanup retains roots/seams. Existing 14 OpenCode tests remain unchanged. M3 regressions now drafted for saved-source replacement, pre-move reservation replacement and cleanup replacement. Production correction will add optional moveDirectory options.sourceIdentity (2-argument callers remain compatible) through the shared parser, Host, SSH prepared arguments and agent commit. Consumers searched: all moveDirectory/parseDirectoryMove/MOVE_DIRECTORY_CAPABILITY occurrences are this item's Host interface, adapter, fileOperations, SSH wrapper, prepared agent/server capability and new fake/shared contract tests; closure.json pins agent bytes. The mapped fake must forward options. M4 regressions assert actual Sessions.view stateReason for running/stopped/exited before/after fresh-adapter state read. No production correction applied yet: quiet holds red tests; typecheck only is running. Full review's original failed receipts remain retained in A-21201/A-21198.

### rev-35 · 2026-11-18T12:30:12.670Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1672-source-2
commit: 8a78ac17b7c8e534a4d50e7f1cf241c2ca828553
scope: full
findings: [{"severity":"medium","text":"Residual M3: source/reservation inode checks are separate from asynchronous pathname rename; a replacement after the last successful check can still be moved/overwritten. Cleanup validation and rmdir at :62 have the same gap. Current controls replace before revalidation, not after a successful read. Resolve the mutation/no-clobber ownership contract (or obtain explicit scoped disposition) and cover the promised boundary; another asynchronous stat alone does not close it. A-21231, lead confirmation 7ba3e937.","file":"hub/src/host/agent/files.ts","line":59}]
finding_counts: {"high":0,"medium":1,"low":0}

Full corrected-source pass at8a78ac17b/basebb8a8344, Git tree41e7a9f3: Standards1medium and Spec1medium assess the same residual post-check move/cleanup race, not two independent defects. A-21231. Earlier callback/late-root/native-guard/manual-seam ownership, stopped/exited Sessions.view and guides resolve A-21201 M1/M2/M4/L1. C2/C3 done marks and qualified supporting positives remain, no final runtime verification claim. Scope decisions T-1967 synchronous Core and T-1969 non-live Web retained. A-21226 preserves correction red4/4 then green4/4, fixed f9a6e5267 selected889/889 across83T1+2T2 (statically validated85unique paths), native21/local1/SSH18 at qualified precommit epoch, final exact-head full typecheck/lint0/zero refusals; final docs-only diff independently confirmed. Earlier failures and unavailable hashes/signals/raw receipts remain explicit; no configured Linux/Web/cover/QA execution. Read-only Reviewer, no probes or edits. Hub restart interrupted artifact publication; current live item inspected before idempotent artifact retry. Hold released for bounded correction/scoped contract decision, then fresh clean pushed-head source review before verify.

Criteria: C1 failed (Host move and reservation cleanup still mutate by pathname after separate identity checks, allowing post-check replacements to be moved, overwritten or removed; residual M3.).

### impl-1672 · 2026-11-18T12:37:21.438Z

Coordinator9ffe9fd1/bd0e7f3f establish the final supported contract: one serialized Host directory owner, arbitrary same-user out-of-band writers outside scope; ship checked fallback plus post-move destination dev/ino identity proof. No native bridge/dependency in this item; retain injected no-replace available/unsupported seam and file native binding follow-up. New owner/post-identity controls were red2/2 (both Missing expected rejection), then green2/2 after shared owner and unknown fencing. Consumer extension before integrating owner everywhere: all Host mutation methods write/publish/append/mkdir/remove/move, local Host spawn log open, agent prepared spawn log open and agent process log acquisition must take the directory owner; read-only operations are unaffected. Prepared move unknown producer receipt keeps the committing plan fenced/pending and never replays. Existing two-argument move callers remain supported.

### impl-1672 · 2026-11-18T13:03:59.504Z

Residual source-review M3 is addressed at b3277ed0ffd3c4f3e068f247f31eee74760f24aa under the Coordinator's explicit single-owner scope (9ffe9fd1-d157-416d-bbc8-23b1830f9dd4; bd0e7f3f-9669-4dde-a41a-c3332f256549): overlapping Host-managed writes/publication/append/mkdir/remove/move/log-entry acquisition share lexical+canonical directory ownership. Shipped Node uses the checked fallback, then checks destination dev/ino/type; unknown outcomes fence the owner and retain committing prepared operations without replay. Out-of-band same-user native writers remain outside the supported model, stated in docs. The injected no-replace seam covers available and positively unsupported paths; no native bridge is shipped. A native no-replace Host-agent binding remains a proposed Follow-ups (M) item requiring runtime/dependency approval. b327 adds the EIO-after-effect cleanup regression, retaining the producer error as cause rather than misclassifying an uncertain outcome. Broader synchronous Core transaction and non-live web renderer follow-ups remain T-1967 and T-1969. Full typecheck and full test:lint passed at this head (local macOS, Node24.21.0); configured verification has not run. Selected T1/T2 repeat is running, with its prior lost completion receipt explicitly incomplete.

### rev-35 · 2026-11-18T13:12:27.049Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1672-source-3
commit: b3277ed0ffd3c4f3e068f247f31eee74760f24aa
scope: full
findings: [{"severity":"medium","text":"Managed write/truncate/append and append-log opens own only dirname(file); an existing file symlink A/link→B/file follows into B without enrolling B's lane, bypassing a managed move of B. Cover the dereferenced file/referent or refuse it consistently across local/agent/prepared opens; this needs no out-of-band concurrent writer. A-21260 M1; author f676cdc0.","file":"hub/src/host/agent/files.ts","line":121},{"severity":"medium","text":"The new DirectoryMoveUnknown committing-plan fence lacks a move-specific production commit→settle→fresh PreparedOperations recovery regression. Direct fileOperations unknown tests and accepted lost-reply SSH settlement do not exercise durable pending/non-replay/mutation refusal on this branch. Add fake-only owned control; author confirms 12a0621d. A-21260 M2.","file":"hub/src/host/agent/prepared.ts","line":209}]
finding_counts: {"high":0,"medium":2,"low":0}

Full source b3277ed0f/basebb8a8344 tree91836f6a: Standards2medium; Spec1medium is the same alias defect, two independent gaps total. A-21260. Primary Coordinator9ffe9fd1/bd0e7f3f explicitly close arbitrary-writer/no-native-bridge objection; checked fallback and DI no-replace scope honored. Earlier callback/guard/manual-seam and stopped-row fixes intact. C2/C3 done/support retained, no final verification. A-21255 reports current selected894/894 across statically validated85unique files83T1+2T2, full lint/typecheck0/zero refusals; lost current attempt remains INCOMPLETE. Native21/local1/SSH18 belong to1089830db before final uncertainty fix, qualified; earlier reds/partial epochs retained. Closure hashes statically match; public wire/help/tier shapes unchanged, no Web/QA/remote configured run. Read-only Reviewer, no tests/probes/edits. Hold released; consolidate bounded alias and remote unknown proof corrections, then fresh pushed-head source review before verify.

Criteria: C1 failed (The managed directory owner can be bypassed through final file symlinks, and remote unknown-move commit/settle/reopen fencing lacks a production regression.).

### impl-1672 · 2026-11-18T13:23:20.249Z

A-21260 corrections committed/pushed as 04e04253e813c6c667d805f184e7019b28a219f0 (tree e3277d7e27eadb760bfef48a4bf419719cb15de8). Shared directoryOwners.runFile owns entry directory plus full resolved file referent; all dereferencing write/truncate/append and local/prepared/direct-agent log opens import it. Canonical fallback follows dangling links with a bounded traversal rather than losing the missing target's lane. Publication/removal remain entry mutations. Consumer search: these are all runFile callers; server commit-prepared delegates once to PreparedOperations, SSH's prepared wrapper settles lost replies instead of replaying. New move-specific committing-phase re-entry guard preserves unknown plans; no non-move behavior changed. M1 controls cover all six production paths with existing/missing referents: red6/6 for each topology before its fix, final combined14/14 green with the two production prepared unknown controls. M2 reads exact committing bytes/no result, pending owned settlement, wrong-owner refusal, retry plan preservation, closes/reopens a fresh owner, proves assertMutable/prepare/commit/abort refusal, one native move and retained effects. It caught a real repeat-commit erosion: literal ENOENT reading the erased prepared/<token>.json; move-only guard fixes it. Full typecheck passed on this tree; lint and final selected T1/T2 still pending. The Coordinator's 4acfc1ff capped bar applies; non-move same-phase guard filed separately as Tech debt S. No native/real-host/SSH/browser execution in this correction.

### rev-35 · 2026-11-18T13:35:11.682Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1672-source-4
commit: cf15c3400a654c58712dcd268530ee731863f1e4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full final capped sourcecf15c3400/basebb8a8344 tree8caf1265 clear under primary Coordinator4acfc1ff four-point bar; Standards0, Spec0; A-21277. A-21260 alias bypass resolved by shared runFile for following write/truncate/append and all log opens, including dangling referents; twelve actual-order controls. Move-specific production commit→pending settle→fresh-owner proof covers both identity mismatch/lost completion, exact retained checkpoint, wrong-owner/admission/abort/recommit refusal and one effect; move-only committing guard closes erosion. Existing remote mirror/new-name delivery/resume/retirement, older-agent structured refusal, visible persisted session fence and scoped checked fallback retained. C1/C2 verified from source/current local controls; C3 still runtime-unverified: native21/local1/SSH18 belongs to1089830db, explicitly not current after following-file changes. A-21273 currentselected908/908 across85unique83T1+2T2, opencodeHost40 incl14unedited, fulltypecheck/lint0/zero refusals; failed/interrupted/unknown epochs retained. Closure hashes statically correct; no tiers/wire/help/Web change. T-1967/T-1969/T-1978/native bridge follow-ups nonblocking; T-1680 second-landing mapping obligation retained. Read-only Reviewer no tests/probes/edits. Hold released; keepheadstable, request Coordinator window for configured same-head mode-free verification; no final suite/QA/native-current claim.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-18T14:18:32.334Z

Merge-delta assessment (report-only)
{"reviewed":"cf15c3400a654c58712dcd268530ee731863f1e4","head":"fe2008ad35267ca05f6e9c39d8dbea252a7d868c","dev":"7182b5f906ff8c7d008a8209942959c3e3483b30","mergeBase":"bb8a8344131eba5a570c70a63024866b0bede98e","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":["docs/agents/tests/hub-test-host-ssh-contract.test.ts.md","docs/agents/tests/hub-test-opencode-host.test.ts.md","docs/hub/ssh-host.md","hub/src/adapters/contract.ts","hub/src/adapters/opencode.ts","hub/src/adapters/sessions.ts","hub/src/host/agent/closure.json","hub/src/host/agent/directory-owner.ts","hub/src/host/agent/files.ts","hub/src/host/agent/prepared.ts","hub/src/host/agent/processes.ts","hub/src/host/agent/server.ts","hub/src/host/host.ts","hub/src/host/local.ts","hub/src/host/ssh-host.ts","hub/test/host-contract.ts","hub/test/opencode-host.test.ts","hub/test/rename-case.ts"],"devPaths":[".agents/skills/implement/CHANGES/T-1894-member-receipts.md",".agents/skills/implement/SKILL.md",".agents/skills/merge/CHANGES/T-1894-member-receipts.md",".agents/skills/merge/SKILL.md",".agents/skills/onboarding/SKILL.md",".agents/skills/qa/CHANGES/T-1894-member-receipts.md",".agents/skills/qa/SKILL.md",".cland/tasks/T-1634-the-scratch-git-helper-s-held-writer.md",".cland/tasks/T-1642-a-sharded-close-test-waits-30-s-of-wall.md",".cland/tasks/T-1643-the-stage-cover-gate-test-s-fake.md",".cland/tasks/T-1672-renaming-a-remote-opencode-session-moves.md",".cland/tasks/T-1679-session-recovery-resumes-by-name-from-a.md",".cland/tasks/T-1680-a-shared-recording-host-test-helper-so.md",".cland/tasks/T-1808-a-shared-evidence-publish-helper-that.md",".cland/tasks/T-1894-no-batch-t1-when-every-member-s-verify.md",".cland/tasks/T-1966-merge-the-two-secret-scanners-qa-demo.md",".cland/tasks/T-1967-session-rename-as-a-pre-admission.md","docs/agents/tests.md","docs/agents/tests/hub-test-executor-droplet-component.test.ts.md","docs/agents/tests/hub-test-executor-lease-index.test.ts.md","docs/agents/tests/hub-test-executor-prepare-component.test.ts.md","docs/agents/tests/hub-test-host-survival.test.ts.md","docs/agents/tests/hub-test-merge-batches.test.ts.md","docs/agents/tests/hub-test-recording-host.test.ts.md","docs/agents/tests/hub-test-suite-close-recovery.test.ts.md","docs/agents/tests/hub-test-suite-stage-cover.test.ts.md","docs/agents/tests/hub-test-verification-tier-receipts.test.ts.md","docs/agents/tests/index.md","docs/hub/adapters-and-sessions.md","docs/hub/running.md","docs/hub/verification-tier-receipts.md","hub/README.md","hub/src/adapters/sessions.ts","hub/src/batch-member-verification.ts","hub/src/cli/usage/merge.ts","hub/src/executor/droplet/droplet.ts","hub/src/executor/droplet/lease.ts","hub/src/executor/droplet/prepare.ts","hub/src/executor/droplet/readiness-deadline.ts","hub/src/executor/droplet/run.ts","hub/src/executor/executor.ts","hub/src/host/launch-layout.ts","hub/src/host/local.ts","hub/src/hub/merge-batches.ts","hub/src/hub/suite-worker.ts","hub/src/hub/suites.ts","hub/src/suite-worker-admission.ts","hub/src/verification-tier-receipts.ts","hub/test/adapter-generation.test.ts","hub/test/artifact-host.test.ts","hub/test/batch-member-verification.test.ts","hub/test/claude-code-host.test.ts","hub/test/claude-code-remote-files.test.ts","hub/test/codex-host.test.ts","hub/test/codex-remote-cleanup.test.ts","hub/test/codex-remote.test.ts","hub/test/codex-sandbox-host.test.ts","hub/test/durations.json","hub/test/executor-droplet-component.test.ts","hub/test/executor-launch-boundary.test.ts","hub/test/executor-lease-index.test.ts","hub/test/executor-prepare-component.test.ts","hub/test/fakes/digitalocean/scripted-machine.ts","hub/test/fixtures/cli-usage/commands.json","hub/test/host-attach-routing.test.ts","hub/test/host-launch-layout.test.ts","hub/test/host-revoke.test.ts","hub/test/host-survival.test.ts","hub/test/launch-files.test.ts","hub/test/lead-permissions-component.test.ts","hub/test/merge-batches.test.ts","hub/test/opencode-launch-policy.test.ts","hub/test/opencode-remote-cleanup.test.ts","hub/test/project-hub.test.ts","hub/test/recording-host.test.ts","hub/test/recording-host.ts","hub/test/session-host-placement.test.ts","hub/test/session-host-routing.test.ts","hub/test/session-host.test.ts","hub/test/suite-close-recovery.test.ts","hub/test/suite-unit-fixture.ts","hub/test/suite-worker-cause.test.ts","hub/test/territory-task-branch.test.ts","hub/test/tiers.json","hub/test/verification-tier-receipts.test.ts","hub/test/worktree-host.test.ts"],"overlap":["hub/src/adapters/sessions.ts","hub/src/host/local.ts"],"dependency":{"status":"known","importers":["hub/src/adapters/opencode.ts","hub/src/adapters/sessions.ts","hub/src/host/local.ts","hub/test/host-contract.ts","hub/test/opencode-host.test.ts","hub/test/rename-case.ts"]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1672 · 2026-11-18T14:21:37.942Z

Coordinator40b117f5 authorized the one post-review dev merge after T-1680 landed. Merge fe2008ad35267ca05f6e9c39d8dbea252a7d868c takes origin/dev7182b5f906ff8c7d008a8209942959c3e3483b30 (includes T-1680 ca09b4666) without conflict. Mapping/migration delta committed aa082b69625e861b461e6e0433a4c969bfe51dfa, tree abec9affaffa8cefb87efe8a1cb2ffe169c424b6: one exhaustive moveDirectory entry maps both paths and forwards options; one component regression covers wrong identity, positive inode/bytes, existing target and outside source/destination refusal. Existing helper census plus new case were red4/6 (missing member/TypeError), then green6/6. opencode-host's bespoke remote mapper and eleven recording/fault bases now use recordingHost; explicit native/process overrides and assertions stay unchanged. Actual localHost subjects remain for local file/move/reservation/log-authorization tests. Migrated opencode-host40/40 green. Consumer census: recordingHost imports in adapter-generation, artifact-host, claude-code-host/remote-files, codex-host/remote/remote-cleanup/sandbox-host, executor-launch-boundary, host-attach-routing/launch-layout/revoke/survival, launch-files, lead-permissions-component, opencode-host/launch-policy/remote-cleanup, project-hub, session-host/placement/routing, territory-task-branch, worktree-host and recording-host contract. Those other doubles do not call the new operation; their existing fake semantics stay unchanged. Includes T3 consumers explicitly; no production/startup/persisted reader or shipped QA/skill uses this test helper. Guides updated. Fresh import graph now100 affected T1 plus3 conservative unknown inputs (suite-remote-budget, verification-tier-receipts, web-notifications); all will run before window request. No native slot/verify submission yet; old cf15c3400 clearance/receipts are superseded for final runtime purposes by this authorized head change.

### rev-35 · 2026-11-18T14:29:28.337Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1672-source-5
commit: aa082b69625e861b461e6e0433a4c969bfe51dfa
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized delta aa082b696 treeabec9aff clear; Standards0 Spec0; A-21292. Primary Coordinator40b117f5 rule11 exception confirmed: mergefe2008ad3 parentscf15c3400/7182b5f90 includesT1680ca09b4666, no conflicts. Ownpostmergefivefiles46+/19-: exhaustive recordingHost.moveDirectory maps both paths/options toproductionfiles, guardedwrongidentity/move/inode/bytes/occupied/outside-path regression, bespoke remote and11recording/faultbase migrations preservingoverrides/assertions andactuallocalSubjects, twoguides. Noownproductioneditaftermerge; priorfourpointcapretained. Coremove/owner/prepared/visibility preserved; upstreamsharedlayout/Sessionsrecoveryinteractionread. C1/C2 renewedsource/localverified; C3currentnativepending (1089830db native21/local1/SSH18 remainoldqualified). A-21290 currentselected1093/1093 acrossstaticallyvalidated106unique103T1+3T2 inclrecording6/opencode40; fulllint/typecheck0/zerorefusals, report-onlyadvisories; oldred4/6 andallfailed/partialepochsretained. Closurehashesstaticallymatch, noownWeb/QA/currentconfigured/nativeclaim. Read-onlyReviewerno tests/probes/edits. Holdreleased; keepheadstable, request Coordinatoroneverify/onenativeturn asdirected, finalsameruntimeevidencesettlementpending.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-18T14:41:54.950Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1672-evidence-1
commit: aa082b69625e861b461e6e0433a4c969bfe51dfa
scope: evidence
findings: [{"severity":"medium","text":"The new linked paragraph matches the README stale-feature contract (`plan stays pending`), causing web-readme.test.ts to fail and stopping configured verification before T2/T3/T4/Web. Reword without losing unknown-move/fence/restart semantics; preserve the assertion.","file":"docs/hub/ssh-host.md","line":106}]
finding_counts: {"high":0,"medium":1,"low":0}

Failed/partial same-head evidence settled in A-21298. Owner 45031eb0/A-21295 is finished/failed at aa082b696; literal `AssertionError [ERR_ASSERTION]: hub/README.md must describe shipped features` at log10255. T0 passed; T1 has 1865 pass/1 fail and 227 pass/1 failed file envelope; later phases unexecuted. The actual array repeats one docs/hub/ssh-host.md:100–110 paragraph three times through hubReference. C1/C2 source/local marks retained; C3's final configured evidence remains unverified, without asserting failure of its separate positive native commands (A-21297). Coordinator0c3f4a47 directs a wording-only correction and new review/window; its explicit disposition preserves native C3 receipts for unchanged code. No product-design reopening or native repeat requested. Hold released for that bounded correction. Full audit: A-21298, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21298-t-1672-failed-configured-evidence-and-retained-native-c3-receipts-at-aa082b696.md.

Criteria: C3 failed (Final configured evidence incomplete: 45031eb0 failed the expanded README assertion in T1; T2/T3/T4/Web unexecuted. Separate aa082b696 native 21/1/18 passing receipts are retained, not claimed failed or promoted to a green suite.).

### impl-1672 · 2026-11-18T14:43:15.013Z

45031eb0/A-21295 is retained FAILED/PARTIAL at aa082b696: local T0 exit0; Linux droplet T1 exit1,1865 pass/1 fail; T2/T3/T4/Web unexecuted. Literal assertion 'hub/README.md must describe shipped features' arises from docs/hub/ssh-host.md's 'plan stays pending' matching the shipped-feature grep; Coordinator0c3f4a47 attributed and directed this own-item wording correction, Reviewer A-21298 released the evidence hold. New pushed6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c (tree080fbb041102e2ed2d5ae8e80a903a081877f544) changes ONLY docs/hub/ssh-host.md,6+/6-: reservation/atomic-rename phrasing, unresolved committing record retained across restart without replay, native no-replace follow-up T-1974. No code/test/lint exception change. Local README9/9 passed on fixed tree, full typecheck at new head0; full lint/direct readers pending. A-21297 current-code native21/1/18 at aa082b696 remains separate valid C3 evidence by explicit Coordinator decision; no native repeat. No configured retry submitted; will request fresh wording review then new window.

### rev-35 · 2026-11-18T14:48:22.074Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1672-source-6
commit: 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Wording delta source clear; Standards and Spec have no findings. Exact parent aa082b696→6c71cb66 changes only docs/hub/ssh-host.md, 6+/6-, with no merge or code/test/helper/config change. The exact Plan/stays/pending matcher trigger is removed; unknown-move owner fence, unresolved committing checkpoint across restart, non-replay, identity and positive-migration guarantees remain. Native no-replace work names T-1974. A-21299 records corrected precommit README9/9, committed-head direct readers55/55, full typecheck/full lint exit0 and zero refusals. C1/C2 source verification renewed; C3 final configured evidence pending. A-21297 native21/1/18 remains explicitly aa082b696 and carries for unchanged code by Coordinator0c3f4a47, without a repeat request. Failed45031eb0 remains failed/partial. New-head verification needs a new Coordinator window. Full review: A-21300, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21300-t-1672-readme-wording-delta-source-clearance-at-6c71cb66d.md.

Criteria: C1 verified, C2 verified.

### rev-35 · 2026-11-18T15:20:15.802Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1672-evidence-2
commit: 6c71cb66db7b5bd984ee6224ec6cf8a29eeb855c
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards and Spec have no findings. A-21304 audits owner fca6eb2c/A-21303 finished/passed at reviewed6c71cb66, all718 selected ordinary file envelopes and6877 ordinary test finishes, all40 OpenCode Host cases, all26 new OpenCode identities plus mapped recording-Host move with base+5/5 load and file receipts, and the corrected README assertion. C1/C2/C3 verified. T0/allT1/allT2 including Neovim/selected3T3/selected1T4baseonly/Web complete; remainingT3/T4 unexecuted. Recording-Host warnings trace to counted shared-guard refusal controls; report-only diagnostics remain separate. C3 also uses explicitly carried A-21297 macOS native21/1/18 at code-identical aa082b696 under Coordinator0c3f4a47, not relabelled as current-head executions. Verification snapshot b1d15955 differs from Git tree080fbb04. Prior45031eb0 remains failed/partial. Full named-receipt audit: A-21304, /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21304-t-1672-final-same-head-evidence-clearance-at-6c71cb66d.md.

Criteria: C1 verified, C2 verified, C3 verified.
