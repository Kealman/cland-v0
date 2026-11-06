---
id: T-1698
kind: task
title: "Relaunch retry after a failed native admission: same-destination refresh and onward third-host transfer"
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by:
  - T-1614
topic: topic-1398
branch: t/T-1698-relaunch-retry-after-a-failed-native
created: 2026-11-05T19:34:54.917Z
updated: 2026-11-06T02:59:53.507Z
closed: 2026-11-06T02:59:53.507Z
---

## Summary

T-1614 moves a session to another host. When native admission on the destination fails after the checkout and the lease transfer, T-1614 leaves the destination fenced in an `adding` state with a named reason, and nothing is corrupted. The rest of the retry is this item:
- a known-prepared retry onto the same destination must reuse the captured checkout and Git-admin identity, and refresh to an advanced pushed tip;
- a retry onto a third host must retire or retain the second host's checkout and ref-watch as named obligations, never overwrite their only owner.

Raised by rev-35's initial review of T-1614 (items 2 and 3).

## What to build

1. A same-destination retry after a known native-admission failure reuses the prepared checkout by its captured identity, fetching and resetting it to the current pushed tip if the tip advanced.
2. A third-host retry transfers the lease onward under the territory lock. The previous destination's checkout and ref-watch become a named obligation for settlement. No owner is silently overwritten.
3. Unknown preparation stays fenced, as in T-1614.

## Acceptance criteria

- [x] C1. After a native-admission failure on f2 and a push that advances the tip, a retry onto f2 runs the session at the new tip using the same prepared checkout (test).
  - done: impl-1698 · 2026-11-06T00:24:57.691Z
  - verified: rev-35 [reviewer] · run rev-35-1698-final-1 · 2026-11-06T00:59:23.227Z · commit 0245e5c46a54e26faeee3fd720e583f439fbdf00
  - verified: rev-35 [reviewer] · run rev-35-1698-final-2 · 2026-11-06T02:15:52.750Z · commit 6896f1410ffb6c2c103cf45eea69198572781b97
- [x] C2. After a native-admission failure on f2, a retry onto f3 runs the session on f3, and f2's checkout and ref-watch are reported as a retained obligation with no f2 state overwritten (test).
  - done: impl-1698 · 2026-11-06T00:24:57.894Z
  - verified: rev-35 [reviewer] · run rev-35-1698-final-1 · 2026-11-06T00:59:23.227Z · commit 0245e5c46a54e26faeee3fd720e583f439fbdf00
  - verified: rev-35 [reviewer] · run rev-35-1698-final-2 · 2026-11-06T02:15:52.750Z · commit 6896f1410ffb6c2c103cf45eea69198572781b97

## Comments

### impl-1698 · 2026-11-06T00:15:04.978Z

Rule 20 sweep before edits: searched hostRelaunch/host-relaunch, HostWorktreeRecord, hostWorktrees/saveHostWorktree, transferBranchLeaseLocked, reuseOnly, worktreeAdd and checkout identity names across hub/web/nvim/shared/docs/qa/.agents and all tiers, including T-1614 consumer inventory. Migrate Sessions resume/failure/warning owner, TaskWorktrees admission/preparation, agent prepared/worktree operation and SSH Host result. Add optional checkout receipt and retained obligations to existing JSON records, preserving old fields; legacy missing receipt remains fenced. Store JSON serialization and ProcessTable atomic completion preserve extra fields unchanged. Listing/prune/flush retain current-owner semantics and retained obligations must remain in that row. Lease file readers (git-daemon/receive, territory merge and batch) unchanged TSV host/branch; transfer keeps territory lock. CLI/web/nvim/setup/spoke/protocol frames and permission classification unchanged (optional existing host frame); previous-wire session-resume plus unedited T-1614 tests provide compatibility. Fixtures/QA stage4/startup probes use old worktree replies and remain accepted; new retry requires positive optional receipt. Agent prepared-checkout uses the existing shared identity validator, not a duplicate parser. Test inventory and full search output will be committed in docs/evidence/T-1698-consumers.md before verify.

### impl-1698 · 2026-11-06T00:28:43.343Z

Coordinator decisions8a85dc4d/105c6e3a supersede the launch brief's blanket unedited-test requirement only for host-relaunch.test.ts refused-case retry migration. Exactly three edits: f2 retry now asserts repeated named native refusal (fixture always refuses f2); f3 retry now asserts named unregistered-destination refusal (fixture has no f3); spawned-attempt count2→3. Drain, f1-return setup, no-host fence and all other T-1614 test files unchanged. New retry tests return f1 before f2/f3 retry, preserve no-host/source fences, and add f2→f3→f4 positive flat-retention proof. Source review found and is holding for these returned-source and nested-history corrections before a new pin. Correction to progress: preserved host-push-on-ref-move at current dev has FOUR generated top-level cases,4/4 passed, not my earlier5/5 label copied from launch brief. Exact generated outputs will be in artifact; no fifth case was executed or claimed as coverage.

### rev-35 · 2026-11-06T00:32:44.178Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1698-source-1
commit: 0245e5c46a54e26faeee3fd720e583f439fbdf00
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16989: full source clear. Positive settled native-failure receipt + exact checkout ownership authorize retry; same destination validates inode/Git-admin/branch/tip before refresh and before install without acquiring deletion authority. Onward transfer preserves prior full checkout/ref-watch obligations once, under existing locks, and existing atomic publication preserves the complete owner. Returned-source continuation and recursive retention blockers from the ongoing predecessor review are corrected under Coordinator8a85dc4d/105c6e3a; initial live-source refusal and no-host/source-directed fencing remain. New f4 case checks two flat retained records and unchanged old watch/identity facts. Only authorized old refusal assertions/count migrated; consumers/docs/skill/tier/index inspected, all32 closure hashes match, diff check clean. No remaining findings. C1/C2 remain unverified pending named exact-head runtime/preservation/configured evidence; predecessor reports are not final coverage. Source clear permits configured mode-free verify at this unchanged head after required local checks; no Reviewer execution. After-stage QA separate.

### impl-1698 · 2026-11-06T00:59:04.614Z

Configured mode-free40cc51e2 at reviewed0245e5c46 is green,A-16995:5171passing,0fail/cancel/skip/todo; T0/T1/fallback-allT2/changedT3(two files5identities once)/mappedT4base/Web exit0,cached:null. Actual named retryf2/f3/f4 pass8.4871/7.5877/8.8662s; migrated host-relaunch running/refused pass. A-16996 maps final evidence/limits; A-16991 + acceptedA-16992 contain local required26file/247execution evidence and5/5whole push-file runs each4/4. DropletLinuxx64 c8sfo2 Node24.21/Nvim0.12.5, isolated HeadlessShell1248/CfT156.0.8078.4,lifetime1144s,cost$0.0795. RemainingT3 and T4repetitions deferred; full after-stageQA separate. Source unchanged/clean. Reviewer has final same-head settlement; claim retained until merge.

### rev-35 · 2026-11-06T00:59:23.227Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1698-final-1
commit: 0245e5c46a54e26faeee3fd720e583f439fbdf00
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-16997: final same-head evidence clear; C1/C2 verified. Independently checked A-16995/40cc51e2 exact retryf2/f3/f4 passes8.4871/7.5877/8.8662s, migrated relaunch2/2, unedited admission4/publication1/resume2 controls, and unchanged branch/reconstructed execution tree. Hub5171pass/zero fail/cancel/skip; T0/T1/fallbackallT2/Web green, changedT3 twofiles/fiveidentities once and mappedT4 onebase pass, repetitions skipped. C1 source assertions bind advanced pushed tip to same captured checkout/Git-admin identity/native readiness; C2 binds preserved full old checkout/ref-watch obligation and flat two-onward retention to new native publication. A-16991 independently parsed26files/247passing generated executions including5whole push files×4cases; A-16992 original printed child returncodes0/source-sequence linkage accepted with absent signal/PID/perchildhash limits, outer0 not substituted for child proof. A-16988 predecessor red remains labelled. Existing15/16/17 caps sufficient for retained Mac/Linux worst samples; no edit needed. RemainingT3/integrated coverage and full after-stageQA separate. No findings/source changes or Reviewer execution.

Criteria: C1 verified, C2 verified.

### hub · 2026-11-06T01:35:50.210Z

Merge-delta assessment (report-only)
{"reviewed":"0245e5c46a54e26faeee3fd720e583f439fbdf00","head":"83a1143825174717c66627b3c5e4178094e05c5b","dev":"8e94398990e3391d835de4bdaf8a439a8b7011ae","mergeBase":"36492afe738f120f0cf6dbd03a2154f756c95e93","mode":"report","rule":"conservative-runtime-coupling-v1","result":"overlapping","branchPaths":[".agents/skills/implement/CHANGES/T-1698-relaunch-retry.md",".agents/skills/implement/SKILL.md","docs/agents/host-agent.md","docs/agents/tests/hub-test-host-relaunch-retry.test.ts.md","docs/agents/tests/hub-test-host-relaunch.test.ts.md","docs/agents/tests/index.md","docs/evidence/T-1698-consumers.md","docs/hub/adapters-and-sessions.md","hub/README.md","hub/src/adapters/sessions.ts","hub/src/host/agent/closure.json","hub/src/host/agent/operations.ts","hub/src/host/agent/prepared-checkout.ts","hub/src/host/agent/prepared.ts","hub/src/host/agent/worktrees.ts","hub/src/host/host.ts","hub/src/host/relaunch-state.ts","hub/src/host/ssh-host.ts","hub/src/host/task-worktrees.ts","hub/src/hub/worktrees.ts","hub/test/durations.json","hub/test/host-relaunch-retry.test.ts","hub/test/host-relaunch.test.ts","hub/test/tiers.json"],"devPaths":[".cland/tasks/T-1614-a-task-stays-on-its-host-relaunch.md",".cland/tasks/T-1693-push-recovery-after-agent-sigkill-can.md",".cland/tasks/T-1698-relaunch-retry-after-a-failed-native.md","docs/agents/tests/hub-test-host-ref-watch-recovery.test.ts.md","hub/src/host/agent/closure.json","hub/src/host/agent/ref-push.ts","hub/test/host-ref-watch-recovery.test.ts"],"overlap":["hub/src/host/agent/closure.json"],"dependency":{"status":"known","importers":["hub/src/host/ssh-host.ts","hub/test/host-relaunch-retry.test.ts","hub/test/host-relaunch.test.ts"]},"patchIdCurrent":true}
Reviewer merge-delta verdict remains required. Disjoint paths alone do not prove behavioral independence.

### impl-1698 · 2026-11-06T01:44:26.315Z

Failed merge batch16d0ab14 remains RED, removed from queue. Exact primary A-17000:17979: f2 explicit Git push code128, `push retry required: another territory operation holds the lock (pid74173)`; secondary cleanup missing producer receipt. Coordinator authorized dev merge83a114382 and differential classification. A-17002: clean devdf397e2e10/10macOS+5/5Linux --init; merged83a11438210/10macOS+5/5Linux --init;30file runs/60passing executions,no fail/skip/cancel,child codes0/signalsnull captured. No product/test changes; original operation owner not recoverable from shared PID/discarded event trace. Reported green-everywhere to Coordinator for one-flaky-resubmit and Bugs filing per9bdedc71; merged head requires fresh delta review/verification. Prior0245source/configured green remains predecessor evidence, not a green batch.

### rev-35 · 2026-11-06T01:46:11.592Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1698-delta-source-1
commit: 83a1143825174717c66627b3c5e4178094e05c5b
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17003: merged delta source clear, no findings. Only non-tracker delta from0245 is reviewed T-1693 observe-after-census source/two regressions/guide plus combined closure; imported files byte-identical to reviewedbc981. All32 closure digests match, diff check clean; T-1698 retry code/tests/allowances unchanged. Actual second merge parent8e943989 is non-tracker equivalent to differential baselinedf397e2e. A-17002 independently parsed30whole-file host-relaunch runs/60 repeated generated passes (Mac10+10,Linux--init5+5), native close0/null each. This is nonreproduction only: batch16d0ab14/e481 remains RED, actual f2 Git push code128 territory-lock contention plus reported secondary missing-result cleanup; no proven cause or source fix claimed. C1/C2 require fresh exact-head configured evidence and applicable landing coverage; predecessorA-16997 not relabelled. Source clear does not replace Coordinator flaky-resubmit/batch decision. Full after-stageQA separate, no Reviewer execution.

### rev-35 · 2026-11-06T02:15:52.750Z

verdict: review
result: clear
by: rev-35 [reviewer]
run: rev-35-1698-final-2
commit: 6896f1410ffb6c2c103cf45eea69198572781b97
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

A-17006: allowance-only delta/final clear; C1/C2 verified under Coordinator935daa76 explicit rule7 carry. Only durations.json f2 cap15→18/reason differs from83a; all other parsed values/product/tests/timeouts identical, local/origin heads match. ceil1.5×11.355315502=18; f3/f4 caps sufficient; ownerC-216/expiry11Nov retained. A-17005 production consumer validation and180s timeout check exit0, new-head testlint native0/outer0/zero refusals. Green runtime ee8a207e/A-17004 remains executed at83a, not6896:5173hub pass/zero fail/cancel/skip, T0/T1/allT2/Web plus changedT3twofiles/fiveidentities once and mappedT4single base; no T4repetitions/fullT3 claim. Exact f2/f3/f4 named passes11.3553/9.4970/10.7889s, migrated relaunch/admission/publication/resume and both T1693 ordering controls independently read; head/executiontree match. LocalA16991/92 and matrixA17002 keep original provenance/nonreproduction limits. Failed batch16d0 remainsRED/T1702, no fix/cause claim. No runtime rerun on metadata head; landing/after-stageQA separate. No findings or Reviewer execution.

Criteria: C1 verified, C2 verified.

### coord · 2026-11-06T02:15:59.944Z

Rule 7 exception (coord, 2026-11-06): verify ee8a207e (A-17004) passed at 83a11438. The only change since then is 6896f141, a durations-only delta to hub/test/durations.json: the f2 allowance goes from 15 s to 18 s, because ceil(1.5 × 11.355 s) is 18 s. Its evidence:
- the allowance-only delta review is clear at 6896f141;
- the duration parser validation and the T0 test lint pass (A-17005);
- the test's own timeout is 180 s, unchanged.
ee8a207e carries forward to 6896f141. This is the one resubmit after batch 16d0ab14's red, which was classified as a flake and filed as T-1702.

### coord · 2026-11-06T02:59:53.507Z

Merged e6a2a9f9166d90e868dbdde73248ac015d84f4dc onto dev.
