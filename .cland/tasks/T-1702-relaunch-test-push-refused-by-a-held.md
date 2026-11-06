---
id: T-1702
kind: task
title: A push to the territory is refused with "push retry required" while another territory operation holds the lock, failing relaunch tests under load
state: closed
status: done
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
regression_of: T-1614
found_by: cover
topic: topic-1399
branch: t/T-1702-relaunch-test-push-refused-by-a-held
created: 2026-11-06T01:44:41.119Z
updated: 2026-11-06T08:59:14.596Z
closed: 2026-11-06T08:59:14.596Z
---

## Summary

A git push to the territory from a host worktree is refused with `cland: host <h>: push retry required: another territory operation holds the lock (pid …)` while another territory operation holds the lock. Under load this fails E-1532 stage 6's relaunch tests. It's now a reproduced defect, no longer a flake, and blocks stage 6.

Occurrences:
- Merge batch 16d0ab14 (A-17000/A-17001, Linux x64 droplet, peak load 6.4): hub/test/host-relaunch.test.ts "C2/C3 admitted host relaunch running keeps durable native and checkout ownership". The f2 push was refused, and the cleanup also showed `watch …/f1/…: producer result missing; native cleanup retained`.
- Stage 6 macOS cover 2f714548 (A-17016, dev 72ba2260, darwin arm64, peak load 12.1), repetition 4 of the load gate, two cases:
  - the same host-relaunch.test.ts "running" case (pid 59575);
  - hub/test/host-relaunch-native.test.ts "C2 production Codex relaunch crosses owned carriers and consumes a fresh native first input" (pid 97177).
  Both failed with the same refusal; the stack goes through hub/src/territory.ts.
- The Linux cover 38e6c547 at the same tree was green. impl-1698's matrix (A-17002) had 30 runs with no failure at load 1.5 to 4.2.

The lock holder isn't attributed yet. The project hub and both git daemons share the test-process pid, and the fixture discards the daemons' `log` events.

## What to build

1. Name the holder. Trace territory-lock acquire and release, with the operation name, in the relaunch fixtures, and reproduce under load (macOS with a load of 12 or more, burners allowed under the preservation lock). Candidates:
   - the hub's lease transfer or relaunch preparation;
   - the old host's agent ref-watch producer (push on ref move, T-1609, and T-1693's observe order);
   - the new host's publisher;
   - a T-1698 retry or transfer path.
2. Product decision (coord, 2026-11-06): a push to the territory waits, with a bound, for a held territory lock instead of refusing at once. Waiting at most 30 s through the existing lock-wait mechanics matches the setup budgets. It still refuses with the same named message once the bound expires. A push refused by a lease (`not leased to this host`) still refuses at once. If the holder turns out to be a relaunch operation that is still running after relaunch reported running, fix that ordering as well: running means the lease transfer and preparation are complete.
3. Tests: a deterministic reproduction (red before the fix) where a push arrives while a held territory operation releases within the bound and is admitted, and another where the lock is held past the bound and the push is refused with the named message. The two relaunch tests stay unedited and pass under load.

## Acceptance criteria

- [x] C1. The territory-lock holder at the refused push in the relaunch tests is named from a trace or a deterministic reproduction (evidence).
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67
  - done: impl-1702 · 2026-11-06T07:33:46.300Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-2 · 2026-11-06T08:11:29.025Z · commit 355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f
- [x] C2. A territory push arriving while the lock is held is admitted once the holder releases within the bound, and refused with the named message after the bound (tests, red before the fix).
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67
  - done: impl-1702 · 2026-11-06T07:33:46.710Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-2 · 2026-11-06T08:11:29.026Z · commit 355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f
- [x] C3. host-relaunch.test.ts and host-relaunch-native.test.ts pass unedited, 10 of 10 on macOS at a one-minute load of 12 or more, and 5 of 5 in a Linux `docker run --init` run (evidence).
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67
  - done: impl-1702 · 2026-11-06T07:33:46.963Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-2 · 2026-11-06T08:11:29.026Z · commit 355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f

## Comments

### impl-1702 · 2026-11-06T03:48:11.402Z

Rule 20 sweep: searched all tracked source/docs/skills/QA/test tiers for withTerritoryLock/Async, territoryLock, TerritoryBusy, push retry required, HOST_PUSH_TIMEOUT_MS and refusal text. Receive: host/git-daemon.ts is the only producer of push retry required; migrate to bounded acquisition. Lease: host/branch-leases.ts grant remains immediate, revoke retains existing 32s wait/reentrant fence. Relaunch: host/task-worktrees.ts prepare/remove/transfer retain immediate serialized critical sections; running ordering inspected via relaunch tests. Hub worktrees.ts prune, territory.ts provision/undo/ensure/remove/reconcile/restore, daemon startup recovery/hook refresh, git-maintenance.ts retain immediate ownership. TaskMerges/hub merge.ts, merge-batch-territory.ts and merge-batches retry TerritoryBusy unchanged; Releases unchanged. cland push/sync use existing dispatch worktrees serial and territory critical sections, unchanged. Agent push-on-ref-move and publication/flush/relaunch tests consume git push status; successful wait now replaces transient refusal, lease and terminal refusal shapes unchanged. No wire or persisted record changes. Migrate host-allow-list held-revoke expectation to injected bounded expiry; preserve old refusal text regression. territory-lock, host-lease-lock, worktree-host, territory-task-branch, push, git-maintenance and merge-batches tests unaffected immediate/revoke seams. Update implement skill, ADR 0004, init/update and host/lock docs plus stage-2 QA expectations and per-file guidance; startup probes and other T3/T4 fixtures have no matching immediate push-refusal expectation. CLI help/role permissions unchanged: internal socket acquisition policy only.

### impl-1702 · 2026-11-06T03:52:14.043Z

C1 evidence A-17017: deterministic macOS load 13.445 reproduction names the previous receive-pack asynchronous lock-release tail after client completion; both success-after-release and bounded-expiry cases red before fix. Keep bounded wait alone: native stdout pipes receive protocol success to the client before native close; releasing lock before native close weakens the publication/child ownership fence. Guaranteeing release before success requires buffering/parsing receive status (with framing and bounded storage), not merely moving socket EOF, and is beyond a small ordering change. Both relaunch files remain unedited.

### impl-1702 · 2026-11-06T04:09:23.477Z

C3 complete at source77e4aabe9: evidence A-17018 contains10/10 eligible macOS whole-file relaunch pairs (all3tests each, sampled load12.09–19.58) and5/5Linux arm64 docker --init pairs, plus full allow-list12/12 both platforms. Two extra green mac repetitions excluded for load20.75/11.98. Preservation143/143 and host-push-on-ref-move5x4/4. Typecheck/static/tier/finaltestlint green; initial testlint refusal corrected with native-bound reason. Newcase worst2.834s mac/0.580s Linux, below3s/4s allowance thresholds. Burners reaped before Docker, preservation lock owner-checked/released. Source review requested from reviewer at77e4aabe9146017c6f77d69a4e7be4e40c7b257d; final suite verification pending source verdict.

### rev-35 · 2026-11-06T04:12:56.469Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1702-source-1
commit: 77e4aabe9146017c6f77d69a4e7be4e40c7b257d
scope: full
findings: [{"severity":"medium","text":"New expiry fixture admits a holder waiting on release.promise before setup awaits, but release/join finally starts only after eventually/connect. A setup rejection leaves the lock writer and possible client unowned through root teardown. Register fixture-owned release+join before the first await and close any client once constructed; preserve deadline/refusal assertions. Rule12; confirmed no separate owner.","file":"hub/test/host-allow-list.test.ts","line":317}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17020: full source not clear, one medium Standards finding at host-allow-list317; no product-source Spec blocker. Receive acquisition uses existing capped30s backoff, same expiry message, unchanged update-hook lease rejection/upload behavior and native-close/release fence. C1 deterministic prior receive-release tail is named with explicit historical attribution limits. C3 raw Mac10×3 and Linux5×3 named outcomes independently inspected, relaunch files unedited, extra out-of-range Mac greens excluded; no final criterion verification yet. Correct fixture ownership before setup awaits and request fresh source review before configured verify. A-17019 provenance addendum available for final inspection; no extra run requested solely for provenance. Diff check clean; docs/skill/QA consumers inspected. No Reviewer execution.

Criteria: C2 failed (Expiry regression fixture lacks prearmed release/join owner across setup failure, permitting an admitted territory-lock writer to outlive teardown.).

### impl-1702 · 2026-11-06T04:14:35.300Z

Fixed review rev-35-1702-source-1 at af381e438992f7975584d98385f0061778d56a67: prearmed expiry fixture cleanup owns any client closure and holder release/join before setup awaits. Both assertions unchanged. A-17021 contains final-head affected whole-file12/12 macOS and12/12Linux docker --init plus hub typecheck0 and completion provenance. Only expiry test changed; production/relaunch/docs unchanged, so A-17017/18/19 remain explicitly historical77e4 C1/C3/preservation receipts. Fresh source review requested; no verification before clear.

### rev-35 · 2026-11-06T04:16:12.224Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1702-source-2
commit: af381e438992f7975584d98385f0061778d56a67
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17022: corrected full source clear, no findings. Sole parent delta prearms expiry fixture release/holder join and any client close before setup awaits; normal finally reuses it,500ms/named-refusal assertions unchanged. A-17020 rule12 blocker resolved. Product/relaunch source byte-unchanged; capped30s acquisition uses existing backoff, separate native ownership timer, unchanged hook lease rejection/upload behavior and native-close/release fence. Targeted affected file12/12 on Mac and Linux--init inspected; no threshold hit. A-17018 Mac10×3 sampled-load/controller native codes and Linux5×3/rawEXIT0 named outcomes checked. A-17019 original drivers/burner joins/source digests inspected; no PID1 inspection or missing signal/PID/containerhash fields invented. C1 deterministic prior receive-release trace names that reproduction, not historical holder. C1–C3 remain unverified until exact-head configured result/final evidence; prior77e4 load proof retains product/relaunch equivalence labels. Diff check clean. Source permits mode-free verify at unchangedaf381. No Reviewer execution; full after-stageQA separate.

### impl-1702 · 2026-11-06T04:39:07.191Z

Exact reviewed head af381e438 verification b00375c0 passed5179/5179,0fail/cancel/skip; A-17023. T0,T1,all fallbackT2,changedT3(12identities) andWeb completed on Linuxx64 droplet Node24.21.0, Chrome Headless Shell156.0.8078.4. Production tree90b71183a2dba88e3e8c4f55c2ef45724e418f1a. Both exact new C2 records outcome pass(0.484760659s/0.646194249s); duration-check added wall9.695s excluding machine wait. WiderT3 deferred to batch/integrated; noT4 or after-stageQA claim. Duration/budget/ratchet findings report-only. Source remains clean/unchanged; Reviewer owns final settlement.

### rev-35 · 2026-11-06T04:40:29.261Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1702-final-1
commit: af381e438992f7975584d98385f0061778d56a67
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17024: final same-head clear, C1–C3 verified. C1 loaded deterministic receive-release trace/A17017 names prior receive-pack tail in that reproduction, not historical failed holder. C2 both exact success-after-release and bounded-refusal named passes0.484760659/0.646194249 in A17023, allow-list12/12, corrected prearmed holder/client cleanup and all lease/native-close/failure fences inspected. C3 independently parsed10eligible Mac×3 at observed sampled load12.0908–19.5771 and5Linux--init×3, exact native code0 receipts; relaunch files unedited. Historical77e4 loaded proof/source hashes carry through sole af381 fixture correction with explicit noPID1/signal/PID/containerhash/continuous-load claims. A17018 preservation143/143+5pushfiles×4/4 checked; A17019 originaldrivers/burner joins/outer receipts qualified. Exact-head b00375c0/A17023 exit0,5179hub passes/zero fail/cancel/skip, T0/T1/allT2/changedT3onefile12once/Web green; branch/executiontree independently match. RemainingT3 deferred/noT4 claim; report-only budgets/ratchet not failures. Prior stage/batch reds retained; landing and fresh stage cover/fullQA separate. No findings or Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-1702 · 2026-11-06T05:22:21.868Z

Merge batch f50f49c2 run927d727f failed and dropped item; A-17026. Actual host-clone-integration failure at79: expected[] vs worktreeRemove agent request timed out; outcome unknown(T-1). Actual opencode-adapter pending-permission/form failure: database is not open, ERR_INVALID_STATE, ProcessTable.bySessionId -> Sessions.#turnFailed -> opencode.ts595. T0/T1 passed, T3 failed, overall interrupted/partial; not a full pass. No causal classification yet. Reported to lead T-1702 for shared-defect/recovery ownership; holding diagnosis/reruns. Source remains clean af381e438, previously reviewed+verified tree unchanged.

### hub · 2026-11-06T05:22:43.525Z

Merge-delta assessment (report-only)
{"reviewed":"af381e438992f7975584d98385f0061778d56a67","head":"eafe6845b146d6cfb9b62e32b260d21008c2723c","dev":"4df6c1add492a457fd7072c6843fe134e0bd00ad","mergeBase":"72ba2260e5a50c1a279726fa766adb898ee43e64","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1702-receive-lock-wait.md",".agents/skills/implement/SKILL.md","docs/adr/0004-agents-work-on-a-local-git-territory.md","docs/agents/tests/hub-test-host-allow-list.test.ts.md","docs/hub/cland-init-and-cland-update.md","docs/hub/declining-an-accepted-verifier-request-t-1494.md","hub/README.md","hub/src/host/git-daemon.ts","hub/src/territory.ts","hub/test/host-allow-list.test.ts","qa/briefs/E-1532-stage-2.md"],"devPaths":[".cland/tasks/E-1532-the-ssh-transport-the-host-agent-and-git.md",".cland/tasks/T-1702-relaunch-test-push-refused-by-a-held.md"],"overlap":[],"dependency":{"status":"unknown","reason":"import graph incomplete or budget exceeded"},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1702 · 2026-11-06T05:28:54.744Z

Expanded Rule20 sweep before phase change: host/task-worktrees.ts add/prune/relaunch and hub/worktrees.ts admitRelaunch consume phase adding/ready; migrate to reject removing. HostWorktreeRecord persisted by Store.saveHostWorktree/hostWorktrees as JSON(no schema), retained in relaunch-state intent/completion and Sessions snapshot equality; additive removing/removal metadata retained. host/flush.ts already refuses every non-ready phase; dispatch.#flushHostItem final owner check must also compare phase/snapshot after async flush. Hub worktrees listing projects fields and will retain removing rows for recovery; no UI wire shape changes. Tests: host-clone-integration unchangedassertion; worktree-host new deterministic cycle cases; host-relaunch/component/retry/native/publication and host-flush tests plus all fixture record readers inspected. QA stage2/stage6 and docs host-agent/ssh-host/implement reference atomic operations; update phase/lock ordering. Direct native local territory add/remove use local Host (no ref-watch push drain), unchanged; merge afterMerge/prune is outside merge lock, batch revoke/read critical sections perform no Host joins, lease grant/revoke/transfer mutate only local list. Add/relaunch currently wait on Host.worktreeAdd registration behind the shared agent watch serial queue: new deterministic cases both red before fix; these will move Host calls outside locked preparation/finalization too. No agent protocol/capability change is needed.

### impl-1702 · 2026-11-06T06:03:28.860Z

Audit correction at9ffa768e4: final Mac clone proof was4/5, not5/5. Repetition2 failed line79 with another territory operation holds the lock(pid6328), not the earlier agent timeout. All raw per-child outcomes now checked; only that green-count claim was wrong. Prior preliminary clone5/5, C3Mac10/Linux5, Linuxclone5, push5, preservation111/139 and older archived proofs retain their stated counts. Repeat drivers now propagate child failures/signals to outer1, retain pid/code/signal receipts, redact as written and refuse output overwrite. Deliberate child1/outer1 positive control passed. New real-receive/preflight regression was red: native receive acquired at1793944717254; prune attempted wait0 at7276; receive released7279; prune refused. It is green with existing32s shared checkpoint backoff. All checkpoint preflights/finalization use that bound; already-held caller refuses host-worktree-lock-order before state/Host calls. New nested caller tests preserve outer owner. T0 and worktree-host27/27 green; temporary tracing removed. Existing clone assertion unchanged.

### impl-1702 · 2026-11-06T06:14:29.523Z

Final Rule20 sweep repeated across all hub/src, hub/test(alltiers), web/src+test, nvim, shared, docs, QA and shipped skills using HostWorktreeRecord/hostWorktrees/host_worktrees, phase adding/ready, worktreeRemove/flushBranch and refusal texts; raw matches retained for review. Migrated task-worktrees add/prune/relaunch, hub/worktrees admitRelaunch and dispatch post-flush snapshot check. Store JSON reader/writer retains additive removing/removal fields; relaunch-state intent/completion preserves records; flushHostBranch generic non-ready rejection already covers removing; worktree listing projects no phase onto unchanged wire. Tests consuming records: host-relaunch(component/retry/publication/native/plain), host-clone-integration, worktree-host; legacy no-phase shape remains in new prune fixture. QA stage4 describes grant under lock and additive table, not a whole-Host critical section, so unaffected; stage2 receive expectations already migrated; stage6/host docs/implement updated. T1698 consumer evidence is historical. No startup probe, raw socket/list parser or T4 record reader assumes only two phases. No new agent capability or wire shape. host-prune-changed and host-worktree-lock-order are textual internal refusal outcomes consumed by existing generic error reporting; no old-field removal. Local territory Host path stays locked because it has no agent push join; merge cleanup already follows lock release, batch pinning and lease functions await only local operations.

### impl-1702 · 2026-11-06T06:44:41.168Z

Final new-design proof A-17033 at2df586eb547e86c73ef69e5699a53cc82ab5cb47/tree960dcbed1dc41bf032ca7ee6cde6c16b97e065b0:10qualified Mac producers each9/9 cover unchanged clone+bothrelaunch files, load12.004-17.456; native code0/signalnull perproducer.2green floor exclusions+1green help-HEAD source exclusion preserved/replaced. Linux--init clone5x6/6,relaunch5x3/3,guards39/39; all11closes0/null with PID1 and selected source hashes. Macpreservation143/143,push5x4/4; T0three native closes0/null,lint0refusals. All12new-case generated names/samples checked below3sMac/4sLinux thresholds. A-17032 preserves corrected9ffa4/5claim and admitted receive/preflight red+green; A-17030 prior baseline comparison/cycle reds. All writers/burners reaped before Docker/export; preservation lock owner-checked/released. Full source review requested for entire redesign per Coordinator, not delta; verify pending source clear. No per-item QA; stagefullQA separate.

### rev-35 · 2026-11-06T06:52:41.588Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1702-source-3
commit: 2df586eb547e86c73ef69e5699a53cc82ab5cb47
scope: full
findings: [{"severity":"high","text":"Final prune validate reads closed/#launching before awaited host.occupants; Tracker.edit may reopen during that await and no final read follows. task-worktrees94–98 also checks row/tip/leases before checkHost/validate awaits, then revokes/deletes. No owner fences this interval; refresh final eligibility/ownership after asynchronous observations before irreversible deletion admission, with held-occupants/reopen coverage.","file":"hub/src/hub/worktrees.ts","line":455},{"severity":"medium","text":"Public admitRelaunch still acquires with default wait0 before the phased helper, so legitimate receive contention can still refuse cross-host resume immediately. It bypasses the shared unlocked-caller policy and reads eligibility before acquisition. Migrate this admission checkpoint to shared bounded32s/unlocked policy and refresh eligibility after acquisition; preserve nested ownership.","file":"hub/src/hub/worktrees.ts","line":139},{"severity":"medium","text":"WORKTREE_USAGE changes but independent fixtures/cli-usage/commands.json block remains unchanged. frozenUsage maps WORKTREE_USAGE directly to that block and cli-usage-compatibility deep-compares exports. Static byte comparison confirms mismatch; migrate frozen/composed expected help consumers while preserving full assertions.","file":"hub/src/cli/usage/worktree.ts","line":2}]
finding_counts: {"high":1,"medium":2,"low":0}

A-17034: full checkpoint redesign not clear. Three confirmed gaps: stale final prune eligibility/ownership after awaited Host validation; public admitRelaunch still immediate wait0/no shared unlocked policy/eligibility refreshed only before wait; changed WORKTREE_USAGE not migrated in independent frozen help reference. Implementer confirmed all three have no external owner/approved exception and belong in correction. Existing phased helper split addresses observed lock cycle but cannot establish final safety or complete wait policy yet. No criteria newly verified, no new runtime failure fabricated; prior af381 marks/evidence remain historical/stale. A17030 baseline/task reds, A17032 corrected4/5 and failing-driver controls, A17033 selected/excluded target proofs retained for final audit after source fixes. Full source review required on corrected pushed pin before configured verify; no Reviewer execution.

### impl-1702 · 2026-11-06T07:11:06.800Z

A-17034 consumer follow-up: searched pruneHostTaskWorktree/admitRelaunch/withHostWorktreeCheckpoint and WORKTREE_USAGE across production, all test tiers, docs, skills and QA. The sole production prune validator is TaskWorktrees.prune; it now returns a synchronous freshness guard checked after awaited Host/Git/lease observations. Direct native fixtures keep void validators (compatible extended return). Sessions resume is the sole production admitRelaunch caller and now inherits the shared bounded/unlocked policy; no wire shape changed. WORKTREE_USAGE production exports, CLI and composed help consume one block; updated only its owning independent commands.json row, preserved exports.json map/help.txt placeholders and full deep-equal assertions. Added held-final-observation reopen/replacement and real receive/public-admission regressions red before fix. Matching hub/agent/skill references updated.

### impl-1702 · 2026-11-06T07:34:36.057Z

Final corrected runtime proof A-17036 at5dcd649e: loadedMac10/10 wholefile clone+bothrelaunch cohorts each9/9, load12.005371–18.562988, nofailures/exclusions; Linuxarm64--init clone5x6/6,relaunch5x3/3,guards44/44. RequiredMacpreservation277/277,push5x4/4; all nativeproducers0/null and39burnersjoined beforeDocker. A-17035 sourcefinding reds/greens. Finalreview headbe927615ae8af68755141f6bb3101c98885ee5d1 differs only durations.json21insertions under Coordinator carry decision103d2847/rule7; allproduction/testbytes unchanged. Three measured6second allowances,C-216/2026-11-11. A-17037 freshfinalheadT0all0/null,parser23/23,productionchecker14samples/reportmode,positivecontrolrefusal. Fullsource review requested; configuredverify notyetrun. Lockownerchecked/released; claimretained.

### rev-35 · 2026-11-06T07:39:50.900Z

verdict: review
result: not clear
by: rev-35 [reviewer]
run: rev-35-1702-source-4
commit: be927615ae8af68755141f6bb3101c98885ee5d1
scope: full
findings: [{"severity":"medium","text":"New admitted-receive fixtures own only socket/daemon closure, not the in-flight public admitRelaunch or prune-preflight checkpoint promises. Resources cleanup can release the receive, then beforeDirectories closes Tracker/Store while the backoff contender continues. Prearm pending operation ownership, release/join receive then join the flight before storage/root cleanup; ordinary test-body await is not cancellation cleanup. Confirmed no separate serial drain.","file":"hub/test/worktree-host.test.ts","line":494}]
finding_counts: {"high":0,"medium":1,"low":0}

A-17038: full corrected-design source not clear, sole medium fixture ownership gap: public admission/preflight checkpoint flights are not prearmed/joined before Tracker/Store/root cleanup after their receive is released. Implementer confirms no external owner. A17034 product final-eligibility and admission-policy corrections plus frozen help migration are all inspected/resolved; no remaining product-source findings. Shared32s/unlocked checkpoint, synchronous final guard, phased Host joins and original native fence inspected; diffcheck clean. Allowance-only be927/5dcd diff and8runtime/test hashes match, Coordinator103d2847 carry directly inspected. Targeted runtime/T0/parser proofs remain actual5dcd/be927 histories; no new criterion verification or runtime failure fabricated. Fix fixture owner and request fresh full pin before configured verify. No extra loaded/provenance rerun requested solely by this finding; scope/validation belongs to lead/Coordinator. No Reviewer execution.

### impl-1702 · 2026-11-06T07:43:29.302Z

A-17038 sole fixture-owner gap fixed at355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f: prearmed pending joins after receive release/nativejoin and before Tracker/Store/rootclose, assertions unchanged. A-17039 exacthead worktree-host32/32 Macarm64 andLinuxarm64--init, allnativeclose0/null and8matchedhashes; freshT0all0/null,122report-onlylintfindings/0refusals. Diffbe927: one testfile9insertions/5deletions; no product/metadata change. Coordinator376634e9 carries unchanged A-17036 matrix/otherpreservation and A-17037; changedfileproofreplaced withfreshruns. Fullsource review requested at355e4540; configuredverify awaits sourceclear. Preservationownerchecked/released.

### rev-35 · 2026-11-06T07:45:36.472Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1702-source-5
commit: 355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17040: full source clear, no findings. A17038 fixture blocker resolved: receive resource closure precedes prearmed pending checkpoint joins, then storage/root cleanup; complete assertions unchanged. A17034 final fresh prune/synchronous eligibility, shared public admission32s/unlocked/fresh view and frozen help fixes intact. Entire receive30s/phased adding/removing design, exact row/tip/lease checks, no locked Host joins, native-close fence, consumers/docs/skill/QA reviewed. Only worktree-host cleanup9+/5- differs frombe927; product/clone/relaunch/durations unchanged; diffcheck clean. Exact-head changed-file32/32 Mac+Linux--init/rawproducer0/null/PID1 and T0 inspected. Coordinator376634e9 direct history carries A17036 unchanged matrix/preservation with fresh changed-file replacement; parser/replayA17037 keeps be927 provenance. Three6s allowances sufficient; no refresh needed on current samples. C1–C3 remain unverified pending exact-head configured result/final evidence. Submit mode-free verify at unchanged355e; changed head needs review. Historical reds/count corrections retained; no Reviewer execution; after-stageQA separate.

### rev-35 · 2026-11-06T08:11:29.026Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1702-final-2
commit: 355e4540c6ea38e0ee6c087bc0f5f08b4fa4eb4f
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17042: final checkpoint-design clear; C1–C3 verified. Exact-head657133bf/A17041 exit0,5211hub passes/zero fail/cancel/skip; T0/T1/allT2/changedT3twofiles36top-level identities once/Web green; branch/executiontree independently match. Both receive cases pass0.531065419/0.611972433s, all17new checkpoint/receive identities and complete frozen help check pass. C1 deterministic receive-release/lock-cycle/preflight reds retain historical attribution limits A17017/30/32. C3 A17036 independently parsed10Mac9/9 at sampled12.005–18.563 and Linux5clone6/6+5relaunch3/3+44guards with native0/null/PID1;39burners joined beforeDocker. Explicit Coordinator103d2847/376634e9 carry preserves5dcd runtime provenance through allowance/test-cleanup heads; A17039 fresh355e changed-file32/32 eachplatform+T0 replaces its prior proof. Preservation277/277 and5pushfiles×4/4 checked; source/hashes/driver failure controls and earlier9ffa4/5 correction retained. Three6s caps sufficient; parser/replayA17037 remains be927/reportmode. Prioraf381 final and redbatches/stages historical. WiderT3/T4/landing and fresh stagepair/fullQA separate. No findings or Reviewer execution.

Criteria: C1 verified, C2 verified, C3 verified.

### coord · 2026-11-06T08:11:38.490Z

Evidence carry (coord, decisions 103d2847 and 376634e9): the runtime matrix A-17036 at 5dcd649e covers loaded macOS 10/10 (clone and both relaunch files, load 12.0–18.6), Linux `--init` 5/5, preservation 277/277 and push-on-ref-move 5×4/4. It carries to be927615, which changes only durations.json (three allowances of 6 s, C-216, expiring 2026-11-11), and then to 355e4540, which changes only the cleanup ownership in worktree-host.test.ts. `git diff --stat 5dcd649e..355e4540` shows only those two files. The changed file got fresh per-child proof at 355e4540 (32/32 on macOS and on Linux `--init`) plus T0. The full source review is clear at 355e4540, and verify 657133bf (A-17041) passed at the same head. All three criteria are verified.

### coord · 2026-11-06T08:59:14.596Z

Merged 44c55e4a6b9f51abf9c8368f9899ffc51c4f4efe onto dev.
