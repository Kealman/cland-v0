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
updated: 2026-10-24T13:05:35.580Z
---

## Summary

Cancelling a local verify can wedge local admission for good. On 2026-10-15 at 15:09:59Z, `cland verify cancel` of cff20897 killed the runner (pid 48812, group 53758). Fake harness processes then recreated the suite root `/tmp/cland-suite-<token>-1`, so its inode no longer matched the holder's recorded inode. From then on, every admission attempt ran recovery, hit `suite root identity changed; refusing cleanup` (hub/src/suite-lock.ts:67), and left `/tmp/cland-suite.lock` and the nvim lock held by a dead pid. No local run started for 48+ minutes, and the queue showed `local: none` with the integrated cover waiting.

## Acceptance criteria

- [x] C1. A cancel stops the runner's whole process tree, fake harness descendants included, before it removes the suite root. A root recreated after that is still recognised as the run's own by token and owner.
  - verified: rev-23 [reviewer] · run rev-20261024-511-final · 2026-10-24T13:01:39.230Z · commit 2f4067a7e0c7cc513d899f8fd245275233804337
  - done: impl-511 · 2026-10-24T13:03:21.404Z
- [x] C2. When the holder pid and runner group are dead and the root differs only by identity, recovery releases the locks and quarantines the root (renames it, without deleting it) instead of refusing forever. It journals `suite-recovery-quarantined` with both inodes.
  - verified: rev-23 [reviewer] · run rev-20261024-511-final · 2026-10-24T13:01:39.230Z · commit 2f4067a7e0c7cc513d899f8fd245275233804337
  - done: impl-511 · 2026-10-24T13:03:21.659Z
- [x] C3. `cland verify queue` shows a blocked admission with its reason, instead of `local: none` beside a waiting run.
  - verified: rev-23 [reviewer] · run rev-20261024-511-final · 2026-10-24T13:01:39.230Z · commit 2f4067a7e0c7cc513d899f8fd245275233804337
  - done: impl-511 · 2026-10-24T13:03:22.043Z
- [x] C4. A test cancels a run whose fake child recreates the root after the kill, and the next local run is admitted.
  - verified: rev-23 [reviewer] · run rev-20261024-511-final · 2026-10-24T13:01:39.230Z · commit 2f4067a7e0c7cc513d899f8fd245275233804337
  - done: impl-511 · 2026-10-24T13:03:22.321Z

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

### rev-31 · 2026-10-24T12:37:24.753Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261024-511-evidence1
commit: f7b3279d44935ff861aeb26db292754d48efb983
scope: evidence
findings: [{"severity":"medium","text":"M6: Two task-owned new cancellation identities pass assertions but exceed the enforced 5 s gate at 5.162017751 s and 5.324462362 s without exact reasoned allowances. Correct through measured headroom procedure; preserve assertions/bounds.","file":"hub/test/durations.json"}]
finding_counts: {"high":0,"medium":1,"low":0}

T-511 same-head configured evidence review — not clear

Head f7b3279d44935ff861aeb26db292754d48efb983, tree ed418bb989af7ce49dc5bdc502f94c292a83be74. Carries source-clear rev-20261024-511-source3/A-10971 (M1–M5 resolved). Task/origin refs remain exact. Audited original A-11004; task.view confirms run f553ad46-30f7-4fd2-8e0b-9ea87e278fe4 finished failed at this head.

Actual enforced failure (A-11004 lines 15048–15049):
duration budget: hub/test/suite-cancel.test.ts::verify cancel reaps a detached fake child that recreates the root after runner death, then admits the next run 5.324 s > 5 s (add to hub/test/durations.json with a reason)
duration budget: hub/test/suite-cancel.test.ts::verify cancel reaps a detached fake child before removing the phase root, then admits the next run 5.162 s > 5 s (add to hub/test/durations.json with a reason)

M6 medium, hub/test/durations.json: both task-owned new cancellation identities exceed the enforced 5 s new-identity gate without an exact allowance. Native passing samples are 5.324462362 s and 5.162017751 s (ordinary finish events lines 14941,14956). This is a duration-gate failure, not an assertion failure, capacity refusal or shared defect. No unchanged-head retry.

Completed evidence: T0 host check exit 0, 37.063 s; T1 exit 0, 58 s; full hub+Neovim T2 fallback exit 0, 338 s. Changed T3 phase exit 1, 39 s despite all 19 selected identities passing; two changed files, one base execution/no repetitions, measured added selected-phase wall 35.278 s excluding machine wait. No T4 selected and Web never executed; Web counts/timings unavailable, not zero runtime or pass. Remaining T3 periodic/integrated occasions remain deferred.

Receipt ordinary totals 2692 passes, no assertion failures/skips/cancellations; parsed finish events confirm 2692 ordinary pass plus 20 separate load-gate passes, matching 2712 completed-before-interruption. The four owned new T2 queue/protocol groups each have ordinary pass, five distinct passing repeat IDs and explicit 5/5. The T3 dead-parent/detached-writer correction passes at 3.183585413 s; other owned T3 safety/quarantine cases passed. This useful partial proof does not make the task suite green.

Executor droplet c-8 lon1, Linux x64 6.8.0-142-generic, Node v24.21.0, Neovim v0.12.5, workers 2, lifetime 530 s, cost $0.0368. Typecheck uses host gate 62e641ef0e95627fc88d6c53c4a3d57c0daf3129, not repeated remotely. Generic budget/lint and T3 growth diagnostics are report-only: 133 findings/60 files; ratchet 2215.851 s vs 2195.304 s would refuse growth. Those report lines are separate from the two enforced new-identity failures. No budget-pass or integration/QA claim.

Disposition: evidence not clear, M6 only; fail C1/C4 for their cancellation duration gates. C2/C3 remain runtime-unverified, not new functional defects. Preserve assertions, setup bounds and workload. Review existing final-source passing samples and use the documented headroom procedure in docs/agents/tests.md: exact identity allowances in allow, reason describing lifecycle need and measured source/platform/artifact, approximately 1.5x worst passing sample, nearest open owner, valid UTC added/expires <=7 days. No new repetitions requested for transcription or for these task T3 base checks. Do not silently rewrite baselines or blanket-allow unrelated known report-only overages. Ratchet remains visible for the supervising lead's merge-budget planning.

Any allowance/source change requires a fresh pushed-head full source review before ordinary configured mode-free verification. Restore affected claimant done marks after the correction. No assertion/time-bound relaxation, unauthorized dev merge or enqueue. Reviewer only read-only log/source/Git/tracker inspection, no execution or delegation.
Durable audit A-11007.

Criteria: C1 failed (New cancellation process-tree proof exceeds its enforced duration gate without an allowance.), C4 failed (New recreated-root cancellation/successor proof exceeds its enforced duration gate; configured suite exits 1 before Web.).

### rev-23 · 2026-10-24T12:44:22.711Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-511-source4
commit: 2f4067a7e0c7cc513d899f8fd245275233804337
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-511 allowance-corrected full source review — clear

Head2f4067a7e0c7cc513d899f8fd245275233804337/tree88331d57912946e2aab806f4c4e96a3af387ad35; task branch ref independently matches. Sole parent f7b3279d44935ff861aeb26db292754d48efb983; git diff parent..head contains only hub/test/durations.json. Full fixed-review base512c4960bb573e8df6e215de8bceb509af8e7d6a. Carry full source audits A-10923/A-10958 (rev-23), A-10971/rev-20261024-511-source3 (rev-31), and failed evidence A-11007/rev-20261024-511-evidence1. Direct replacement request assigned rev-23 with free hold; rev-31 notified. Scope full, run rev-20261024-511-source4, findings []. Reviewer read-only source/Git/tracker/docs/artifact/log reads; no tests/probes/edits/Git mutation/browser/delegation; both axes in-session per staffing policy.

## Standards
M6 resolved in source: exactly two new allow entries, existing allow entries byte-equivalent and other top-level duration data unchanged. Exact new cancellation identities match original A-11004 native ordinary passing finishes5.162017751s and5.324462362s. A-10945 retains local macOS/darwin passing4.175276375s and5.209689916s. Those local working-tree receipts precede commit0a4d77eb, not a post-f7b3279d execution; suite-cancel.test.ts is independently unchanged0a4d77eb..2f4067a7, while intervening M5 changed recovery cleanup only. Reasons cite actual platforms, artifact IDs and source limits rather than claiming a postcommit local rerun.

ceil(1.5*5.162017751*1000)/1000=7.744s; ceil(1.5*5.324462362*1000)/1000=7.987s. Caps are approximately1.5x worst of the two retained passing observations, not last-sample bounds. Lifecycle reasons name real local worker, borrowed package runner/detached fake harness, receipt-backed tree death, recreated-root/quarantine/successor proof. OwnerE-1194 independently open and task's nearest container; added2026-10-24/expires2026-10-31 valid seven-day nonlegacy span. Coordinator7b984e58 authorizes these measured caps and leaving E-880/ratchet alone; claimant's Oct31 corrects the Coordinator's suggested Nov23 to the documented maximum. docs/agents/tests.md's >=80% recommendation printer threshold is separate from the enforced5s new-identity failure; explicit reasoned caps here address that observed failure without claiming a generated stanza or changing tier budgets.

No test source, workload, assertion, setup deadline, polling bound, dependency or role change after f7b3279d; no dev merge. Existing E-880 allowances and baselines unchanged; no blanket allowance. Whitespace clean. A-11016 reports manifest/tier/owner/date/identity validation exit0 and diff check0 as local partial static evidence, no test rerun for transcription and no configured pass.

M1–M5 stay resolved under carried audits: unknown runner group preserves root/locks; independently owned detached-writer discovery precedes quarantine and ambiguity holds; release recovery errors expose blocked reason/unknown ETA; protocol guide/index present; external fixture root/deferred writer cleanup registered before setup and stops hub/writers before directory deletion. M5 correction's early beforeDirectories ownership and missing-marker cwd discovery remain unchanged. No remaining standard or baseline-smell finding.

## Spec
C1–C4 source intent remains established by carried process-tree teardown, token/inode ownership/quarantine/journal, queue/CLI/subscription blocked reason and unchanged fake-child/successor assertions. New allowances alter only acceptable measured runtime for the two native identities. All four current claimant done marks restored; runtime verification remains pending, none marked verified here.

A-11004/f553ad46 remains FAILED at oldf7b3279d: T0/T1/allT2 exit0, changedT3 assertions19/19 pass but phase exit1 on two exact enforced new-identity gates; Web not run, noT4.2692ordinary+20separate load passes do not make an overall passing task run. A-11007 already records that disposition. No unchanged-head retry or retroactive pass is assigned. Report-only T3 projection2215.851vs2195.304s(+20.547s) remains for lead merge planning, not actualwall or an enforcing ratchet failure; lint133/60 and unrelated report warnings remain.

Submit fresh configured mode-free verify at exact unchanged2f4067a7 and return original head/run/log/actualphase/platform/duration receipts to this reviewer/topic. No forced full suite, extra load repetitions, unauthorized dev merge, per-item QA or enqueue. C1–C4 remain runtime pending. Standards0 findings; Spec0 findings.

Durable A-11029.

### rev-23 · 2026-10-24T13:01:39.230Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-511-final
commit: 2f4067a7e0c7cc513d899f8fd245275233804337
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-511 final same-head evidence — clear

Head2f4067a7e0c7cc513d899f8fd245275233804337/tree88331d57912946e2aab806f4c4e96a3af387ad35; branch ref independently matches. Full source rev-20261024-511-source4/A-11029 remains current; carried full A-10923/A-10958/A-10971 resolves M1–M5, measured allowance correction resolves M6. Scope evidence, run rev-20261024-511-final; findings []; C1–C4 verified. Reviewer static source/Git/tracker/docs/artifact/log reads only, no tests/probes/edits/Git mutation/browser/delegation.

Original configured mode-free e527424e-713d-40a6-92ad-d2adc58479d4/A-11061 finishes exit0; task.view independently agrees exact passed head. Native finishes2974ordinary passing tests/425passing files plus20 separate load-gate passing test/file records (four new T2 identities each5/5), zero fail/cancel/skip. Actual hostT0/allT1(137files848top-level identities), fallbackallhub+NeovimT2(242/1772), two changedT3files19identitiesonce/no repetitions and fullWeb44files225top-level identities completed. Selected changed-phase addedwall33.617s excludes machine wait; not a whole unchangedT3/T4/stage/QA cover. NoT4 command; remainingT3 deferred by configured policy.

C1/C4: native detached fake child normal-root cancellation4.150849611s and recreated-root cancellation5.311332285s pass. Final unchanged assertions require detached PID dead before cancellation report, no early root-removal marker, distinct recreated inode where applicable, subsequent verification autoexit0 and released locks. These satisfy process-tree-before-delete and token/owner/successor requirements; no timer or assertion relaxation. Existing cancellation/restart/queued-holder cleanup cases also pass. Both exact measured allowances remain7.744/7.987s, ownerE-1194, added10-24/expires10-31, supported by multiple retained local/Linux passing samples; current observations fit without editing allowances/baselines/E-880.

C2: changed-inode quarantine proof4.119210342s passes with journal suite-recovery-quarantined before/after device+inode objects, preserved quarantined bytes, original path absent and both locks absent. Independent dead-parent/detached-writer proof2.159997202s passes; ambiguous ownership1.461883793s preserves writer/evidence/locks, missing-runner metadata0.983644121s preserves both locks and no execution. Early registered cleanup ownership from M5 remains unchanged. T2 no-symlink/outside-token guard0.013546873s plus5/5max0.026511912s; live/unknown runner guard0.003213283s plus5/5max0.013973313s.

C3: release-recovery failure stays blocked until cleanup/successor admission, ordinary0.509088544s plus5/5max0.592793625s. Occupied-admission blocked reason through queue/CLI/subscription ordinary0.254281906s plus5/5max0.370535261s. Source retains unknown successor ETA while unresolved, clears only after recovery, with final CLI/socket assertions. Both are below2sT2. Existing status/cancel responsiveness0.086093657s passes.

HostT0check34.323s exits0; marker dca4c6736e4b6f4912fd4920531b32972b9d706e independently a Git tree, retained host gate not repeated remotely. T1/T2/T3/Web envelopes55/315/37/137s differ from suite50.89/311.32/33.67/132.95s and shards50.88/228.30hub+82.98Neovim/33.66changed/132.85Web. FinalWebprojection150.266s at2workers is not measured wall at4workers. Linuxx64 6.8.0-142-generic,c-8lon1 cland-v0-394e4b3d, Node24.21/Nvim0.12.5, workers2/Web4,lifetime634s/$0.0441;diskfsync21.85ms/SQLite9.41ms,tmpfs0.06/0.45ms,iowait/steal0.01%.

Report-only lint133/60, unrelated Web/scale/render overages and existing native >5s notices retained. Webwall132.95>40s/items40.441s. Ratchet2213.490vs2195.304s(+18.186s) remains projected report-only growth for Coordinator planning, alongside prior sample+20.547s. Neither is measured selected-phase addedwall or an enforcing ratchet failure. No blanket allowance or enforcing-budget/clean-lint claim. Old f553ad46/A-11004 remains FAILED atf7b3279d before Web despite passing assertions; A-11007 disposition is not retroactively changed.

Historical A-10937/A-10940/A-10945/A-10962 are partial transcribed local working-tree outputs/exits/native timings with exact attribution limits, not reconstructed raw orchestration or postcommit reruns; source4 independently confirmed cancellation test unchanged across the relevant commits. No inferred overall checkwall. New configured receipt independently completes this head's required phases.

Fresh implementer conflict receipt245203be: fetched origin/dev16a7bbe526dc989c701b4bf20cc1676763fdea2a conflicts in suites.ts and durations.json; usage.ts auto-merges. Reviewed head stays clean unchanged and Coordinator has been asked for integration direction. Final evidence verdict applies only to2f4067a7 and is not conflict clearance or landing authorization. Any authorized resolution/head change requires fresh source review and configured evidence. All four claimant done marks current. No item QA required(none/after-stage); Coordinator owns enqueue/merge. Standards0 findings; Spec0 findings.

Durable A-11067.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### rev-23 · 2026-10-24T13:05:35.580Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261024-511-delta1
commit: 2a45fb9b298f7f34c3cc11a2bfefbe0ff1ebee58
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

T-511 authorized dev integration delta — clear

Head2a45fb9b298f7f34c3cc11a2bfefbe0ff1ebee58/tree4a75a0635926dfc6f33b3ccaab938dff74104af8; branch ref independently matches. Merge parents old reviewed2f4067a7e0c7cc513d899f8fd245275233804337 and Coordinator-pinned dev16a7bbe526dc989c701b4bf20cc1676763fdea2a. Authorization92b9629f, clarified live-key policy73f8ce24 independently read in topic971. Scope delta, run rev-20261024-511-delta1; findings []. Carry full A-10923/A-10958/A-10971/A-11029 and old-head final A-11067. Reviewer read-only source/Git/tracker/docs/artifact reads only; no tests/probes/edits/Git mutation/browser/delegation.

## Standards
Compared old task patch git diff512c4960...2f4067a7 with integrated task patch git diff16a7bbe5..2a45fb9b on every one of24 task-delta files. Added/removed line sequences match exactly per file; no patch-content differences, extra functional edits or formatting churn. The102file first-parent diff is incoming dev work, not new claimant scope. Inspected suites.ts and durations.json conflict resolutions directly against second parent.

suites.ts adds only previously reviewed localBlocked state, occupied() inspection error ownership/clear-on-success, release-error projection, unknown local ETA and queue field onto dev. Dev remoteLeases, detached/coalesced sweep, newer explicit-read cache precedence, durable-only remote slot occupancy/ETA handling stay intact. #schedulerSnapshot includes both local blocking and remote accounting; no fresh lease I/O reintroduced into coalesced #check publication. Other incoming T1098/T1211/T1231 changes remain dev content. No callback/cleanup/assertion/bound change in T511 core or tests. Both local and remote semantic paths retain prior reviewed intent.

Parsed durations manifest matches every top-level dev value except allow, preserves every existing dev allowance unchanged, and adds only two prior reviewed exact T511 entries7.744/7.987s E1194 added10-24/expiry10-31 with unchanged reason strings. Dev intentionally removed obsolete T65 identity keys and replaced them for T1222; they remain deleted per Coordinator73f8ce24, not resurrected by a literal key union. Existing live keys/baselines/E880/stanza budget unchanged. Whitespace check clean. Skills CHANGES and all four canonical test guides/index remain in task patch, retaining incoming dev guidance independently. No material standard/smell finding.

## Spec
No source regression. C1–C4 cancellation/tree ownership, recreated inode quarantine/journal, blocked CLI/subscription/unknown local ETA and fake-child/successor tests retain exactly their prior reviewed task edits. Fresh done marks present; old2f4067a7 runtime verifications are stale on this head and are not reapplied here.

A-11072 reports partial local macOS/darwin precommit resolution checks: admission-responsive3/3exit0/Node687.074375ms; suite-queue4/4exit0/319.396292ms; remote-budget17/17exit0/1363.247375ms; hub-onlytypecheck and identity/owner/date/tierlint exit0. These are summary receipts with working-tree attribution, not original configured evidence or inferred totalcheckwall. Preserve available native originals and source/platform limits without reruns for transcription. No new runtime verification at this merged head is claimed.

OldA-11061/e527424e green remains attributed only to2f4067a7; A-11067 settled that head's2974ordinary+20load passes. Prior failedA-11004 remains failed before allowance correction. Report-only T3 projected growth+18.186s(prior+20.547s) remains lead planning data, not current-head observedwall or an enforcing budget pass. No wholeT3/T4/QA/stage claim.

Coordinator92b9629f explicitly requires NO configured verify yet. Wait for T1214 usage split landing/notification, perform only the authorized second integration and move task help line into command-owned module, then request small exact-head delta review. One combined mode-free configured run follows that clearance. This source verdict does not lift the scheduling hold. C1–C4 remain runtime pending; no per-item QA(none/after-stage). Coordinator owns enqueue/merge. Standards0 findings; Spec0 findings.

Durable A-11073.
