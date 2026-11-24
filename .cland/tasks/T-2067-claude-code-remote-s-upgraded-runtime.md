---
id: T-2067
kind: task
title: claude-code-remote's upgraded-runtime case lets a fire-and-forget `cland hook mod-turn-start` child outlive the file; the shared SSH/fake-Claude fixtures lack a close receipt separate from directory disposal
state: closed
status: done
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: topic-1746
branch: t/T-2067-claude-code-remote-s-upgraded-runtime
created: 2026-11-24T00:46:47.955Z
updated: 2026-11-24T19:02:42.165Z
closed: 2026-11-24T19:02:42.165Z
---

## Summary

Split from T-2066 (2026-11-24). macOS epic cover 42213931 (A-22710) failed `hub/test/claude-code-remote.test.ts › T-1730 C2 upgraded runtime launches Claude with connected mod bridge` with `SSH fixture cleanup incomplete`. A `cland hook mod-turn-start` process, reparented to PID 1, outlived the file. `mod-turn-start` is deliberately fire-and-forget, and this case waits only for `session.measure` to finish, not for the hook to close; other cases use `joinInitialHookWriters`. impl-2066 reproduced it deterministically with a filesystem-gated hook (PID 11734 live at the census). The reviewer then found that a correct fix needs whole-case ownership. That means the shared SSH and fake-Claude fixtures need a resource-close receipt separate from directory disposal, registered before native acquisition and retryable on a failed close, with disposal only after the outer required-close fence. The fixtures have about 50 direct test consumers, plus helper and transitive ones (two nvim files, and the crew-launch and hook-bridge scenarios).

## What to build

An opt-in lifecycle adapter in the shared fixtures, with default behaviour unchanged, plus an adapter-level rejection and repair control. Then use it in the upgraded case with the hook join. Run every consumer file natively.

## Acceptance criteria

- [x] C1. The upgraded case joins its hook writers under a whole-case owner whose required-close fence covers every SSH and fake-Claude resource, and a deterministic held-hook control is red before and green after (test).
  - done: impl-2067 · 2026-11-24T13:33:41.886Z
  - verified: rev-35 [reviewer] · run rev-35-2067-evidence-2 · 2026-11-24T15:28:57.609Z · commit 52ddd9bf4e6a2f172ede53bae61c302429cf0f51
- [x] C2. Every existing consumer of the shared fixtures passes unchanged (evidence).
  - done: impl-2067 · 2026-11-24T15:26:47.565Z
  - verified: rev-35 [reviewer] · run rev-35-2067-evidence-2 · 2026-11-24T15:28:57.609Z · commit 52ddd9bf4e6a2f172ede53bae61c302429cf0f51

## Comments

### coord · 2026-11-24T00:47:18.619Z

Consumer inventory from impl-2066 (2026-11-24): SSH fixture importers, fakeClaude callers, the merge-support and stage-qa helpers, the crew-launch and hook-bridge scenarios, nvim layers and sessions-lifecycle, QA briefs, and the per-file guides. T-2066 changed none of the shared fixtures.

### impl-2067 · 2026-11-24T13:00:06.432Z

Consumer search (fixture names, imports, native hooks, docs and briefs): 54 hub/nvim files match sshHostFixture or fakeClaude calls, including definitions and helpers. Existing consumers retain the default API; only upgraded-runtime and rejection/repair controls in claude-code-remote opt into lifecycle. Includes stage-qa-support, scenarios/crew-launch, scenarios/hook-bridge, nvim layers and sessions-lifecycle; QA E-1532 stage 3/6 and E-677, and per-file guides reviewed. No wire/schema/production changes. Broad importer coverage deferred to mode-free droplet verify by Coordinator decision 130d4fae; local native scope limited to claude-code-remote. Deterministic held-hook red: completed turn joins its fire-and-forget hook; false !== true, focused macOS Node v24.21.0 run exit 1.

### impl-2067 · 2026-11-24T13:01:37.519Z

Full direct consumer inventory staged in T-2067-evidence.md for scanned artifact publication. No existing callsite outside claude-code-remote opts in. Coordinator directs broad unchanged consumer proof to droplet verification after source review; C2 remains pending that receipt.

### impl-2067 · 2026-11-24T13:04:51.550Z

Consumer inventory for optional lifecycle adapter (default callers unchanged; no production wire/schema changes):
docs/agents/tests/hub-test-adapter-generation-forward.test.ts.md
docs/agents/tests/hub-test-claude-code-schedule.test.ts.md
docs/agents/tests/hub-test-host-clone-integration.test.ts.md
docs/agents/tests/hub-test-host-push-on-ref-move.test.ts.md
docs/agents/tests/hub-test-host-relaunch-retry.test.ts.md
docs/agents/tests/hub-test-host-relaunch.test.ts.md
docs/agents/tests/hub-test-host-runtime-join.test.ts.md
docs/agents/tests/hub-test-remote-discovery-host.test.ts.md
docs/evidence/T-1676-native-consumers.json
docs/hub/coordinator-session-procedure.md
hub/test/account-fixture-env.ts
hub/test/adapter-generation-forward.test.ts
hub/test/aide.test.ts
hub/test/approval-restart.test.ts
hub/test/claude-code-adapter.test.ts
hub/test/claude-code-remote.test.ts
hub/test/claude-code-sessions-lifecycle.test.ts
hub/test/cli-identity.test.ts
hub/test/codex-remote-agent.test.ts
hub/test/default-subscriptions-lifecycle.test.ts
hub/test/fake-claude-cleanup.test.ts
hub/test/handover-process.test.ts
hub/test/harness.ts
hub/test/host-agent-restart.test.ts
hub/test/host-agent.test.ts
hub/test/host-clone-integration.test.ts
hub/test/host-prepared.test.ts
hub/test/host-push-on-ref-move.test.ts
hub/test/host-reboot-native.test.ts
hub/test/host-relaunch-native.test.ts
hub/test/host-relaunch-retry.test.ts
hub/test/host-relaunch.test.ts
hub/test/host-revoke-native.test.ts
hub/test/host-runtime-join.test.ts
hub/test/host-ssh-contract.test.ts
hub/test/host-survival-native.test.ts
hub/test/inbox-requests.test.ts
hub/test/init-process.test.ts
hub/test/lead-handover-process.test.ts
hub/test/lead-permissions-process.test.ts
hub/test/lead-routing-process.test.ts
hub/test/opencode-remote.test.ts
hub/test/orphan-servers.test.ts
hub/test/pid-identity.test.ts
hub/test/remote-discovery-host.test.ts
hub/test/roles.test.ts
hub/test/rule-sessions.test.ts
hub/test/scenarios/crew-launch.test.ts
hub/test/scenarios/hook-bridge.test.ts
hub/test/session-events.test.ts
hub/test/session-holds.test.ts
hub/test/session-launch-lifecycle.test.ts
hub/test/session-native-lifecycle.test.ts
hub/test/session-resume-lifecycle.test.ts
hub/test/session-stop-races.test.ts
hub/test/ssh-host-fixture.ts
hub/test/stage-qa-support.ts
hub/test/subscription-frame.test.ts
hub/test/suite-runner.test.ts
hub/test/task-worktrees-lifecycle.test.ts
hub/test/tracker-ready-native.test.ts
hub/test/visibility.test.ts
nvim/test/layers.test.ts
nvim/test/sessions-lifecycle.test.ts
qa/briefs/E-1532-stage-3.md
qa/briefs/E-1532-stage-6.md
qa/briefs/E-677.md
Only claude-code-remote upgraded case and two rejection/repair controls opt in. Transitive importer graph, including stage-qa-support and crew-launch/hook-bridge scenarios, is left to normal droplet selection.

### rev-35 · 2026-11-24T13:12:46.804Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2067-source-1
commit: 3eb95b02e40edd75c119984468f2e738b9cbecd7
scope: full
findings: [{"severity":"medium","text":"M1: Upgraded and repair-control acquisitions use run/step without separate bounded setup observations or whole-callback observation; node:test backstops do not supply those bounds. Keep original work owned while adding named waits.","file":"hub/test/claude-code-remote.test.ts","line":177},{"severity":"medium","text":"M2: Required-close rejection occurs before directory disposers, so root stat/restore refusal do not independently exercise the actual registered removal guard. Add rejected-close removal-attempt/refusal, repair and positive disposal/restoration receipts; narrow the current stronger guide claim.","file":"hub/test/claude-code-remote.test.ts","line":210},{"severity":"medium","text":"M3: Store closer registers after construction without raw-handle capture, and partial projectHub startup cleanup remains ancillary to the opted-in outer owner. Capture before constructor/acquisition and require positive partial-resource closure before root/owner release, with rejection controls.","file":"hub/test/claude-code-remote.test.ts","line":107}]
finding_counts: {"high":0,"medium":3,"low":0}

A-22957: Standards3medium/Spec0additional. Lead74305e72 confirms all three gaps without exclusions. Retryable shared-fixture close and deterministic held-hook/join are correct seams; retain those final assertions. C1 failed; broad unchanged-consumer C2 remains pending, not failed. A-22953 normal local48/48 does not establish these rejection boundaries; no configured receipt. Source/experiment hold releases for consolidated corrections and fresh committed source review. No reviewer tests/probes/edits; no dev merge, broad local consumer campaign or full task-head suite requested.

Criteria: C1 failed (Opted-in lifecycle lacks separate setup bounds, independent rejected-close removal-guard proof and complete required-close ownership for partial hub/Store acquisition.).

### rev-35 · 2026-11-24T13:26:00.452Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2067-source-2
commit: 730a61b9ce989def1819d4eac4c0def21d9f257d
scope: full
findings: [{"severity":"medium","text":"M1 remains for five close/removal controls: standalone within observes each proof IIFE after scope.run setup joined, without owning/joining its finally, retry, checks and restore on timeout/abort. Later scope.wait entries do not reopen stageCase's joined boundary. Add an outer supervisor owning the whole inner setup/proof, release the rejection hold on cancellation and prove the original continuation joins before cleanup/restoration.","file":"hub/test/claude-code-remote.test.ts","line":222}]
finding_counts: {"high":0,"medium":1,"low":0}

A-22969: Standards1medium/Spec0additional. Lead 2d88155c confirms remaining M1 whole-proof ownership gap, no control/exclusion. Source1 M2 actual-remover guard proof and M3 pre-constructor/partial-hub required ownership are resolved; upgraded callback/setup bounds and held-hook assertions retained. A-22965 separates local full-file and final three-case receipts; no configured/broad consumer proof. C1 failed; C2 stays pending. Hold releases for narrow supervisor correction/fresh committed review; no reviewer tests/probes/edits, dev merge or broad local consumer campaign requested.

Criteria: C1 failed (Five repair/partial-acquisition proof continuations remain outside a whole-callback owner after inner setup joins; timeout/abort can outlive their observation bound.).

### rev-35 · 2026-11-24T13:36:12.482Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2067-source-3
commit: 96ce296318859e386bcba59593d663c29ab38371
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-22980: Standards0/Spec0 within Coordinator097dd51e C1/C2 bar stated to lead. Remaining M1 resolved: outer supervisor retains full five setup/proof/repair callbacks, exclusively receives abort, releases holds and joins original producers before automatic inner cleanup/restoration; timeout/abort controls assert resumed-continuation retention then positive close/restoration. M2/M3 and final held-hook exit assertions unchanged. timeoutMs:1 accepted as explicit FakeClock observation advanced only after setup; no real fixed wait or enforcement switch. A-22971 reports final-source local53/53 and typecheck/lint0, not broad configured evidence. C1 done/unverified, C2 unchecked/pending authorized same-head consumer receipt. Source hold releases; no reviewer tests/probes/edits, dev merge or additional local native campaign requested.

### impl-2067 · 2026-11-24T14:01:04.820Z

Configured run 5eff8e17 at 96ce29631 red only on shared T-2088 (A-22997); Coordinator attributed and authorized canonical d28203f1a. Clean cherry-pick 52ddd9bf4, exact failing case 1/1 green locally, evidence A-22999. T0/T1 passed; T2 failed; T3/Web unexecuted; C2 remains pending. New lint/typecheck explicitly waived by Coordinator 8b971c13 using A-22992 and prior own A-22971. Fresh delta review before authorized new verify.

### rev-35 · 2026-11-24T14:06:30.444Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-2067-evidence-1
commit: 96ce296318859e386bcba59593d663c29ab38371
scope: evidence
findings: [{"severity":"medium","text":"The constructor/rejected-close control expects the cleanup error as primary, but the retained producer reports the constructor error; run 5eff8e17 exits 1. Coordinator attributes this sole failed test identity to shared T-2088.","file":"hub/test/suite-human-component.test.ts","line":131}]
finding_counts: {"high":0,"medium":1,"low":0}

A-23003 records the exact old-head failed receipt and separate partial aggregates. T0/T1 exit 0, T2 exit 1; T3/Web/T4 unexecuted. C1 remains unverified. The canonical-only delta at 52ddd9bf4 is under separate source review; this verdict does not discard or supersede the failed producer receipt.

Criteria: C2 failed (A-22997 exits 1 on the shared T-2088 constructor/close assertion; T3/Web consumer execution did not occur.).

### rev-35 · 2026-11-24T14:07:35.185Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2067-delta-1
commit: 52ddd9bf4e6a2f172ede53bae61c302429cf0f51
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Canonical-only source delta clear; A-23004. Full diff exactly matches d28203f1a5951f44a17e1c14cd1b3391526ed57c and changes only the shared constructor/close control. Original primary identity and secondary cleanup proof now match pinned database/cleanup-failure behavior; root-removal refusal, repair and guard assertions remain. Coordinator 8b971c13 authorizes check reuse. No runtime criterion newly verified: C1 runtime and broad C2 remain pending. A-23003 retains the old shared T-2088 failed receipt; new-head verification must use the Coordinator's next authorized window.

### rev-35 · 2026-11-24T15:28:57.609Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-2067-evidence-2
commit: 52ddd9bf4e6a2f172ede53bae61c302429cf0f51
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-23039: final same-head evidence clear. A-23037/5c25cdb3 code0, complete exit0 receipts T0/T1/T2/239 selected T3/Web. All53 remote cases pass including actual held-hook exit and eight ownership/census controls; all50 direct consumer test files pass with375 generated passes and one explicitly unexecuted optional installed-OpenCode prerequisite case. Additional stage-qa helper consumer12/12; both nvim and crew-launch/hook-bridge positive. Existing default consumer callsites unchanged. C1/C2 verified. Remaining34 T3 stay with integrated merge batch; T4 not run, budgets report-only, cache metadata unknown. Known three F2 finish-only records excluded from paired proof. Old5eff8e17/A-22997 remains red/T-2088 at96ce29631; canonical delta source clear A-23006 is preserved.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-24T19:02:42.165Z

Merged 5bcb33850d46f33b2a1822296262b733e11aa818 onto dev.
