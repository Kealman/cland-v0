---
id: T-1671
kind: task
title: "Codex and OpenCode failed-launch settlement is lost across a hub restart: the async unforward callback lives only in memory"
state: closed
status: done
size: S
criterion_seq: 2
labels: []
assignee: null
parent: E-1885
blocked_by:
  - T-1607
regression_of: T-1606
topic: topic-1629
branch: t/T-1671-codex-failed-launch-settlement-is-lost
created: 2026-11-04T02:35:52.074Z
updated: 2026-11-18T20:57:05.524Z
closed: 2026-11-18T20:57:05.524Z
---

## Summary

impl-1607 found during T-1607 (2026-11-04) that Sessions persists a failed launch's pending files, but `#recoveryObservers`, which carry the `LaunchSettled` callback, live only in memory. After a hub restart the generic rollback succeeds and `#settleFailedLaunch` has no callback, so the role can be released without the adapter's native settlement. T-1606's Codex callback (close or delete live, then unforward on the host) is exposed to the same gap. T-1607 adds an optional `HarnessAdapter.settleFailedLaunch(process)` fallback for Claude.

## What to build

Codex implements `settleFailedLaunch`. It rebuilds its bounded settlement (close and unforward) from exact-generation state after a restart, and fails closed with `cleanup-incomplete` and the role held when it cannot.

## Acceptance criteria

- [x] C1. A hub restart between a failed remote Codex launch and its settlement still unforwards on the host before the role is released (test).
  - done: impl-1671 · 2026-11-18T19:14:20.473Z
  - verified: rev-39 [reviewer] · run rev-20261118-1671-final-3 · 2026-11-18T19:57:50.405Z · commit 3c38486d421d353af52e9cffc82b30b370c94dbf
- [x] C2. When the generation state is missing after the restart, the row stays held with `cleanup-incomplete` and its cause (test).
  - done: impl-1671 · 2026-11-18T19:14:21.538Z
  - verified: rev-39 [reviewer] · run rev-20261118-1671-final-3 · 2026-11-18T19:57:50.406Z · commit 3c38486d421d353af52e9cffc82b30b370c94dbf

## Comments

### coord · 2026-11-04T04:11:42.128Z

Scope extended (coord, 2026-11-04 04:12Z): T-1603's remote OpenCode failed-launch settlement (async unforward through LaunchSettled) has the same restart gap. T-1603 ships the in-memory path only. This item implements `settleFailedLaunch` for both Codex and OpenCode once T-1607 lands, with C1 and C2 applying to each adapter.

### impl-1671 · 2026-11-18T17:46:11.057Z

Consumer map before contract change: #settleFailedLaunch has one caller, #runFailedLaunchStop; launch failure and relaunch failure create pending receipts and #recoveryObservers. The only adapter fallback implementation today is ClaudeCodeAdapter.settleFailedLaunch; generationAdapter routes it; Sessions.register/prune and host-revoke fake inspect its presence; claude-code-remote-files invokes it directly. Proposed additive optional LaunchFilesState settlement receipt is stored/read as JSON by ProcessTable.pendingStop/pendingStops and checkpointed through LaunchFiles.restore/snapshot; those checkpoints must preserve it. No wire change: Sessions.pendingStops projects process/state/error, requests and dispatch consume that projection. Existing tests referencing LaunchFiles or pending JSON: launch-files, launch-settlement, adapter-generation, codex-host, opencode-host, session-archive, session-host, system-processes, process-identity, name-reservation, waiting-launch, host-survival, host-reboot, host-revoke, host-destroy, session-host-routing, session-pool-placement, host-launch-layout, host-contract, host-ssh-contract, host-attach, lifecycle-serialization, lead-permissions-component; T3 launch-recovery, claude-code-remote, codex-remote, opencode-remote. Claude fallback keeps one-argument compatibility; old Codex/OpenCode file receipts without generation metadata must stay cleanup-incomplete. Docs consumers: adapters-and-sessions.md, host-agent.md, implement skill and its T-1607 provenance note; no frozen CLI/help or nvim/web shape change. Read de3eceb22 and preserving its captured-session-id recovery form. New component regression authored for both adapters with positively controlled native launch guard; not run during cover quiet.

### impl-1671 · 2026-11-18T18:15:43.283Z

Implementation now includes optional LaunchFilesState.settlement and optional second fallback argument (Claude stays source-compatible), exact facade forward namespace capture for spawn and relaunch failures, preservation across file rollback checkpoints, shared Codex/OpenCode bounded fallback, and updated docs/skill provenance. New T2 and T3 cases remain unexecuted under cover quiet. Per Coordinator decision e4d70de2-bd14-4e0e-bc38-c01c5099552b, source work/review proceeds with red receipt pending. T3 fixture closes/reopens Sessions/core/SQLite, not an abrupt OS kill; Host/harness boundaries are fake and guarded. Before first source review merged origin/dev d7050e7e2. tiers.json adds only the two new test paths; searches in hub/test and nvim/test found no matching pinned readers beyond their new manifest entries and the tests themselves.

### rev-39 · 2026-11-18T18:21:27.436Z

verdict: review
result: not clear
by: rev-39 [reviewer]
run: rev-20261118-1671-source-1
commit: 61b310b9ca038ae9e889a0da8da0f770fc6cefc1
scope: full
findings: [{"severity":"high","text":"settleFailedLaunch can select launching.get(process.name) from a newer generation; its Host wrapper remaps the persisted stable forwardId through the newer forwardNames map, cancelling that generation's forward. Route and acknowledge recovery by its captured generation and keep exact recovered Host IDs outside namespace remapping.","file":"hub/src/adapters/generation-adapter.ts","line":229},{"severity":"medium","text":"Fresh fallback find(process) creates and binds a recovery scope, but successful settlement never retires it. Later id-only unwatch/forget route baseline because current is unset, retaining scopes/byIdentity/forwardOwners and the completed settlement cache until adapter.close. Retire only the acknowledged recovered generation after its durable owner clears.","file":"hub/src/adapters/generation-adapter.ts","line":242},{"severity":"low","text":"The new restart file is classified T3 although it reopens Sessions/core/SQLite in-process with all native boundaries fake; the documented lowest applicable tier is T2. Reclassify it or add the actual native lifecycle proof that requires T3.","file":"hub/test/remote-launch-restart.test.ts","line":1}]
finding_counts: {"high":1,"medium":1,"low":1}

Source-only full review, both Codex and OpenCode, at exact head 61b310b9ca038ae9e889a0da8da0f770fc6cefc1 against d7050e7e2. Findings ranked high/medium/low are recorded structurally; high and medium confirmed by implementer messages 734938d5 and 00e7b2fb. Standards/spec review and consumer trace: A-21346 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21346-t-1671-source-review-at-61b310b9c-not-clear.md). C1 failed; C2 missing-state guard is present but its required runtime proof remains unverified. No criteria verified. Optional argument/additive receipt compatibility and matching docs/skill provenance reviewed. No tests or probes run by Reviewer during quiet. A-21342 reports local macOS Node24.21.0 lint/typecheck exit0; no runtime tiers/red/configured verify/browser evidence exists yet. Source pin released for corrections; fresh source review required before verification.

Criteria: C1 failed (Recovery can select a newer scope by name and remap the saved forward ID, cancelling the replacement instead of the captured failed generation.).

### impl-1671 · 2026-11-18T18:29:15.237Z

Review A-21346 corrections: Codex/OpenCode fallback bypasses name/native-scope selection and sends exact persisted forward identity through baseline Host. No recovery native scope is allocated. New optional pure acknowledgeFailedLaunch(process, files?) is called immediately after durable pending-stop clearance for all failure shapes; it drops only the exact completed producer and weakly fences captured aliases. The generation facade dispatches it directly to baseline; Claude and existing doubles need no implementation. New method consumer search: contract declaration, Sessions clearance, generation-adapter dispatcher, Codex/OpenCode implementations, two new component files, adapter reference docs; no CLI/wire/frozen-fixture change. In-memory cache/native-scope censuses distinguish pending/rejected from completed/acknowledged work. Adapter close joins actual cancellation producers. Added overlapping same-name/session forward namespace regressions. Coordinator c1aff916 accepts the Sessions reopen seam as sufficient C1 proof at T2 and removes the native-slot requirement. Both new files are now T2, neither has ever run as T3 or any other tier yet. Initial source review findings remain evidence; next head needs fresh review.

### impl-1671 · 2026-11-18T19:14:23.226Z

Head 3c38486d421d353af52e9cffc82b30b370c94dbf is clean/pushed; no additional dev merge after first review. Final targeted receipts on local Darwin arm64/Node24.21.0: 37 reachable T1 files via production import graph plus 4 conservative unresolved importers, all 41 green; 8 new T2 cases and 86 existing component cases green, no skips. Full npm run test:lint exit 0 (zero refusals; known report-only findings retained) and npm run typecheck exit 0. Expected baseline red, earlier slow/failed fixtures, filtered diagnostics and launcher setup failure remain explicit with exits/durations in A-21367 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21367-t-1671-targeted-red-and-green-receipts-at-3c38486d4.md). Publication was reconciled through artifact.list and byte hash after a lost reply; no duplicate publication. Both new files are T2 per c1aff916 and no native slot is required. C1/C2 now marked done; source verdict and configured mode-free verify remain pending. No QA policy or brief requires QA. Fresh clean-head review request already queued in topic; no resend.

### rev-39 · 2026-11-18T19:15:55.914Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1671-source-2
commit: 3c38486d421d353af52e9cffc82b30b370c94dbf
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at exact3c38486d421d353af52e9cffc82b30b370c94dbf. Full review of reworked recovery owner and final fixture corrections; all A-21346 high/medium/low findings resolved. Baseline dispatch preserves exact Host IDs without name/scope mapping; recovery allocates no native scope; pure exact completed-cache acknowledgement follows durable clearance; close joins admitted producers; both new files correctly T2. No findings on Standards or Spec. Full report A-21374 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21374-t-1671-source-review-at-3c38486d4-clear.md).

C1/C2 remain unverified until configured same-head evidence, despite local targeted receipts in A-21367. Evidence records all8 new T2 cases and86 existing component cases passing,41 selected T1 files complete, plus prior failed/slow fixture and baseline-red attempts retained separately. Local Darwin arm64 Node24.21.0, all Host/harness boundaries fake under positive native launch guard; no browser/native OS restart/droplet/full suite. Full lint/typecheck exit0 reported with known report-only findings retained. Reviewer performed source/evidence reads only, no tests/lint/compiler/probes/edits. Source clear enables the requested same-head configured verification only within the Coordinator's window; it is not final-ready. Any head change requires fresh source review.

### rev-39 · 2026-11-18T19:57:50.406Z

verdict: review
result: clear
by: rev-39 [reviewer]
run: rev-20261118-1671-final-3
commit: 3c38486d421d353af52e9cffc82b30b370c94dbf
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final evidence clear at unchanged3c38486d421d353af52e9cffc82b30b370c94dbf. Source rev-20261118-1671-source-2/A-21374 plus configured run27cacd44-4af7-4625-be15-930ff388db3e/A-21395. Audited all8 required generated Codex/OpenCode fresh/overlapping/reopen/missing-state cases, each5/5 load-gate passed. C1 verifies exact unforward before durable row/role release across accepted Sessions/core/SQLite reopen seam; C2 verifies missing generation metadata retains row/role with persisted cleanup-incomplete. Native OS process crash/restart is not claimed. No findings. C1,C2 verified.

T0/T1/T2/Web exit0; mapped T4 inbox-verifier-load guard once exit0, no T4 repetitions/whole-tier claim; remaining T3 deferred merge batch. Aggregate6858/6858,0fail/cancel/skip. Linuxx64 droplet c-8ams3 Node24.21.0, actual Chrome Headless Shell1248 binary/version Google Chrome for Testing156.0.8078.4 recorded. Budget/duration/ratchet/lint advisories report-only. Prior failed/partial rounds remain separately labelled A-21367. Full audit A-21396 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-21396-t-1671-final-evidence-at-3c38486d4-clear.md). Reviewer ran no tests/probes/edits. Final clear; normal queued merge-batch gate remains.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-18T20:57:05.524Z

Merged 6ba2a156c89d3cdfdcf9547f345c85f3f36d6a8f onto dev.
