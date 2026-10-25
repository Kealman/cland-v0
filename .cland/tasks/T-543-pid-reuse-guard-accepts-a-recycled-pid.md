---
id: T-543
kind: task
title: PID-reuse guard accepts a recycled PID that started within the same ps second
state: open
status: in progress
size: M
criterion_seq: 2
labels:
  - bug
  - hub
  - needs-triage
assignee: null
parent: E-1284
blocked_by: []
topic: topic-1038
branch: t/T-543-pid-reuse-guard-accepts-a-recycled-pid
created: 2026-10-15T22:29:59.157Z
updated: 2026-10-25T11:27:50.284Z
---

## Summary
Found aside by impl-525 on T-525 (2026-10-15 22:29Z). `hub/src/hub/lock.ts:37-40` reads `ps -o lstart`, which has whole-second resolution, and `sameProcess` in `hub/src/adapters/processes.ts:27-32` accepts equal start stamps. If a managed PID exits and the OS recycles it to an unrelated process within the same second, the stop and cleanup guard accepts the replacement as the managed process and can SIGTERM or SIGKILL it. That's unlikely under ordinary PID allocation, more likely under heavy PID churn such as a loaded test suite. The consequence is termination of an unrelated process.

## Acceptance criteria
- [ ] C1. The identity check uses a start identity finer than one second where the platform offers one (for example `/proc/<pid>/stat` starttime on Linux, `proc_pidinfo` or `sysctl` kinfo on macOS), or adds a second discriminator (command, ppid or a nonce) so that two processes started in the same second never compare equal.
  - failed: rev-34 [reviewer] · 2026-10-25T11:27:50.284Z · note M4: recovery-child native proof can authorize retry signalling before the approved one-time upgrade is durably persisted.
- [x] C2. A test stages a same-second reused PID with a different identity and shows stop and cleanup refuse to signal it, while the real managed process is still signalled.
  - done: impl-543 · 2026-10-25T11:26:07.174Z

## Comments

### impl-543 · 2026-10-25T10:45:47.814Z

Consumer inventory (rule 20, before edits): native lstart APIs/lock ownership in hub/src/hub/lock.ts; persisted harness rows/pending stops in adapters/processes.ts, contract.ts, sessions.ts, launch-files.ts; capture/resume/stop in claude-code.ts, codex.ts, opencode.ts; process-table.ts/system-processes.ts and orphan/fixture-processes.ts; suite-lock, suite-worker, executor/local, droplet lease/watchdog and doctor/project lstart readers. Tests across tiers: process-started, system-processes, process-cleanup, pid-identity (T3), lifecycle-serialization, launch-recovery, adapter-native-boundary, session-resume-component, session-events, name-reservation, request-guard, sqlite-contention, claude-code-schedule; orphan/fixture-orphan/territory-lock/executor-lock and suite runner tests. Shipped implement skill, docs/agents/tests.md and hub README describe identity; QA T-386/E-579 and historical docs/evidence/T-698 mention pidStarted as opaque or whole-second identity. nvim/web/shared have no identity comparison consumers. Plan additive birth identity fields, preserving lstart fields and old wire decoding. Existing lstart-only managed rows remain visible/liveness-conservative but do not authorize destructive signals. Lock-only legacy ownership stays conservative. New native identity is Linux boot-id + proc start ticks, macOS kinfo_proc start timeval; unknown/malformed identity refuses signals. Test seams: pure native-format parsers (T1), existing synthetic system-process signal/cleanup boundary (T3), existing old-wire shape regression. No key/browser changes; QA policy none.

### impl-543 · 2026-10-25T10:59:53.425Z

Implementation migration inventory update: additive native process identity lives in process-identity.ts, leaving hub/lock.ts/processStarted and suite/doctor lock readers unchanged (non-signalling conservative liveness). Migrated every endProcess caller: adapters (Codex, OpenCode, Claude Code), LaunchFiles rollback, orphan/fixture sweeps, executor/local.ts and suite-command.ts. Old pidStarted and process-table started stay present; new pidIdentity/identity is optional when reading old records and mandatory for signals. Adapter/process table/pending-stop and local lease writers retain native proof. Fixture cleanup ProcessIdentity adds identity, with legacy/missing proof preserving live roots. Codex/OpenCode carry birth captured at child launch through handshake rather than re-acquiring it after publication. In-process name-reservation fixtures now explicitly inject native identity. Direct watchdog persisted-PID signals are separate from this shared helper; reported to lead as S Bugs for filing. Shipped implement skill/CHANGES, session help, hub README and file-specific agent test docs updated; role permissions/clause unchanged.

### rev-34 · 2026-10-25T11:05:32.566Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source1
commit: 2311a05fa61d442da1a268c535b51a4087859bc2
scope: full
findings: [{"severity":"high","text":"H1: ps ancestry is joined with a later native identity by PID. Recycling a child between reads attaches the replacement's birth to the old parent's ownership; later rechecks accept that contaminated birth and can signal the unrelated replacement. Fixture process-cleanup.ts:40-42 has the same gap. Use coherent/bracketed observations and a held acquisition-boundary regression.","file":"hub/src/system-processes.ts","line":55},{"severity":"medium","text":"M1: SESSION_USAGE changed without the owning frozen commands.json row. Existing export and root-help equality guards deterministically disagree; migrate only this intended block and retain guards/template.","file":"hub/src/cli/usage.ts","line":29},{"severity":"medium","text":"M2: all four new per-test notes use descriptive headings, violating test-docs.test.ts's exact repository test-path heading assertion. Fix process-identity, system-processes, process-cleanup and name-reservation headings without weakening the guard.","file":"docs/agents/tests/hub-test-process-identity.test.ts.md","line":1},{"severity":"medium","text":"M3: resume publication retains current.pidIdentity solely because numeric PID matches. On same-PID/different-birth relaunch this discards freshly captured proof and makes the legitimate new process un-stoppable. Publish fresh relaunch proof even when the PID is equal; retain old-proof refusal for ordinary reattachment.","file":"hub/src/adapters/sessions.ts","line":1405}]
finding_counts: {"high":1,"medium":3,"low":0}

# T-543 full source review — NOT CLEAR
Head 2311a05fa61d442da1a268c535b51a4087859bc2, tree 00175459d56289c416ae1e46da6c4e09d9232419.
Fixed base 2aab88ca189feca954b9394be3455c5e397b46b7; git diff 2aab88ca...2311a05f. Reviewed all 31 changed files and consumer inventory; both axes in-session because delegation is disabled. Read-only source inspection; no Reviewer test, build, browser, native probe or mutation. A-11770 local targeted results remain implementation-time Darwin evidence, not an exact-head configured suite.

## Standards
M1 medium — hub/src/cli/usage.ts:29. SESSION_USAGE adds the native birth requirement but hub/test/fixtures/cli-usage/commands.json:26 retains the old session-stop sentence. Existing cli-usage-compatibility.test.ts:9 deep-equals all exports with that fixture and cli-help.test.ts:31 assembles root help from the frozen bytes. Both cannot match at this head. Reproduce through existing guards, update only the intended SESSION_USAGE block and retain equality, template and composition.

M2 medium — docs/agents/tests/hub-test-process-identity.test.ts.md:1. All four newly added per-test notes use descriptive headings instead of exact '# <repository/path.test.ts>' headings: process-identity, system-processes, process-cleanup and name-reservation. hub/test/test-docs.test.ts:23-25 requires the exact test-file heading and matching filename. Correct all four line-1 headings; keep the guard.

## Spec
H1 high — hub/src/system-processes.ts:54-60 (also hub/test/process-cleanup.ts:40-42). Ancestry/group/command come from ps first, then native identities are read later and joined by PID without checking they describe the same incarnation. Concrete source interleaving: ps lists child C under managed parent P; C exits and its PID is reused by unrelated R in the same ps second; the birth probe returns R's new identity. The composite row still says parent=P, so endProcess:90-92 admits R's identity to owned. Subsequent signal rechecks compare against that already-contaminated identity (168-180), and a later tree snapshot with R reparented does not remove its owned entry: matching selects by birth, not ancestry. Escalation can therefore STOP/KILL R. The fixture process-table reader has the same mixed-snapshot construction. Retain ancestry and birth from one native observation, or bracket/revalidate ancestry against stable native identities before granting ownership; merely comparing lstart does not close the same-second hole. Add an isolated held-probe regression recycling a descendant between ps and birth reads, retaining the no-signal assertion and a positive managed-descendant control. This is a source-proven possible interleaving, not a claimed execution.

M3 medium — hub/src/adapters/sessions.ts:1405. publish chooses current.pidIdentity whenever current.pid === found.process.pid, even for an explicit relaunch that has spawned a new process and returned a fresh birth identity. If the OS reuses the stopped process's numeric PID for that new managed process, the code overwrites the fresh proof with the old birth (or null for a legacy row). Later stop then refuses the correctly launched process. Preserve old proof for same-incarnation reattachment, but publish the newly captured proof for a successful relaunch even at an equal PID. Cover same-PID/different-birth relaunch and keep ordinary resume/old-wire refusal coverage.

## Criteria and disposition
C1 fails H1 (native proof can be attached to stale ownership) and M3 (new managed incarnation loses its native proof). C2 fails the test/help documentation guard obligations M1/M2; the existing equal-lstart replacement/positive-control tests do not cover H1's acquisition boundary. No criteria runtime-verified.
Additive record fields and legacy refusal policy are otherwise appropriate. No automatic dependency or permission expansion. The separate direct watchdog issue is already filed as T-1298, not a duplicate task finding.
Hold verification. Fix these findings, preserve guards/assertions and request fresh source review at the pushed correction head before configured verification. Do not merge dev after this review unless the Coordinator asks or merge reports a conflict.

Standards: 2 medium findings (M1/M2). Spec: 1 high (H1), 1 medium (M3).

Criteria: C1 failed (H1/M3: mixed-snapshot ownership can authorize a recycled descendant, and same-PID relaunch discards the new birth proof.), C2 failed (M1/M2: changed help fixture and all four canonical test-document headings fail existing regression guards.).

### impl-543 · 2026-10-25T11:18:17.453Z

Review correction and policy update: Coordinator decision af199dc0 supersedes flat legacy refusal. On first lifecycle observation, a pidStarted-only row with a live coherent matching whole-second start and readable native birth upgrades once; persist proof before signals. Same-second PID reuse before this first observation retains the previous risk only in this one-time migration window. Precise rows never upgrade again; mismatch/unreadable still refuses. Implementing accepted rows, pending launch receipts/children and local worker leases. Public session views are unchanged: pidIdentity is an internal adapter/persisted record field, not a new public row field. H1 ownership now uses initial ps only for selectors, then native-before / authoritative-ps / native-after; only stable birth binds ancestry. Held native acquisition regression reproduced killing the replacement at reviewed head (actual failure: replacement survives the entire stop), then passed after bracketing; stable managed descendant remains a positive signal control. Same-PID relaunch regression reproduced retaining original-birth/null instead of new-birth; corrected separately from ordinary reattachment. Existing help/docs guards reproduced their stale fixture/heading failures, then green without changing assertions.

### rev-34 · 2026-10-25T11:27:50.284Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source2
commit: 64f494cfe703b5932d34436d3d13f3b9ab0f2f09
scope: full
findings: [{"severity":"medium","text":"M4: failed recovery-child upgrade checkpoint leaves entry.files containing unpersisted precise proof. LaunchFiles only reverts its internal birth; next retry tolerates a failed initial pendingStop write, restores the leaked proof and may signal without durable upgrade. Roll back external entry.files on save failure and test persistent failure across retry plus successful recovery.","file":"hub/src/adapters/sessions.ts","line":866}]
finding_counts: {"high":0,"medium":1,"low":0}

# T-543 corrected source review — NOT CLEAR
Head 64f494cfe703b5932d34436d3d13f3b9ab0f2f09; tree a0b425a0e22a7d074decdcc090d813291fce674c. Full scope because legacy ownership policy is reworked; reviewed original full audit plus all 21 correction files (git diff 2311a05f..64f494cf). No dev merge after first source review. No Reviewer test/build/native probe/browser execution.

Verified Coordinator decision af199dc0-4833-47e6-af9c-167a9bd92c28 directly in topic-1038 history. It authorizes a one-time upgrade of a legacy row with matching whole-second start and readable native birth, retaining the explicitly accepted pre-upgrade same-second reuse risk. Precise rows remain strict. The Perl fallback requirement was also confirmed in Coordinator message 43a162e9.

## Standards
H1/M1/M2/M3 from source1 are resolved. Production and fixture ownership now bracket authoritative ps facts with native birth reads; initial ps grants selectors only. Held acquisition regression retains the no-replacement-signal assertion and unchanged descendant positive control. Equal-PID relaunch publishes new proof; ordinary reattachment retains original proof. Only SESSION_USAGE is migrated in the frozen commands fixture; all five current per-test notes use exact test-path headings. Guards/template/assertions remain. Documentation and implement skill/CHANGES describe the approved one-time migration window and observed macOS ABI limits.

## Spec
M4 medium — hub/src/adapters/sessions.ts:865-867.
Restored legacy child upgrade in LaunchFiles.rollback temporarily replaces its internal birth and calls checkpoint(snapshot). The Sessions callback assigns entry.files = state before table.pendingStop(entry) succeeds. If that persistence throws, LaunchFiles restores only its internal birth; the external PendingStop.files still contains the uncommitted precise proof. On a retry, #stopFailedLaunch:853 catches another failed pendingStop write as preparationError and deliberately continues. LaunchFiles.restore(entry.files) now sees a precise child, skips its upgrade/checkpoint block, and can signal it even though no durable upgraded receipt exists.
This violates the accepted requirement to persist the legacy upgrade before a destructive action and A-11799's claim that failed checkpoints cannot leak in-memory authority. Preserve/restore entry.files if its checkpoint fails (or atomically publish the pending state only after successful persistence), and cover persistent write failure across retry: no signal/root removal while the upgrade is unsaved, then a positive upgrade/termination receipt once writes recover. Keep the original child's identity check and recovery assertion.

No other remaining finding from the correction. Legacy accepted-row and local-worker upgrade paths were source-inspected; both keep their proof unknown on failed checkpoint. The recovery-children callback is the exception.

C1 fails M4 under the approved legacy migration contract. C2's new same-second/positive-control test source is present but remains runtime-unverified. A-11799's 153 local targeted cases are supplementary Darwin arm64 evidence, not a configured head pass; Linux, x86_64, T4/Web and load evidence remain unexecuted at this review. The forced missing/failed Perl source cases safely produce unknown proof, and local ABI evidence is limited to macOS 27.0.1 (26A434), arm64.

Standards: 0 remaining findings. Spec: 1 medium M4. Hold verification; correct the recovery receipt checkpoint, preserve assertions and request fresh pushed-head source review before one configured run.

Criteria: C1 failed (M4: recovery-child native proof can authorize retry signalling before the approved one-time upgrade is durably persisted.).
