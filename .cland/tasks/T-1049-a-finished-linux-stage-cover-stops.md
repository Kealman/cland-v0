---
id: T-1049
kind: task
title: A finished Linux stage cover stops counting after a hub restart
state: closed
status: done
size: S
criterion_seq: 2
labels:
  - ready-for-agent
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: topic-799
branch: t/T-1049-a-finished-linux-stage-cover-stops
created: 2026-10-21T12:50:24.466Z
updated: 2026-10-21T14:09:40.389Z
closed: 2026-10-21T14:09:40.389Z
---

## Summary

Linux stage cover bb909399 (droplet, two shards, all exit 0) finished at cb231eeb at 12:33Z on 2026-10-21. With macOS cover b73a6fc9 it made the stage cover complete: that result printed "stage cover complete (Linux droplet, macOS)" at 12:39Z. After hub restart #37 (12:39:51Z, the first restart with T-1039), `task plan show` reports the same tree 820b3207 as "missing Linux droplet" for E-412 stage 3 and E-415 stage 2. The macOS cover still counts. So E-412 stage 3 does not close despite a current clear QA verdict.

## What to build

A Linux droplet cover restored from the suite history after a hub restart still satisfies `stageCovers` (hub/src/hub/suites.ts). Find which of the fields `stageCovers` requires is missing or different on the restored job: `shards` with each shard's outcome and platform, `shardingSkipped`, `occasion`, `platform.os` or `reported`. Restore or persist it. Check whether T-1039's restore change (1fc2aca2: no rewrite of the history per restored process) left the field unsaved.

## Acceptance criteria

- [x] C1. A two-shard Linux droplet stage cover recorded before a hub restart still counts as the stage's Linux cover after the restart (test across a real restart of a projectHub).
  - done: impl-1049 · 2026-10-21T13:24:54.374Z
  - verified: rev-31 [reviewer] · run rev-20261021-1049-final · 2026-10-21T13:34:35.663Z · commit dad349c086f3acb41a00f58b02ac4cc1c6d3af47
- [x] C2. The cause is named in the item topic: the field and the code path.
  - done: impl-1049 · 2026-10-21T13:06:41.863Z
  - verified: rev-31 [reviewer] · run rev-20261021-1049-source-2 · 2026-10-21T13:12:52.285Z · commit 14176bd2b4afbefcfe21d7d3612165a9eba6314f
  - verified: rev-31 [reviewer] · run rev-20261021-1049-merge-source · 2026-10-21T13:25:51.183Z · commit dad349c086f3acb41a00f58b02ac4cc1c6d3af47
  - verified: rev-31 [reviewer] · run rev-20261021-1049-final · 2026-10-21T13:34:35.663Z · commit dad349c086f3acb41a00f58b02ac4cc1c6d3af47

## Comments

### impl-1049 · 2026-10-21T13:01:57.894Z

Diagnosis: this is delayed derived freshness, not lost Linux suite history. A read-only consistent DB backup retains bb909399's reported=true, occasion=stage, full/soak selection, Linux platform and both exit-0 Linux shards. The isolated copied tracker reproduces E-412 stage 3 / E-415 stage 2 missing Linux while E-415's empty stage counts that same cover; all eight relevant landings independently pass native Git ancestry to cb231eeb. Freshness.#work serializes wants; Freshness.#compute -> epicDemoFreshness scans old epic demo history using one diff-tree per intervening commit, ahead of stage ancestor/contains checks. The old Tracker.#stageCover treated undefined answers as ineligible/missing, and #stageCurrent collapsed undefined into false. Scope agreed by Coordinator: distinguish pending covers and unknown verdict currency, keep gates holding; performance starvation is a separate item. Restart regression on the pre-fix source failed exactly with actual ['Linux droplet'] versus expected [] for unknown ancestry. After the fix, that targeted regression passes (one native projectHub restart, local Darwin arm64; not full-suite evidence).

### rev-31 · 2026-10-21T13:10:25.149Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1049-source-1
commit: d578bd28a5daed4eafcb9d84d23c52a7c11a45b1
scope: full
findings: [{"severity":"medium","text":"M1: restart setup asserts closed immediately after QA-write acknowledgement; fixture.land's missing-only wait now also accepts pending covers. Wait with a separate bound for closed/current complete coverage before saving the baseline and restarting, retaining final assertions (rule 9).","file":"hub/test/stage-qa.test.ts","line":17}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8400 records full review. Standards: M1 medium; Spec: no production-path finding under Coordinator scope split. C2 diagnosis established in topic. Original receipts now inspected in corrected A-8401: reviewed-head local macOS T3 restart 1/1 (3.731971041 s), T2 5/5, hub typecheck exit 0; pre-merge/partial evidence explicitly qualified. M1 correction acknowledged by claimant; require new pushed head and fresh source review before verification.

Criteria: C1 failed (New real-restart proof needs a bounded durable baseline closure/current-cover observer before restarting; QA-write acknowledgement and empty missing alone can still leave pending checks.).

### rev-31 · 2026-10-21T13:12:52.285Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1049-source-2
commit: 14176bd2b4afbefcfe21d7d3612165a9eba6314f
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected full source review clear; M1 resolved by bounded exact closed/current complete-cover setup and shared fixture pending rejection, final assertions preserved. A-8406 incorporates original audit A-8400 and inspected retained A-8401/A-8404 source/platform/exit limits. Production unchanged. C2 verified; C1 uses retained native local T3 restart proof but awaits final same-head mode-free receipt. All claimant done marks present; no performance/Linux/full-suite claim or merge enqueue.

Criteria: C2 verified.

### impl-1049 · 2026-10-21T13:19:56.823Z

Verification 81165225-25d6-4234-90b1-5551d770ce82 at source-reviewed head14176bd2 failed on Linux x64 droplet (c-8 lon1, lifetime340s, cost$0.0236), log A-8414. Doctor's two repair tests expected [] but actually returned `warn web bundle: web/dist build stamp missing or invalid — npm run build in the cland installation`; web-auth secret scan failed `ENOENT ... scandir '/home/runner/cland/web/dist/'`. Reported common missing-bundle shared-defect/infrastructure candidate to lead T-1049; holding diagnosis/source changes for Coordinator instructions. T1 exit0; T2 exit1 with all-T2 coverage fallback; Web tests observed unavailable (not green); T3 not selected. Source remains unchanged14176bd2. No pass/readiness claimed.

### rev-31 · 2026-10-21T13:21:55.297Z

verdict: review
result: not clear
by: rev-31 [reviewer]
run: rev-20261021-1049-evidence-1
commit: 14176bd2b4afbefcfe21d7d3612165a9eba6314f
scope: evidence
findings: [{"severity":"medium","text":"M2 shared preparation blocker (T-1031): A-8414 fails two doctor assertions with missing/invalid web/dist stamp and web-auth scandir ENOENT for /home/runner/cland/web/dist. Preserve assertions and await Coordinator's shared fix, fresh source review and replacement gate.","file":"hub/bin/verify-prepare.ts","line":32}]
finding_counts: {"high":0,"medium":1,"low":0}

A-8416 quotes exact failures before diagnosis. Linux droplet run 81165225: host gate/T1 green, interrupted T2 exit 1, ordinary 1963 pass/3 fail plus 15 successful task load repetitions. All three new identities passed 5/5. C2 remains established; C1 final evidence blocked, not disproven behavior. Coordinator decision 8c93f2a9 confirms shared T-1031 and authorizes one merge only after it lands, then delta review and fresh mode-free run. Web/T3/T4 did not execute. The earlier malformed empty failed-list submission was rejected before recording a verdict; this supplies the required nonempty final-evidence note.

Criteria: C1 failed (Final evidence blocked: same-head configured run failed three missing-web/dist prerequisite tests; retained native restart pass does not clear this failed gate. No new stage-logic regression inferred.).

### rev-31 · 2026-10-21T13:25:51.183Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1049-merge-source
commit: dad349c086f3acb41a00f58b02ac4cc1c6d3af47
scope: delta
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Authorized conflict-free shared-fix merge delta clear, A-8421. T-1049 production and corrected tests unchanged; inspected landed T-1031's pre-worker/standalone bundle prerequisite and doctor fixture boundary for failed A-8414. Exact merged-head local targeted T2 5/5, native T3 restart 1/1 and hub typecheck retained in A-8420 with gate/platform limits. C2 reverified; C1 final awaits fresh mode-free same-head receipt. Coordinator owns enqueue/E-412 epic-demo hold. No merge enqueue.

Criteria: C2 verified.

### rev-31 · 2026-10-21T13:34:35.663Z

verdict: review
result: clear
by: rev-31 [reviewer]
run: rev-20261021-1049-final
commit: dad349c086f3acb41a00f58b02ac4cc1c6d3af47
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear C1/C2: A-8425 audits same-head A-8424/e8974efe Linux droplet host-gated T0/T1/full fallback T2/Web success, 2298 ordinary passes plus three distinct 5/5 load groups. Missing-bundle M2 recovered: raw build-before-workers receipt and all three prior failure identities pass. C1 native restart evidence remains exact-head targeted local Darwin T3 A-8420, separate from task gate; C2 named cause established. Both claimant done marks present. Inherited shell Web 6.331s>4s report-only overage separately routed S Follow-ups E-880, not a budget pass. No task T3/T4/performance/stage-QA or merge-enqueue claim.

Criteria: C1 verified, C2 verified.

### coord · 2026-10-21T14:09:40.389Z

Merged 7c153e5105a55029129878b23df408ea6f3d8523 onto dev.
