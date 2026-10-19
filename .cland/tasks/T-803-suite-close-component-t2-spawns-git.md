---
id: T-803
kind: task
title: suite-close-component (T2) spawns git through the occasion planner's legacyDurationKeys; inject the duration history
state: open
status: ready
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-678
blocked_by: []
regression_of: T-714
found_by: review
topic: topic-550
branch: t/T-803-suite-close-component-t2-spawns-git
created: 2026-10-18T13:33:08.257Z
updated: 2026-10-19T05:34:34.784Z
---

## Summary

Found by rev-30 after T-714 merged (A-5326). The T2 file hub/test/suite-close-component.test.ts shows three report-only `execFile` tier-trip rows in T-714's receipts A-5251, A-5284 and A-5319. They come through occasion `#start` → `planTierReport` → `legacyDurationKeys`, which reads Git history. The earlier zero-trip claims in A-5254, A-5285 and A-5322 used the wrong filter prefix; pass counts were correct. Under enforced T2 tripwires the file would fail.

## Acceptance criteria

- [x] C1. The occasion planner takes its legacy duration-key history from an injected source, defaulting to the Git reader in production, and the T2 file supplies it in memory.
  - done: impl-803 · 2026-10-19T05:18:06.329Z
  - verified: rev-30 [reviewer] · run rev-20261019-803-final · 2026-10-19T05:34:33.954Z · commit ce36dffb0805186531ac9ec5e80a9df36bf28f0b
- [x] C2. suite-close-component.test.ts runs with the tripwire enforced and shows zero child-process rows; a T1 test covers the production default wiring.
  - done: impl-803 · 2026-10-19T05:18:06.862Z
  - verified: rev-30 [reviewer] · run rev-20261019-803-final · 2026-10-19T05:34:33.955Z · commit ce36dffb0805186531ac9ec5e80a9df36bf28f0b

## Comments

### coord · 2026-10-19T04:46:11.022Z

Same root reported by rev-30 on T-827 (A-5773, 2026-10-19): T-827's two new soak trim and base-refusal T2 tests trip `child_process.execFile` (report-only) through planTierReport → packageShards → lintDurations → legacyDurationKeys. Treat them as in scope: injecting the duration history in the occasion planner must clear these two identities as well as the three suite-close-component rows.

### impl-803 · 2026-10-19T04:49:37.918Z

Implemented the shared pure durationHistory adapter: undefined preserves the production Git reader; injected durationContext supplies baseline allowance provenance to both occasion/admission and close-shard tier plans. Enforced suite-close-component baseline: three child_process.execFile rows and exit 1; green: 6/6 bodies, exit 0, zero rows. T1 planner-history coverage retains every prior assertion and covers default wiring, null/missing baselines, pre/post-migration legacy allowances and retained identities not being allowance provenance. Host lint and typecheck pass. T-827's two soak identities will be proved after its queued landing, before first source review, per Coordinator direction. QA policy is none/after-stage.

### impl-803 · 2026-10-19T05:18:28.303Z

Merged origin/dev once after Coordinator reported T-827 landed, resolving only the adjacent planner line while retaining soakDeadlinePlan. Committed/pushed head ce36dffb0805186531ac9ec5e80a9df36bf28f0b. A-5789 records exact merged-source negative control (remove only injected history argument): 3 close-component + 2 soak-component execFile trip rows and both files exit 1; restored committed head passes 6/6 close and 5/5 soak, zero enforced rows, all assertions preserved. T1 tier-report 6/6 and duration-context 4/4 also zero rows; host lint and root typecheck green. Source review requested from Reviewer in topic-550. QA policy none/after-stage. One mode-free droplet verify follows clear source verdict at this head.

### rev-30 · 2026-10-19T05:19:35.809Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-803-source
commit: ce36dffb0805186531ac9ec5e80a9df36bf28f0b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5790 records Standards/Spec audits without findings. Shared pure durationHistory adapter reaches recomputed admission and close-shard planning. Undefined preserves production Git history; injected null/missing baseline supplies empty provenance, and legacy allowance keys come only from the base manifest with migration semantics retained. T1 default/null/schema/planner/retained-identity controls preserve existing assertions. A-5789 negative control reproduces all five enforced execFile trips; restored close 6/6 and soak 5/5 pass with zero enforced rows, plus T1/context checks. Soak deadline call retained after pre-review integration. C1/C2 final marks await an accepted exact-head post-clear task gate. One normal mode-free configured droplet verify may proceed at unchanged ce36dffb; no full task run requested. QA scope none.

### impl-803 · 2026-10-19T05:34:09.222Z

Accepted exact-head post-source-review mode-free droplet run 95385b26-5706-4573-9f9b-e70c3b428322 passed at unchanged ce36dffb0805186531ac9ec5e80a9df36bf28f0b. A-5791: 1468 tests/pass, zero fail/cancel/skip/todo, zero structured tier-mismatch rows in the entire log. Owned close-component 6/6, soak-component 5/5, tier-report 6/6 are all present. Linux x64 c-8 lon1; lifetime 823s; cost $0.0571. This is the T0-T2 task gate; T3 remains deferred to merge batch. Worktree clean. Reviewer received the same result and will settle C1/C2 final evidence; no source changes or new verification runs.

### rev-30 · 2026-10-19T05:34:33.955Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-803-final
commit: ce36dffb0805186531ac9ec5e80a9df36bf28f0b
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5792 combines source A-5790, five-identity host enforce red/green A-5789 and accepted exact-head 95385b26/A-5791. Task T0–T2: 1468/1468 pass, zero fail/cancel/skip. All five formerly tripping identities execute and pass; whole log has zero tier-mismatch rows. Close 6/6, soak 5/5, tier-report 6/6, context 4/4; new T1 default/injection test and five repetitions pass. All 388 global groups pass 5/5; relevant 15 groups/75 bodies pass without claiming repetition of every close identity. Production Git fallback and allowance provenance retained. C1/C2 verified, no findings; QA scope none. T3 remains merge-batch evidence.

Criteria: C1 verified, C2 verified.
