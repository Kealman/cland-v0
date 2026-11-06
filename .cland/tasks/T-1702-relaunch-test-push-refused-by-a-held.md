---
id: T-1702
kind: task
title: A push to the territory is refused with "push retry required" while another territory operation holds the lock, failing relaunch tests under load
state: open
status: in progress
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
updated: 2026-11-06T05:22:43.525Z
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
  - done: impl-1702 · 2026-11-06T03:59:48.680Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67
- [x] C2. A territory push arriving while the lock is held is admitted once the holder releases within the bound, and refused with the named message after the bound (tests, red before the fix).
  - done: impl-1702 · 2026-11-06T04:14:20.349Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67
- [x] C3. host-relaunch.test.ts and host-relaunch-native.test.ts pass unedited, 10 of 10 on macOS at a one-minute load of 12 or more, and 5 of 5 in a Linux `docker run --init` run (evidence).
  - done: impl-1702 · 2026-11-06T04:08:38.611Z
  - verified: rev-35 [reviewer] · run rev-35-1702-final-1 · 2026-11-06T04:40:29.261Z · commit af381e438992f7975584d98385f0061778d56a67

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
