---
id: T-543
kind: task
title: PID-reuse guard accepts a recycled PID that started within the same ps second
state: closed
status: done
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
updated: 2026-10-25T22:41:21.815Z
closed: 2026-10-25T22:41:21.815Z
---

## Summary
Found aside by impl-525 on T-525 (2026-10-15 22:29Z). `hub/src/hub/lock.ts:37-40` reads `ps -o lstart`, which has whole-second resolution, and `sameProcess` in `hub/src/adapters/processes.ts:27-32` accepts equal start stamps. If a managed PID exits and the OS recycles it to an unrelated process within the same second, the stop and cleanup guard accepts the replacement as the managed process and can SIGTERM or SIGKILL it. That's unlikely under ordinary PID allocation, more likely under heavy PID churn such as a loaded test suite. The consequence is termination of an unrelated process.

## Acceptance criteria
- [x] C1. The identity check uses a start identity finer than one second where the platform offers one (for example `/proc/<pid>/stat` starttime on Linux, `proc_pidinfo` or `sysctl` kinfo on macOS), or adds a second discriminator (command, ppid or a nonce) so that two processes started in the same second never compare equal.
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final · 2026-10-25T12:57:18.787Z · commit 2b4ac175d4b2df4f45ea11de40a81ec9dc66301b
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final2 · 2026-10-25T15:44:29.753Z · commit 0405a629685a8279304c85271907cb51ff47c64e
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final3 · 2026-10-25T16:04:52.366Z · commit 8fbcf297cde11d084d4efd1da4ff462405f3a121
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-source10 · 2026-10-25T18:14:04.626Z · commit c8274f8c0407b05d85eeaf4008382298a6d8de97
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final4 · 2026-10-25T18:36:26.881Z · commit 38d824672ab89f07d1e95c0f36b67ddbbce7d314
  - done: impl-543 · 2026-10-25T19:30:07.671Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final5 · 2026-10-25T19:46:36.411Z · commit 990a407e2214851248cad7b00ad23b776b0632a6
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final6 · 2026-10-25T20:13:15.153Z · commit c169e657d488acf52167263acd544e1a44b60d41
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final7 · 2026-10-25T21:34:19.713Z · commit f6bd8ca7e1c9cac2d371948a4af0914db4af21c4
- [x] C2. A test stages a same-second reused PID with a different identity and shows stop and cleanup refuse to signal it, while the real managed process is still signalled.
  - done: impl-543 · 2026-10-25T21:16:19.147Z
  - verified: rev-34 [reviewer] · run rev-34-20261025-543-final7 · 2026-10-25T21:34:19.713Z · commit f6bd8ca7e1c9cac2d371948a4af0914db4af21c4

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

### rev-34 · 2026-10-25T11:37:50.167Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source3
commit: f0752ac746c2b1a9e1ca080b792d9feb6ec05b4e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear at f0752ac7. H1/M1–M4 resolved. External PendingStop.files now rolls back with failed persistence, including optional absence; the regression keeps child/root/legacy receipt and no signal across repeated failed writes, then observes committed precise proof through a separate DB reader before successful signal/cleanup/receipt settlement. H1 coherent ownership, equal-PID relaunch, frozen help and canonical headings remain fixed. Coordinator af199dc0 one-time legacy upgrade policy/residual window unchanged. Withdrawn c423b37f TS2412 was disclosed and corrected; A-11824 reports checked replacement-source typecheck and 33/33 targeted cases, supplementary local macOS 27.0.1 arm64 evidence only. Standards: no findings. Spec: no findings. C1/C2 runtime requirements await successful configured verify at this exact head. No Reviewer execution; Linux/x86_64 not yet claimed. Coordinator owns pre-merge all run.

### rev-34 · 2026-10-25T11:58:12.885Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-evidence1
commit: f0752ac746c2b1a9e1ca080b792d9feb6ec05b4e
scope: evidence
findings: [{"severity":"medium","text":"E1: Configured run a311c2d5 ended with exit143 during Web; no successful final Web completion receipt. Completed native tests passed, but this partial result cannot establish a final clear verification."}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear: A-11862 actual output `Finished: exit 143`, then suite interruption at2026-10-25T11:56:11Z; Web topics/withdraw cases remained in flight. Cause of termination is not established. Audit A-11865 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11865-t-543-interrupted-verification-evidence-at-f0752ac7.md) preserves completed phase/case facts: hostT0 and LinuxT1/allT2/changedT3/mappedT4 passed, including33/33 system-processes and all same-second/ownership/checkpoint cases. These are partial receipts, not a full-suite pass. No source or criterion assertion failure inferred; C1/C2 remain unverified pending completed configured evidence. Source3 unchanged; any changed head needs fresh source review.

### impl-543 · 2026-10-25T12:34:25.957Z

Coordinator-directed local diagnosis found redundant fixture probes, now fixed in 784b8e2a (pushed). A-11909 records red controls, baseline/head/corrected operation counts, safety boundaries and targeted receipts. Simulated Linux browser registration ps4→2 (baseline2), empty teardown ps6→0 plus targeted pgrep1; actual empty projectHub identity spawns0. No production identity changes, no browser/droplet launched. Local darwin arm64 Node24.21: cleanup35/35, resume5/5, system33/33, typecheck exit0. A-11862 remains excluded incomplete configured evidence. C1/C2 done; runtime verification pending fresh source review and new mode-free verify. The one-time legacy upgrade policy and its documented residual window remain unchanged.

### rev-34 · 2026-10-25T12:36:36.892Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source4
commit: 784b8e2ac7d93840860f6647542cd9738e8f7fd0
scope: full
findings: [{"severity":"medium","text":"M5: new cache-consumption counter never cleans up; expiry test checks registration only, and existing same-second signal case does not consume an external same-turn capture. Coordinator28dc67fe explicitly requires stale reused-capture signal refusal. Add combined cached-registration→same-PID birth replacement→cleanup control with unchanged identity positively signalled.","file":"hub/test/process-cleanup.test.ts","line":111}]
finding_counts: {"high":0,"medium":1,"low":0}

Full source not clear, M5 only; audit A-11911 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11911-t-543-probe-cost-source-review-cache-signal-control-missing.md), carrying source3 safety/legacy audit. Production identity and destructive fresh reads unchanged; registration cache expiry and empty-group shortcut look sound in source. Missing proof is specifically the newly reused capture's path to destructive revalidation, as required by Coordinator28dc67fe. Preserve counter/expiry and existing same-second assertions; add explicit cache consumption plus replaced-birth refusal and unchanged positive signal control. A-11909 operation counts/local receipts do not establish Linux timing or cure prior incomplete Web run. Fresh pushed-head source review before configured verify.

Criteria: C2 failed (New same-turn capture cache lacks Coordinator-required regression proving a consumed stale capture cannot authorize a signal.).

### impl-543 · 2026-10-25T12:37:56.392Z

M5 addressed at pushed8534c87f: generated Linux/Darwin combined cached-capture→cleanup regressions prove registration consumes stale birthA, cleanup never signals replacementB and still kills unchanged control. Disposable native-revalidation mutation fails both with unexpected SIGKILL -420543; no production change. Full local cleanup37/37 and npm run typecheck exit0 (darwin arm64 Node24.21). Fresh source review requested before configured verify. Evidence artifact A-11914; A-11909 retains parent probe-count diagnosis; A-11862 remains excluded incomplete evidence.

### rev-34 · 2026-10-25T12:38:45.962Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source5
commit: 8534c87f6972cf6557423968f61b6d540e7334d6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear, M5 resolved; A-11919 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11919-t-543-m5-correction-source-review-at-8534c87f.md), carrying source3/full safety and source4/probe-cost audits. Both Linux/Darwin controls explicitly consume capturedA after same-PID/same-lstart birthB appears, assert strict cache reference identity, then demand zero replacement signal and exact unchanged-control SIGKILL. Final signal/survivor assertions retained; matching guidance updated, no production change. A-11914 mutation outcome correctly treated as asserted negative control, local37/37/static receipts not configured/Linux proof. Existing bracketing, unknown-birth/root retention, M4 and approved persisted legacy upgrade unchanged. C1/C2 remain unverified pending successful same-head configured receipt; Coordinator all check separate.

### rev-34 · 2026-10-25T12:39:48.664Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-evidence2
commit: 8534c87f6972cf6557423968f61b6d540e7334d6
scope: evidence
findings: [{"severity":"medium","text":"M6: enforcing child-environment lint rejects new spawn and execFileSync interception wrappers at216–217; satisfy the existing guard narrowly without weakening it, losing positive controls or changing sealed launch environments.","file":"hub/test/session-resume-component.test.ts","line":216}]
finding_counts: {"high":0,"medium":1,"low":0}

Evidence not clear: f2eebbf3/A-11920 exact output reports spawn requires sealed fixture builder at216 and execFileSync requires one at217, both permitting documented intentional seams. Host check exit1/9.451s after typecheck/build, no droplet or runtime/load/browser execution. Source5 missed this static guard obligation. A-11921 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11921-t-543-host-guard-failure-at-8534c87f.md) records exact output and limits. Preserve assertions/positive controls/shared environments, correct narrowly and request fresh source review at pushed head before verify. C1 remains unverified; prior interrupted Web run separately incomplete.

Criteria: C2 failed (Configured verification failed host T0 at new fixture interposition wrappers; no runtime evidence executed.).

### impl-543 · 2026-10-25T12:41:02.589Z

M6 corrected in pushed2b4ac175: exactly two intentional child-process instrumentation comments, retaining original sealed caller options and before-launch identity interception. Local darwin arm64 Node24.21: touched session file5/5, owning lint, full test:lint and typecheck all exit0. test lint135 findings REPORT ONLY, zero refusals. Evidence A-11924. A-11920/f2eebbf3 failed hostT0 before droplet, no runtime tiers; remains excluded incomplete proof. Fresh source review requested before another mode-free verify.

### rev-34 · 2026-10-25T12:42:15.093Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source6
commit: 2b4ac175d4b2df4f45ea11de40a81ec9dc66301b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; M6 resolved by exactly two reasoned intentional-seam annotations, no behavior/guard/assertion change. A-11927 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11927-t-543-m6-correction-source-review-at-2b4ac175.md) carries source5/full C1/C2 safety scope. Interceptors still reject identity probes before launch and preserve original sealed caller options; positive controls/restoration intact. A-11924 local owning lint/full test:lint/typecheck green and5/5 counter-file receipts retain platform limits. Prior host-only and interrupted runs remain failed/incomplete; C1/C2 unverified pending successful same-head configured receipt. Coordinator premerge all separate; item QA none.

### impl-543 · 2026-10-25T12:56:39.461Z

Completed configured run4b32a51f/A-11937 at unchanged source6 head2b4ac175: exit0,3234passes,0fail/cancel/skip. HostT0 plus LinuxT1/allT2 fallback/changedT3(70 identities)/mappedT4(1base)/Web(44files225tests) completed. RemainingT3 deferred; T4 repetitions skipped. Droplet c-8lon1 Linuxx64 Node24.21, ChromeHeadlessShell156.0.8078.4; lifetime722s cost$0.0502. Web suite wall150.62s, duration gates report-only. Required native/legacy/held/checkpoint/cache-to-signal cases independently checked in timing records; all pass. New cases all<3s. A-11939 summarizes exact cases and limits; earlier incomplete A-11862/A-11920 stay excluded. Requesting final evidence review before fresh fetch/conflictcheck and Coordinator-ready report.

### rev-34 · 2026-10-25T12:57:18.787Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final
commit: 2b4ac175d4b2df4f45ea11de40a81ec9dc66301b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear:4b32a51f/A-11937; audit A-11943 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-11943-t-543-final-configured-evidence-at-2b4ac175.md), carrying source6/full safety review. Parsed3234ordinary+60load passing finish identities. Precise birth/persistence, same-second stop/cleanup refusal with positive signals, coherent ancestry, M4 durable checkpoint, M5 cache-to-signal and M6 host guard controls pass.3identity+8ownership+1emptyhub identities each5/5load; changedT3system33/cleanup37 once pass. HostT0/LinuxT1/allT2/changedT3/mappedT4once/Web complete; otherT3/T4/extraT4repetitions absent. Native Linux versus simulated Darwin limits explicit; accepted persisted legacy-upgrade/preupgrade-window policy retained. Report-only warnings unchanged, no new>=3s case allowance. Prior failed/incomplete runs remain excluded. C1/C2 verified; Coordinator premerge all check separate; QA none.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T15:09:41.044Z

Premerge regression diagnosis: local original stop fails with valid persisted Claude pid_identity; signal-refused identifies already-absent descendant retained from authoritative ps, not missing launch proof. Deterministic initial capture test red false!=true; late/grace capture red 'descendant native identity cannot be verified'. Narrow fix skips acquiring an unknown descendant only after pidAlive proves absence; live unknown still refuses, native signal checks unchanged. systemProcesses row/reply shape and outcome classes unchanged. Consumers audited: all3 adapters.stop, Sessions legacy upgrade, LaunchFiles rollback, local executor cancel/release/crash cleanup, orphan/fixture sweeps, suite-command watchdog, tests suite-timeouts/fixture-orphans/session-resume/scenario-hook-bridge plus system-processes. Search of production callers/QA/docs/skills done; prior contract inventory remains. Direct stop/resume source search in hub/test+nvim/test finds 78 files (excluding unrelated hub.stop). Running requested three full files individually, then all searched consumer files individually; generated list will be captured in correction evidence. Existing ready head2b4ac175 remains unmerged; working correction requires fresh review/verify.

### impl-543 · 2026-10-25T15:28:46.584Z

0405a629 correction complete locally. A-12007 diagnosis/red controls: saved Claude identity valid; dead transient descendant in stale ps snapshot blocked stop. Only ESRCH for an unverified leaf can settle it; live unknown/error/surviving listed branch still refuses. Five new deterministic guards; system-processes38/38pass. A-12011: all83 searched/alias/direct cleanup consumer files723/723 pass individually+serially (includes original3), zero skips/cancel; isolated cli-identity6/6 retry pass, earlier SQLite5 recorded local busy-lock flake per Coordinator. darwin arm64 Node24.21; no Linux/browser claim. Typecheck and full test:lint exit0 (135 report-only findings,0refusals). C1/C2done restored; requesting fresh source review before new mode-free verify.

### rev-34 · 2026-10-25T15:30:15.691Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source7
commit: 0405a629685a8279304c85271907cb51ff47c64e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; A-12013 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12013-t-543-absent-leaf-correction-source-review-at-0405a629.md), carrying prior full safety audit. Both acquisition/grace paths skip only unverified leaf with no listed child and positive nativeESRCH; no ownership/signal authority gained. Live unknown/mismatch, listed surviving branch, EPERM/EIO remain refusals. Coherent bracketing, per-PID signal checks, M4/M5 and legacy policy unchanged. Five new deterministic guards retain stable-child termination/no-gone-child-signal and refusal assertions; matching docs updated. A-12006/12011 consumer audit/local83files723passes plus38system cases retain darwin/local/targeted limits, not configured/Linux proof. Parent all-run genuine failures preserved, old green receipts stale for newhead. C1/C2 remain unverified pending same-head configured evidence; Coordinator premerge all rerun separate.

### rev-34 · 2026-10-25T15:44:29.753Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final2
commit: 0405a629685a8279304c85271907cb51ff47c64e
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final configured evidence clear:1990574b/A-12016; audit A-12017 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12017-t-543-absent-leaf-corrected-final-evidence-at-0405a629.md), carrying source7/full safety review. Parsed3239ordinary+60load passes. Five new absent-leaf/grace/liveunknown/survivingbranch/EIO controls pass with retained signal/completion assertions; whole38system/37cleanup pass, including prior same-second/cache/ancestry/checkpoint controls.3identity+8ownership+1emptyhub each5/5load. HostT0/LinuxT1/allT2/changedT3/mappedT4once/Web complete; otherT3/T4 and extraT4 repetitions absent. New cases<3s; report-only warnings/native-vs-synthetic limits retained. Original3 lifecycle consumers have corrected local receipts but were not in this Linux task selection; Coordinator premerge all must re-establish them. Parent all failure stays failed. C1/C2 verified, no findings; QA none.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T15:48:36.030Z

Coordinator-authorized dev8d4d5650 merge pushed8fbcf297. Two SESSION_USAGE conflicts resolved preserving incoming state-reason line and native-birth stop line; owning frozen row regenerated, all other command rows unchanged. Current merged-tree seven requested files69/69local passes plus typecheck exit0 (darwin arm64 Node24.21). A-12019 records exact files/durations and prior-head Linux receipt1990574b/A-12016 separately. Clean tree, no remaining conflicts. C1/C2done restored; fresh source review requested before new mode-free verify. Coordinator premerge all rerun remains pending at this merged head.

### rev-34 · 2026-10-25T15:49:38.607Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source8
commit: 8fbcf297cde11d084d4efd1da4ff462405f3a121
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Delta source clear after Coordinator51bc6f1b authorized merge; A-12021 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12021-t-543-authorized-merge-source-review-at-8fbcf297.md), carrying source7/full safety conclusions. Only manual SESSION_USAGE source/frozen resolution retains incoming state-reason wording plus native-birth stop requirement; exact owning equality/all-other-row preservation verified. Auto-merged adapter contract/Claude/Codex/Sessions delivery changes coexist with retained precise stop/resume metadata and rollback; native process/LaunchFiles/cleanup byte-unchanged from source7. A-12019 local69cases/static receipts retain platform/selection limits; parent receipts stale for newhead. C1/C2 unverified pending same-head configured evidence; Coordinator premerge all at mergehead separate; QA none.

### rev-34 · 2026-10-25T16:04:52.366Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final3
commit: 8fbcf297cde11d084d4efd1da4ff462405f3a121
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final merged-head configured evidence clear:c7cf6fc5/A-12024; audit A-12025 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-12025-t-543-merged-head-final-evidence-at-8fbcf297.md), carrying source8/full safety audit. Parsed3304ordinary+60load passes.3identity+8ownership+1emptyhub each5/5load;38system/37cleanup pass, including all5absent-leaf/error/branch guards, same-second/cache/ancestry/checkpoint controls. Merged help4/17/compat1 and incoming Codex/Claude component regressions pass. HostT0/LinuxT1/allT2/changedT3/mappedT4once/Web complete; otherT3/T4 and extraT4repetitions absent. Prepared host gate not repeated remotely; report-only diagnostics/native-vs-synthetic limits retained. Original3 lifecycleT3 consumers remain for Coordinator premerge all; local merged receipts do not replace Linux proof. C1/C2 verified, no findings; QA none.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T16:05:42.741Z

Merged-head final3 clear/A-12025 at8fbcf297: C1/C2verified. Mode-free c7cf6fc5/A-12024 completed3304ordinary+Reviewer-audited60load passes; hostT0/LinuxT1/allT2/changedT3(75)/mappedT4onebase/Web completed. Newcase max0.171s Linux, no allowance needed. Fresh fetch devd7268c09 +merge-tree exit0/no conflicts, projectedtree90cf5393. Head unchanged/clean. A-12026 preserves exact evidence/exclusions. Ready report to Coordinator for required premerge all rerun, including original3 unselected lifecycle files.

### impl-543 · 2026-10-25T17:43:20.182Z

Linux-only all rerun ae61ff94/A-12067 now fails3 Claude lifecycle cases. Actual resume setup: native process identity unavailable for pid33743; fixture preserved (killDaemon before synthetic PID replacement), plus two generic stop refusals. Existing T1 already has comm with spaces and ')'; adding a literal field-number fixture and explicit Linux step diagnostics rather than assuming parser failure. Planned additive optional native-failure callback preserves existing Map and nullable identity return shapes. Consumers searched: process-identity sync fixture cleanup, async system-processes, all3 adapter lifecycle via Sessions/LaunchFiles/processes, local executor, suite-command; QA/docs/skills and every tier previously inventoried. systemProcesses optional error fact if needed remains additive/old-row compatible; all callers migrating to include diagnostic only in refusal text, no new signal authority. New real Linux regression will live in claude-code-sessions-lifecycle.test.ts so mode-free verify selects whole file. No dev merge or verifier retry before fresh source review.

### impl-543 · 2026-10-25T17:53:54.810Z

Pushed diagnostic candidate d642f902; A-12076 records exact A-12067 failures and uncertainty. Literal Linux stat comm-with-spaces/')' field22 control passes unchanged parser, so no parser fix claimed. Added labelled boot-id/stat errno/validation callbacks and refusal errors; no signal policy relaxation. Added OS-boundary EACCES/ENOENT control and Linux-only real native/captured/durable birth+stop regression in Claude lifecycle file, selecting all its cases in ordinary verify. Local Mac: lifecycle7pass1Linuxskip; processidentity5/system38/cleanup37/docguards3 pass; typecheck+lint exit0 (135report-only,0refusal). Linux root cause still pending new-head diagnostic receipt. Fresh source review requested before mode-free run; no ready/final request.

### rev-34 · 2026-10-25T17:55:23.878Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source9
commit: d642f90265039293f7ee5e37a52e74d0fdfd059e
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Diagnostic source clear; Standards/Spec no findings within Coordinator-authorized diagnostic request. Audit A-12077 carries prior source8 safety review and all d642f902 changes. Optional failure callbacks/internal identityError preserve old calls/rows; callbacks cannot grant proof, Claude logging is fenced by #closed, native ownership bracketing and fresh per-signal checks/refusal controls are unchanged. Sealed OS-boundary EACCES/ENOENT test and Linux-only current/captured/durable birth+stop test retain bounded receipts, final absence assertion and fixture ownership. Full lifecycle file is changed for Linux task verification. Parent A-12067's three genuine Linux lifecycle failures remain unresolved; local Darwin 7 pass/1 Linux skip is not Linux evidence. C1/C2 remain unverified at this head (no marks). Source clearance authorizes one diagnostic mode-free run, not ready/final or a root-cause-fix claim; check original failures/new native case and its measured duration, then return exact-head evidence before Coordinator integrated rerun.

### impl-543 · 2026-10-25T18:13:12.058Z

Coordinator-approved allowance-only c8274f8c pushed: one duration entry5.2s, E-1284, added2026-10-25/expires2026-11-01; manifest lint valid. A-12086 separates unchanged-source parent proof478465af/A-12083 (3314ordinary+70load, full Linuxlifecycle8/8) from unrun allowance head. Earlier integrated failures remain unexplained/load-dependent per Coordinator; new rule6all decides. Requesting one-entry delta review and ready per e61965a9/66e9cd8b; no new ordinary run submitted at allowance head.

### rev-34 · 2026-10-25T18:14:04.626Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source10
commit: c8274f8c0407b05d85eeaf4008382298a6d8de97
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Approved one-entry delta and bounded parent-evidence settlement clear; Standards/Spec no findings. Audit A-12087: decoded durations manifest is identical to parent after removing the sole expected 5.2s entry; exact case, open E-1284 owner, 2026-10-25/2026-11-01 dates, reason and478465af/A-12083 provenance match Coordinator66e9cd8b/e61965a9. No executable/test/assertion/deadline/selection changes. C1/C2 verified from source9+A-12085 parent audit:3314ordinary+70load, full lifecycle8/8 including original3 failures, same-second refusal/managed-positive and native/cache/ancestry/checkpoint controls pass. No run occurred at c8274f8c: this is explicit Coordinator-authorized allowance-only parent-proof reuse, not a same-head green/cache hit or integrated pass. Earlier integrated failures remain unexplained. Coordinator explicitly directed delta→ready and owns deciding rule6 all at this head before merge.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T18:15:32.650Z

Source10/A-12087 allowance delta clear atc8274f8c; C1/C2verified with Coordinator-approved parent478465af proof, no current-head runtime/cache claim. Fresh fetch dev16596bda +merge-tree found one conflict in doctor/report.ts: sixth run argument is task encoding vs incoming AbortSignal. No merge or head change. A-12088 contains complete approved stanza, durationcheck and proposed compatible resolution. Reporting preflight blocker/decision to Coordinator before any merge; keep head/claim.

### impl-543 · 2026-10-25T18:17:07.194Z

Coordinator8bc8178b authorizes dev merge to resolve run helper API collision. Consumer inventory before signature edit: production imports doctor/report in hub lock/system-processes/process-identity/process-paths/fixture-processes/orphans/suite-lock; doctor keys/toolchain/project/CLI; Git-maintenance and owner; setup account identity. Tests doctor-run/doctor-cli/doctor-harness-probe typed seams, doctor-fixture probeTools; all-tier source search finds sole sixth-slot latin1 caller in process-identity.ts. Keep every incoming sixth AbortSignal caller, move encoding seventh and migrate sole task caller; Map/native identity APIs and public wire unchanged. Existing cancellation/close controls plus binary/native identity, system-processes, all maintenance, doctor/probe and changed lifecycle files will run serially.

### impl-543 · 2026-10-25T18:21:56.431Z

Authorized dev16596bda merge pushed38d82467. run keeps sixth AbortSignal, seventh defaultutf8 encoding; sole async native latin1 caller migrated. New combined binary/cancel/close guard5/5probe tests; UTF8 mutation reproduces corruptedbytes. A-12093 records consumer inventory, all14requestedfiles130pass/1Linuxskip (131total), typecheck/build/full lint exit0 (135report-only,0refusal), clean mergedtree. Fresh source review before mode-free verify; prior integrated failures still unexplained, no new-head Linux claim.

### rev-34 · 2026-10-25T18:23:15.032Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source11
commit: 38d824672ab89f07d1e95c0f36b67ddbbce7d314
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge source clear; Standards/Spec no findings. A-12094 reviews both parents and Coordinator8bc8178b. report.run preserves dev sixth AbortSignal/cancellation/owned-group/native-close boundary, seventh encoding defaultsUTF8; sole async native caller migrated false,undefined,latin1. Consumer inventory and previous five/sixth-slot call shapes retained. New fake-clock binary00/80/ff+abort+held-close regression retains group signal, pending and final receipt assertions; canonical guide updated. Identity/refusal/ancestry/checkpoint/cache code and tests unchanged from prior task head,5.2s allowance preserved, SESSION frozen row matches. Local14files130pass/1Linuxskip are supplementary Darwin receipts; parent diagnostic green not current-head proof. C1/C2 runtime-unverified/no marks. Proceed with one fresh mode-free verify at38d82467, exact-head final review, then Coordinator deciding integrated all. Earlier Linux integrated failures remain unexplained.

### rev-34 · 2026-10-25T18:36:26.881Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final4
commit: 38d824672ab89f07d1e95c0f36b67ddbbce7d314
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head configured evidence clear; Standards/Spec no findings. A-12098 audits2d9b5bac/A-12096 separately from exitstatus:3339ordinary+75load allpass. Binary/seventh-slot+abort/sixth-slot+held-close regression ordinary+5/5load (max0.008704032s); full probe5/5. Claude lifecycle8/8 includes original3 failures and real Linux native/captured/durable proof+stop2.976821157s under approved5.2s allowance. Identity5+5/5load, eightownership+5/5load, emptyWebspawn+5/5load, system38/cleanup37 including same-second refusal/positive, ancestry/cache/checkpoint/absentleaf controls pass. HostT0; LinuxT1/allT2/changedT3once/mappedT4once/Web complete; otherT3/T4/extraT4reps/stageQA absent, native Git-maintenance remains for Coordinator all. Prepared host gate not repeated remote, report-only budgets and synthetic/native limits retained. C1/C2verified at38d82467. Earlier integrated failures unexplained; Coordinator's deciding rule6all at landable head still required before merge.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T18:37:29.494Z

Current merged head38d82467 source11/final4clear, C1/C2verified. 2d9b5bac/A-12096 exact-head Linux task run3339ordinary+75load passes, lifecycle8/8 incl prior3 failures; binary/cancel/close ordinary+5/5load. New native case2.976821157s within5.2s allowance. A-12099 preserves complete stanza, exclusions and fresh fetch dev2bb29ff8 +merge-tree exit0/no conflict (tree28c316dc). Clean unchanged head. Ready for Coordinator deciding rule6all; earlier all failures remain unexplained/load-dependent, no root-cause/integrated-pass claim.

### impl-543 · 2026-10-25T19:30:08.136Z

Pushed990a407e fixes reproduced leaf-only short circuit: after LinuxstatENOENT/ESRCH, every listed branch PID must return nativekill0ESRCH before settlement. Both fully-dead branch cases were redfalse!=true, now green; present/survivor/EPERM/EIO controls refuse. A-12118 records actualA-12114failure, ten deterministicLinuxcases in changed lifecycle file, shared existing OS-probe extraction preserving38assertions, and tracker refusal receipt while keeping crash/hold/claim checks. Current Mac111passes/1Linuxskip across6files; typecheck/lintgreen. Tracker#3 exactcauseunproven fromoldlog; full changed file nowselectedforLinux. Fresh source review before newmode-free; no devmerge or ordinary retryyet.

### rev-34 · 2026-10-25T19:31:38.627Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source12
commit: 990a407e2214851248cad7b00ad23b776b0632a6
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; Standards/Spec no findings. Full branch-settlement audit A-12120 carries prior safety review. Both acquisition/grace paths settle an unverified branch only after every transitively listed PID returns native kill0ESRCH; present/surviving/EPERM/EIO/unknown results refuse with first-PID diagnostic. Native stat errors alone grant no exit or signal authority; before/ps/after binding and fresh per-signal checks unchanged. Ten deterministic Linux after-snapshot controls retain dead-branch no-signal and managed positive signal assertions. Shared OS fixture extraction preserves all38 existing system test bodies, sealed launch/cleanup. Tracker crash assertion now exposes stop refusal and retains native death/restart/claim/status/hold assertions. Docs replace leaf-only wording. Parent A-12114 errors are real; tracker exact cause still unproven. Local111pass/1Linuxskip supplementary only. C1/C2runtime-unverified/no marks. One fresh mode-free verify, exact-head evidence/new-case timings, then Coordinator deciding integrated all required.

### rev-34 · 2026-10-25T19:46:36.412Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final5
commit: 990a407e2214851248cad7b00ad23b776b0632a6
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final same-head evidence clear; Standards/Spec no findings. A-12129 audits7c51e40d/A-12128:3364ordinary+75load allpass,15identities each5/5load. All10new Linux stat-after-snapshot controls pass0.1405–0.1779s with absent-branch positive and present/survivor/EPERM/EIO no-signal assertions. Full lifecycle18/18, tracker15/15 (crash/restart/claims/status/holds9.018s), system38/cleanup37, finer-than-second/old-row, ancestry/cache/checkpoint and managed-positive controls pass. Nativeproof3.318s<approved5.2; existing tracker9.018<retained14.629 allowance, no new allowance needed. HostT0/LinuxT1/allT2/changedT3once/mappedT4once/Web complete; otherT3/T4/extraT4reps/stageQA absent. Prepared host tree not rerun remote; report-only budgets and native-vs-synthetic limits retained. C1/C2verified. Prior integrated A-12114 remains failed; unchanged crew scenario absent and tracker prior exact cause unproven. Coordinator deciding integrated all at990a407e still required before merge.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T19:56:56.622Z

Authorized dev merge committed/pushed at c169e657d488acf52167263acd544e1a44b60d41 (dev 48bcab2955). A-12136 records conflict resolutions and sequential local macOS receipts: seven requested files plus three help/fixture files, 159 passed/one Linux-only skip, typecheck and diff-check green. Capacity retry cancellation, admitted-name settlement and native identity safety retained. C1/C2 implementation done; fresh source review then mode-free Linux verification required. Prior all failures and tracker exact-cause uncertainty remain explicit.

### rev-34 · 2026-10-25T19:58:30.297Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source13
commit: c169e657d488acf52167263acd544e1a44b60d41
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized merge source clear; Standards/Spec no findings. A-12137 audits both parents and Coordinator7e4782dd/de4a02f7. Stop clears capacity retry before persisted legacy upgrade, then renews authorization before handoff/adapter stop; replay readback authorization cannot revive removed retry. All admitted-name reservation success/rollback paths and current-session-id publication retained. Native capture/relaunch/checkpoint/refusal/branch/cancellation code and tests unchanged from task parent; incoming Codex22delivery/33native and four rename outcome controls retained. SESSION exact-frozen match, only owning row changed and all parent help preserved. Targeted local159pass/1Linuxskip supplementary only; parent final5 historical, parent allc01a0cfc cancelledT0/countsunavailable. C1/C2runtime-unverified/no marks. One fresh mode-free verify atc169e657, exact-head final review, then Coordinator deciding integrated all before merge.

### rev-34 · 2026-10-25T20:13:15.153Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final6
commit: c169e657d488acf52167263acd544e1a44b60d41
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; Standards/Spec no findings. A-12146 audits a1020c43/A-12145:3387ordinary+75load allpass;15identities each5/5load. Lifecycle18/tracker15/system38/cleanup37, tenstat controls, native identity/oldrow/same-second refused replacement+managed positive/ancestry/cache/checkpoint controls pass. Merge Codexdelivery22/native33, all4admitted-name rename outcomes, stop-capacity cancellation/heldreadback busy controls pass. Probe5+5load, docs3/help4/commandhelp17/frozen1 pass. Native3.345<5.2 allowance; tracker8.850<existing14.629, newstatmax0.158s/no new allowance. HostT0/LinuxT1/allT2/changedT3once/mappedT4once/Web complete; otherT3/T4/extraT4reps/stageQA absent. Host preparedtree not repeated remotely, report-only diagnostics/synthetic limits retained. C1/C2verified atc169e657. Earlier red/cancelled all receipts remain distinct; crew unselected/tracker old exact cause unproven. Coordinator deciding integrated all at landable head remains before merge.

Criteria: C1 verified, C2 verified.

### impl-543 · 2026-10-25T20:49:16.877Z

Zombie follow-up consumer inventory before production changes (rule20): direct native birth consumers are process-identity.ts itself; production adapters/processes.ts, adapters/claude-code.ts, adapters/sessions.ts, adapters/launch-files.ts, system-processes.ts, executor/local.ts and suite-command.ts; synchronous fixture consumer hub/test/process-cleanup.ts; direct tests process-identity.test.ts and claude-code-sessions-lifecycle.test.ts. Row-membership consumers additionally fixture-processes.ts, orphans.ts, and their fixture/run callers; parseProcessTable consumers system-processes.ts/process-cleanup.ts plus system-processes.test.ts. processAlive is consumed by all three native adapters (Claude/Codex/OpenCode); session-resume-lifecycle, fixture-orphans-lifecycle, suite-timeouts and hook-bridge tests use derived boundaries. Shipped docs/skills/QA/startup searches found no additional direct native-reader caller or persisted wire reader: previous nullable/string APIs and persisted pidIdentity shape will stay unchanged. Add an optional native-exit callback, keep live unreadable/mismatch as unknown/refusal, and omit only after-probe-confirmed dead rows just as ps already omits Z. Migrate snapshot and processAlive consumers; launch/capture clients remain unaffected (dead birth still null, never signal proof). All tiers share the unchanged cleanup helper, so its file-wide safety cases plus suite-check, suite-recovery and codex-adapter native reaping paths will be run. Actual red: deterministic Linux cleanup case reproduces 'captured: known; current: after ownership snapshot: Linux stat state: zombie' with no PID reuse. Darwin SDK sys/proc.h defines p_stat at byte36 and SZOMB=5; cover this native equivalent too.

### impl-543 · 2026-10-25T21:03:19.991Z

Native exit correction committed/pushed at c921d76c8e43dcf1b8e1f4e05f56c73859eef701, tree1d816115962b1fcb245685e47c3733e5b38d05ea. Exact A-12158 zombie cleanup error reproduced red and fixed; separate frozen-exit→CONT regression also red/green. Linux Z/X and Darwin SZOMB are explicit no-signal exit receipts, separate from unknown proof and parent reaping; previous API/persisted shapes retained. Consumer inventory preceded production edits. Canonical docs/help/skill updated. Local single-file receipts221pass/one Linux-native skip; typecheck/static lint green (135 report-only findings,0refusals). New deterministic controls<0.1s locally. Fresh source review then one mode-free Linux run required; no integrated-pass claim.

### rev-34 · 2026-10-25T21:06:20.570Z

verdict: review
result: not clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source14
commit: c921d76c8e43dcf1b8e1f4e05f56c73859eef701
scope: full
findings: [{"severity":"medium","text":"M7: final-native-exited rows are filtered before descendant accounting. If ps has managed L→C→G, C becomes Z/X after ps and G survives, C is omitted but returned G still names C as parent. endProcess cannot reach G and can report successful stop while G remains live. An exited leader similarly reaches the leader-missing early return. Retain/reconcile ancestry or refuse unaccounted surviving branches; add non-leaf exited-parent controls and audit the same fixture filter at process-cleanup.ts:58.","file":"hub/src/system-processes.ts","line":88}]
finding_counts: {"high":0,"medium":1,"low":0}

Not clear; audit A-12162 (precise filter location is system-processes.ts:88). Standards0/Spec1medium M7. Source-proven after-ps exit/surviving-grandchild interleaving bypasses prior surviving-branch fence; no Reviewer reproduction claimed. Requested sealed control from lead. Native exit of a parent is not its descendants' exit receipt. Keep exited-leaf, invalid/wrongPID, earlierdead/laterlive, frozen-recovery, same-second/cache/ancestry/checkpoint positive/refusal controls and actual native reaping/root assertions. Nullable APIs/docs/callback handling otherwise appropriate. C2failed; C1runtime-unverified. Correct/review at fresh pushed head before verification; parent allA-12158 stays red.

Criteria: C2 failed (M7: native-exited-parent filtering can hide a still-live listed descendant and allow false successful termination; new exited-state positives cover leaves only.).

### impl-543 · 2026-10-25T21:08:46.853Z

M7 reproduced before correction: six sealed stop cases (Linux Z/X + Darwin SZOMB, exiting child and exiting leader) all failed true!==false with a listed surviving/reparented grandchild. Six matching fixture cases also failed 'Missing expected rejection', showing root cleanup could settle without observing the writer branch. Planned shared membership correction: a linear-time retainProcessAncestry helper in process-table.ts, consumed only by system-processes.ts and test/process-cleanup.ts, retains a native-exited row whenever any listed descendant lacks an exit receipt. It retains the previous unknown-birth row shape and an explicit surviving-branch diagnostic, authorizing no signals; leaves/fully exited branches are still omitted. Existing downstream native snapshot consumers remain conservative on unknown birth (inventory above); no new wire/schema/record field. Source14 not-clear remains pending fresh corrected-head review.

### impl-543 · 2026-10-25T21:16:19.320Z

M7 corrected and pushed at f6bd8ca7e1c9cac2d371948a4af0914db4af21c4 (tree8201ffe0f830382d253151b946f1e84f7eb08341). Shared linear retainProcessAncestry preserves exited ancestors while any listed descendant lacks exit proof; rows remain unknown/refused, with no signal authority. Twelve matrix cases red→green, and an old-filter mutation makes all twelve fail. Actual fixture-root/writer preservation and positive retry/managed-leader controls retained. Local final subset121pass/one Linux-only skip, typecheck/static guards green (135report-only findings,0refusals). Docs/skill condition updated; no schema/wire/permission change or new allowance. Fresh review and then one mode-free verify required; source14 remains historical not clear.

### rev-34 · 2026-10-25T21:18:20.124Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-source15
commit: f6bd8ca7e1c9cac2d371948a4af0914db4af21c4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected native-exit source clear; M7 resolved, Standards/Spec no remaining findings. A-12164 audits correction plus source14 native-exit change. Shared linear retainProcessAncestry retains all rows without final exit proof and their ancestors; retained native-exited rows have null birth/explicit surviving-branch diagnostic, so stop/cleanup refuse without signals.12LinuxZ/X/DarwinSZOMB child/leader controls preserve stop refusal and actual root/writer before simulated reaping, then completion/managed-positive; old-filter mutation reproduces all12 failures. Leaf-zombie/wrongPID/invalid/live-reuse/frozenCONT/oldAPI and real ESRCH controls retained. Docs/skill/CHANGES/help/frozen migration checked. Local121pass/1Linuxskip supplementary; no current-head configured evidence. C1/C2runtime-unverified/no marks. One mode-free Linux run, fresh exact-head evidence, then Coordinator deciding all including original suite-check/reaping paths; no integrated-pass inference from selected controls.

### rev-34 · 2026-10-25T21:34:19.713Z

verdict: review
result: clear
by: rev-34 [reviewer]
run: rev-34-20261025-543-final7
commit: f6bd8ca7e1c9cac2d371948a4af0914db4af21c4
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final exact-head evidence clear; Standards/Spec no findings. A-12169 audits9ed79302/A-12168:3409ordinary+80load allpass;16identities each5/5load. M7six stop and six actual-root preservation matrices pass (max0.518s/0.187s); leafZ/X/SZOMB, unreadable/live replacement, wrongPID, invalid/oldAPI, frozenCONT and finalsignal noauthority controls pass. System50/cleanup46/identity6+30load/name75+40load retain native same-second refusal/managedpositive/ancestry/checkpoint/cache. Lifecycle18/tracker15, delivery22/native33/resume9/probe/help/docs pass. Nativeproof3.761<5.2 and tracker9.130<14.629 allowances, no new entry. HostT0/LinuxT1/allT2/changedT3once/mappedT4once/Web complete; otherT3/T4/extraT4reps/stageQA absent. Native suite-check/recovery/codex-adapter have no recorded cases here: actual Linux reaping remains Coordinator deciding all. Hostpreparedtree not repeated remote, report-only diagnostics and synthetic/native limits retained. C1/C2verified. ParentA-12158 remains failed; integrated all at landable head still required before merge.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-25T22:41:21.815Z

Merged 358e9217f877ab4d6f089a7ab8f2d10ae72acfd1 onto dev.
