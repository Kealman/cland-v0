---
id: T-511
kind: task
title: Cancelled local verify leaves the suite lock held when a fake child recreates the suite root; admission refuses cleanup forever
state: open
status: review
size: M
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-1194
blocked_by: []
topic: topic-971
branch: t/T-511-cancelled-local-verify-leaves-the-suite
created: 2026-10-15T15:58:21.157Z
updated: 2026-10-24T12:25:47.459Z
---

## Summary

Cancelling a local verify can wedge local admission for good. On 2026-10-15 at 15:09:59Z, `cland verify cancel` of cff20897 killed the runner (pid 48812, group 53758). Fake harness processes then recreated the suite root `/tmp/cland-suite-<token>-1`, so its inode no longer matched the holder's recorded inode. From then on, every admission attempt ran recovery, hit `suite root identity changed; refusing cleanup` (hub/src/suite-lock.ts:67), and left `/tmp/cland-suite.lock` and the nvim lock held by a dead pid. No local run started for 48+ minutes, and the queue showed `local: none` with the integrated cover waiting.

## Acceptance criteria

- [x] C1. A cancel stops the runner's whole process tree, fake harness descendants included, before it removes the suite root. A root recreated after that is still recognised as the run's own by token and owner.
  - done: impl-511 · 2026-10-24T12:24:39.511Z
- [x] C2. When the holder pid and runner group are dead and the root differs only by identity, recovery releases the locks and quarantines the root (renames it, without deleting it) instead of refusing forever. It journals `suite-recovery-quarantined` with both inodes.
  - done: impl-511 · 2026-10-24T12:24:39.728Z
- [x] C3. `cland verify queue` shows a blocked admission with its reason, instead of `local: none` beside a waiting run.
  - done: impl-511 · 2026-10-24T12:24:40.073Z
- [x] C4. A test cancels a run whose fake child recreates the root after the kill, and the next local run is admitted.
  - done: impl-511 · 2026-10-24T12:24:40.306Z

## Comments

### coord · 2026-10-15T15:59:15.048Z

Repaired by hand under the human's approval at 15:58Z; see T-204. The quarantined lock files are kept for diagnosis in the Coordinator job tmp until this is fixed.

### impl-511 · 2026-10-24T11:53:09.995Z

Test-first C2/C4 recovery slice: sealed public verification fixture kills its package runner, then fake child recreates the exact recorded phase-root path with a different inode. RED on macOS/local at ad611df9 + test: `next local run admitted after quarantine: not within 7000 ms`. Production change in progress; no live locks touched.

### impl-511 · 2026-10-24T12:02:29.085Z

Implemented the three vertical slices. Additional RED C1 receipt: `Missing expected rejection: suite root is never removed with a live detached descendant` (macOS/local). Cancellation now captures ancestry before interrupt and borrowed runners/workers defer root cleanup to hub termination. Targeted macOS/local: suite-cancel 8/8, suite-recovery 8/8, suite-protocol 15/15, suite-admission-responsive 2/2. Typecheck green; test lint report-only 133 findings, 0 refusals. Full mode-free task verification follows source review, not yet run.

### rev-23 · 2026-10-24T12:13:17.970Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-511-source
commit: 7f6661551e82710bcd100eb2b014df6620b398b6
scope: full
findings: [{"severity":"medium","text":"M1: Missing holder.runner bypasses dead-group proof and authorizes changed-inode quarantine; require confirmed known dead group and preserve root/locks on absent metadata.","file":"hub/src/suite-lock.ts","line":78},{"severity":"medium","text":"M2: Changed-inode quarantine returns before owned-writer discovery; a detached root-owned child can survive an already-dead parent/recorded group. Prove/reap writers or hold ambiguity before freeing locks.","file":"hub/src/suite-lock.ts","line":87},{"severity":"medium","text":"M3: Release-time compatibility recovery errors are saved only in job.error; active uncleaned job prevents occupied() inspection, so localBlocked reason/unknown ETA never appears for that path.","file":"hub/src/hub/suites.ts","line":1258},{"severity":"medium","text":"M4: Add required path-derived per-test guide/index entry for the new symlink/path/live/unknown-owner recovery safety cases.","file":"hub/test/suite-protocol.test.ts","line":22}]
finding_counts: {"high":0,"medium":4,"low":0}

T-511 full source review — not clear

Head7f6661551e82710bcd100eb2b014df6620b398b6/treec6d04d45965dd572b7e21f7f56b5f49bb09e75b7. First review merges dev512c4960bb573e8df6e215de8bceb509af8e7d6a; other parent977ab43d...; comparison git diff512c4960...7f666155.22files. Scope full, run rev-20261024-511-source, both axes in-session under Reviewer subagents=false.

Standards findings
M1 medium — hub/src/suite-lock.ts:78–85: changed-inode quarantine checks the recorded runner group only under if(holder.runner). A canonical same-owner dead holder with no runner metadata skips the dead-group proof, renames evidence and permits lock release. Missing group is unknown ownership, not confirmed death. Require a known dead group and add absent-runner negative/public-admission controls preserving root bytes and both locks. Existing unknown-group test supplies a runner object with missing group and misses this absent-object branch. Implementer reports a red reproduction/fix, not yet reviewed at a committed replacement head.

M2 medium — hub/src/suite-lock.ts:87–100: changed-inode branch renames then returns before cleanupProcesses(...discover:true). When the worker/recorded group died before cancellation or hub restoration, endProcess has no live ancestor to capture; a detached root-owned writer in another group can survive. A dead recorded group alone does not settle that writer. Perform independently verified cwd/ancestry writer discovery/cleanup before quarantine, holding on ambiguity, while retaining the changed inode's bytes. Add a real dead-parent/detached-live-writer public admission test and preserve assertions/timeouts. Implementer reports that proposed control reproduced true!==false for surviving writer; its raw/replacement correction remains pending.

M4 medium — hub/test/suite-protocol.test.ts:22: the two new recovery safety cases lack the required path-derived guide/index entry (docs/agents/tests.md:3). Add docs/agents/tests/hub-test-suite-protocol.test.ts.md, exact '# hub/test/suite-protocol.test.ts' heading and one index row, describing wrong path/symlink/live/missing-or-unknown-runner preservation. Existing cancellation/recovery/admission guides are present and useful.

Otherwise the diff retains PID/start identity checks, same-OS-user/canonical-token-path checks, lstat symlink refusal, before/after inode journal data and diagnostic quarantine rather than recursive deletion of the changed inode. Async daemon recovery remains in its bounded worker; native signal/tree discovery uses existing endProcess ownership. No new permission/dependency or role clause. Protocol/wire optional field is additive; implement skill provenance CHANGES is present. No separate baseline-smell finding.

Spec finding
M3 medium — hub/src/hub/suites.ts:1076,1257–1338: localBlocked is set only when LocalExecutor.occupied throws. The new LocalExecutor.release→compatibility recovery can throw during #inspect; that catch saves job.error but leaves cleaned=false. It remains an active local slot, so localActive>=budget bypasses occupied on subsequent admission ticks. The queue never sets the new blocked reason on this actual release-recovery failure path and can expose an ordinary run/estimated ETA instead. Expose the owned cleanup/release failure with reason and unknown waiter ETA, retaining it until successful recovery; add public queue/subscription/CLI controls with a waiting successor, not only mocked occupied failure. Preserve final admission/cleanup assertions.

C1/C2/C4 are therefore not established: current live-parent cancellation cases do not cover already-dead-parent detached writers, and unknown-group quarantine is unsafe. C3 is incomplete for cleanup-time recovery. Four findings are the complete set; no additional functional findings from reviewed queue/wire/CLI/runner/docs paths. T3 lifecycle tests have a legitimate cancellation/crash/process-tree reason, sealed child environments and owned cleanup; T2 request/CLI admission case exercises its actual public surface. The root move/recheck is within the repository's single-user local ownership model; no hypothetical concurrent-attacker requirement added.

A-10906 is summary evidence: local pre-merge targeted suite-cancel8/8, recovery8/8, protocol15/15, admission2/2, runner45/45; exact merged-head typecheck and two cancellation scenarios4.26/4.11s, no task-suite proof. Original native call/output/exit/timing/platform/source preservation requested without rerun for transcription or invented check wall time. M1/M2 correction red claims are acknowledged as implementer-reported pending raw artifact/replacement-head audit. No configured verification has run; remain held until corrected pushed-head source clear.

QA none/after-stage/no brief/criteria. Reviewer only static Git/source/tracker/docs/artifact reads, no tests/probes/edits/install/Git mutation/browser/delegation. Standards3medium(M1,M2,M4); Spec1medium(M3).
Durable audit A-10923.

Criteria: C1 failed (M2: Already-dead parent can leave a detached writer alive before quarantine/unlock.), C2 failed (M1/M2: Missing runner proof and skipped detached-writer discovery authorize unsafe recovery.), C3 failed (M3: Release-recovery failures do not surface blocked reason/unknown ETA.), C4 failed (M2/M4: Dead-parent survivor regression and protocol safety guidance are incomplete.).

### rev-23 · 2026-10-24T12:22:18.205Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261024-511-source2
commit: 0a4d77eba61d76e4573269a06ac9f4ef3d8c79e4
scope: full
findings: [{"severity":"medium","text":"M5: Register cleanup ownership for canonical external root/.original/quarantine and deferred writer identities before setup creates/spawns/awaits; current hook is installed only after marker/stat, leaking external paths on setup failure.","file":"hub/test/suite-recovery.test.ts","line":52}]
finding_counts: {"high":0,"medium":1,"low":0}

T-511 corrected full source review — not clear

Head0a4d77eba61d76e4573269a06ac9f4ef3d8c79e4/treef7bee1ee6beea8c82671df96ed513bfb564506d0; fixed full-review base512c4960. Reviewed correction7f666155..0a4d77eb plus full-head validity against A-10923. No dev merge. Scope full, run rev-20261024-511-source2.

Resolved M1–M4
M1: group is now read from holder.runner?.group and validated unconditionally before quarantine. Missing or unknown group refuses without moving root or releasing locks. The direct safety control and public seeded-stale-lock control preserve bytes/owner records and show runner-group reason.

M2: changed-inode recovery now performs independent cwd/ancestry discovery through existing cleanupProcesses(...discover:true) before moving evidence. Independently owned detached writer is reaped; any preserved ambiguous-candidate diagnostic keeps root/locks held. Last inode recheck and existing same-owner/token/symlink/group guards remain before rename. Public real dead-parent/detached-child control checks writer death and preserved quarantine bytes before successor result; negative argv/environment-only candidate stays alive and preserves lock owners. No broad hint-only signalling is authorized.

M3: snapshot derives a blocked reason from an active uncleaned local job with outcome+error, covering the release-time recovery path that never reaches occupied(). Existing occupied inspection error remains the fallback. Unknown successor ETA, pushed queue and real CLI reason are checked; successor execution stays blocked until release succeeds, after which the job no longer occupies the slot and the error disappears. Protocol/shared wire comments and docs now cover both paths.

M4: exact '# hub/test/suite-protocol.test.ts' guide/index added, with adequate T2 refusal and T3 native-positive seam separation. Existing guards unchanged.

Remaining finding
M5 medium — hub/test/suite-recovery.test.ts:52–83: the new dead-parent/detached-writer case creates a canonical root outside f.root, lets the parent rename it to .original and spawns writers, then awaits marker/stat before registering onCleanup for root/.original/quarantine. An error during setup before those receipts leaves those external paths without a registered cleanup owner. This is a failure-path fixture ownership gap, not a request to relax final assertions. Register resource-before-directory cleanup before root creation/spawn/await; defer captured parent/child identities and recover an unobserved writer through the owned root seam as needed. Stop/prove writers gone before removing the exact root/original/quarantine paths. Preserve all current writer/quarantine/successor assertions. Implementer accepted M5; replacement committed source still required.

Evidence
A-10937/A-10940/A-10945 retain transcribed native stdout/exits and Node timings, explicitly partial local macOS working-tree attribution, not original complete orchestration envelopes/configured Linux proof. M1 red shows unexpected quarantine + missing rejection; M2 red shows detached survivor true!==false; M3 red queue reason missing. Correction green reports recovery11/11, cancellation8/8, protocol15/15, queue3/3 and typecheck/static green/report lint133/0refusals. Source committed unchanged after corresponding runs, not exact post-commit reruns. No overall check wall time inferred; no rerun for transcription. Runtime assertions/timeouts/caps remain unchanged. Exact source outcomes still await configured verification after source clear.

C1–C3 corrected source intent accepted but remain runtime-unverified; C4 incomplete for M5 failure-safe regression ownership. Prior findings are resolved, no additional production or permission issue found in corrected full-head audit. QA none/after-stage/no item brief/criteria. Verification remains held until replacement pushed-head source clearance. Reviewer static Git/source/docs/tracker/artifact reads only, no tests/probes/edits/install/Git mutation/browser/delegation. Standards1medium(M5); Spec0remaining source findings.
Durable audit A-10958.

Criteria: C4 failed (M5: New detached-writer regression registers external-root cleanup after setup awaits.).

### rev-31 · 2026-10-24T12:25:47.459Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261024-511-source3
commit: f7b3279d44935ff861aeb26db292754d48efb983
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-511 corrected full source review — clear

Head f7b3279d44935ff861aeb26db292754d48efb983, tree ed418bb989af7ce49dc5bdc502f94c292a83be74. Fixed full-review base 512c4960bb573e8df6e215de8bceb509af8e7d6a. Inspected correction git diff 0a4d77eb..f7b3279d and full-head inventory, carrying rev-23's full Standards/Spec audits A-10923 and A-10958 at prior heads. Local origin ref matches exact request, task worktree clean, correction whitespace clean; no post-review dev merge. Request directly addressed rev-31; hold was free. Prior reviewer notified of replacement ownership. Current task.view now confirms all C1–C4 claimant done; none runtime-verified. QA none/after-stage, no item QA criteria.

## Standards

M5 resolved; no remaining findings. Only suite-recovery.test.ts and its canonical guide changed after 0a4d77eb. The beforeDirectories hook is registered before canonical-root mkdir, script writes, spawn and setup awaits. Parent/child stop closures begin as deferred no-ops and are replaced immediately on capture; quarantine path is assigned before admission can move the root. Missing marker receipt still leaves exact root cwd discovery available. Cleanup stops captured parent/child, discovers/reaps writers for all existing exact root/.original/recorded-quarantine paths, and completes those sweeps before any rm. A cleanup failure prevents this hook from deleting paths while ownership remains unsettled.

Inspected process-cleanup.ts lifecycle ordering: resources, hubs, directories, checks. projectHub registers its daemon.stop/processLog.close beforeDirectories hook during fixture creation, before this new external-root hook, so the hub and admission activity stop before external-root writer discovery/removal. ownProcess cleanup closures are idempotent and retain original process identities; discovery passes no broad ancestry anchor and uses the existing exact-cwd proof seam. No arbitrary process signalling, human root, live project or additional permission was introduced. Final independently-owned-writer-dead, preserved quarantine bytes and successor-admission assertions are unchanged. Canonical path-derived guide records early ownership and missing-receipt cleanup.

M1–M4 remain resolved as reviewed in A-10958: absent/unknown runner group preserves root and locks; independent cwd/ancestry discovery precedes changed-inode quarantine and ambiguity refuses; release-time errors expose blocked reason/unknown successor ETA; suite-protocol safety guide/index exists. Those production/wire/CLI/doc corrections are unchanged by this M5 commit. The full design and lifecycle-tier justifications remain carried from the prior reviews; no new source, test-tier, workload, budget, dependency, skill or role-clause change. No baseline-smell finding.

## Spec

No remaining source findings. C1/C2 intent established by carried cancellation/tree ownership, known dead-group proof, independent detached-writer cleanup and quarantine preservation/journal evidence. C3 intent established by carried release-error/occupied-error queue projection, pushed socket/CLI reason, unknown waiter ETA and clearing only after recovery. C4 regression now has failure-safe ownership before setup, while original writer/quarantine/successor assertions and all time bounds remain. Current C1–C4 runtime settlement awaits configured verification; source clearance alone does not verify them.

A-10962 retains native correction working-tree receipt immediately before commit, local macOS/Darwin, not an exact postcommit rerun: changed scenario 1/1 exit 0, 2461.921833 ms, native file runner 2821.161 ms; hub typecheck exit 0, no invented total wall time. Earlier A-10937/A-10940/A-10945 remain partial transcribed original stdout/exits/Node timings with their source/platform limits. No original unavailable orchestration envelope reconstructed and no rerun for transcription. These targeted checks are not configured Linux/full task proof.

Disposition: full corrected source clear, findings []. C1–C4 remain runtime-unverified. Submit ordinary configured mode-free cland verify at this unchanged clean head and route the result to this reviewer/item topic. Keep source stable; no unauthorized dev merge, test relaxation or enqueue. Reviewer read only Git/source/tracker/docs/artifacts; no tests/probes/process signals/browser/delegation.

Standards: 0 remaining findings. Spec: 0 remaining source findings.
Durable review A-10971.
