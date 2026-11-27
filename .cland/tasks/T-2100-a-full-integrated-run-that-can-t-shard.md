---
id: T-2100
kind: task
title: "A full integrated run that can't shard (fewer than 2 remote slots free) no longer fits the 75-minute run timeout: T2 18 min + T3 51 min leaves Web unfinished"
state: open
status: review
size: M
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: topic-1803
branch: t/T-2100-a-full-integrated-run-that-can-t-shard
created: 2026-11-25T03:50:04.390Z
updated: 2026-11-27T05:01:13.845Z
---

## Summary

Two runs on 2026-11-25 ended with exit 143 and "run timeout 75m" while every executed test passed:

- **Periodic dev T3 41f9200a** (A-23237, dev 073a7a2, c-8, 2 workers, unsharded): T0 177 s, T2 1,095 s, T3 3,076 s, Web cut off mid-run. 7,401 tests completed, 0 failed.
- **T-1928's task verify 030d6d25** (A-23146): T1, T2 and T3 passed, Web cut off. It selected full tiers because it changes hub behaviour.

Both ran whole on one droplet. The hub logged "sharding skipped: fewer than 2 remote slots free", because task verifies held the other slots. Sharded runs fit: stage cover edc81817 passed on two shards. T3 alone now projects 1,565 s of wall time at 2 workers against a 900 s budget (report only). T-2099 and T-2098 track the per-file Linux slowdown that feeds this.

Without a change, a release or stage cover that can't get two slots also times out.

## What to build

Let a full occasion run (dev-t3, stage, release, or a task verify selecting full tiers) finish within its limit. Options:
- Wait for two free slots rather than run whole when the projected wall exceeds the run timeout.
- Scale the run timeout to the projected wall.
- Use a larger size for an unsharded full run.

Pick one with the human; the choice affects spend.

## Acceptance criteria

- [x] C1. With fewer than two remote slots free, a full run whose projected wall exceeds the run timeout waits for sharding up to the configured shard wait (default 20 min, the queue wait p90 target), then runs whole on the configured fallback size and workers (default c-16, 4 workers); the log names which path it took and why (test with fake executor slots and a fake clock).
  - done: impl-2100 · 2026-11-27T04:59:02.773Z
- [ ] C2. A full run that cannot shard completes all tiers, Web included, on dev after the change, sharded or on the fallback size, inside the run timeout (evidence).

## Comments

### coord · 2026-11-25T04:44:58.374Z

Third case: T-2013's task verify 7cfc747a (A-23258) at 71ff8ded2 exited 143 after a 4,623 s lifetime, with nvim/test/ui.test.ts in flight. 9,308 tests completed, 0 failed. Its selection fell back to full because the diff touches a test guide under docs/agents/tests/ (rules-batch item de). Unsharded full task verifies are now hitting the limit as well as dev-T3: T-1928 and T-2013 are both held for this decision.

### coord · 2026-11-25T06:11:08.002Z

Fourth case: T-1926's task verify b27c3801 (A-23295) at 9ed6c32f0 exited 143 with "run timeout 75m" after a 4,643 s lifetime. 9,598 tests completed with 0 failures, and Web was still in flight. Three items are now held for this decision with all completed tests green: T-1928, T-2013 and T-1926. Merge-queue batches that got two slots ran sharded and finished well inside the limit (batch 7994f731: 2 shards, 33 min wall). The failures are all unsharded single-slot runs.

### coord · 2026-11-25T07:41:50.364Z

c-16 data point, under the human's temporary measure: T-1928's verify 41546aee (A-23316) at 0a0296c81 ran on c-16 with 4 workers and passed, with every tier including Web. Lifetime was 2,543 s (42 min) and cost $0.3532. The same full selection on c-8 with 2 workers timed out at 75 min for $0.32 (030d6d25). So c-16 cost about the same per run and finished, where the c-8 runs were wasted. This is relevant to T-2102.

### coord · 2026-11-27T02:51:20.686Z

Fifth case, 2026-11-27: T-2044's task verify cf0f336c (A-23700) at 3850ab09d ran unsharded on c-8 with 2 workers. It exited 143 with "run timeout 75m". T0 through T3 completed with exit 0 and no failed cases, and Web was cut off with 7 files in flight. The selection was full because T-2044 changes verifier code. It is being retried once on c-16 with 4 workers under the human's temporary measure. The human's choice of approach is pending in ask 0ed06e8d.

### coord · 2026-11-27T04:35:02.367Z

Human decision 2026-11-27 04:34Z (ask 0ed06e8d, option 4): «Комбинация: ждать шардинга до N минут, потом c-16». When a full run that can't shard projects a wall above the run timeout, it waits for two free slots for up to N minutes, then runs whole on c-16 with 4 workers. coord set N to a configurable default of 20 minutes, the existing queue wait p90 target (`wait_p90_target`); the human may change it. Measured fallback cost: about $0.35 for 42 minutes. 20 minutes of waiting plus 42 minutes of run stays inside the 75-minute timeout. The criteria were rewritten to match this. When it lands, the temporary manual c-16 override ends, and T-2102 revisits the cost.

### impl-2100 · 2026-11-27T04:46:21.105Z

Consumer audit (rule 20/41): Suites admission, runRef and snapshots; DropletExecutor acquire/checkSpend/reserveShards and spend ledger; dispatch onShardingSkipped and result reports; suite-log semantic retention and suiteSummary; suite-result-metadata terminal/recovery writes; suite-cover, batch-shard-receipts and dev-t3 coverage/persisted readers; config parser/render/template-derived config-set and hot reload; hub/src/cli/suite.ts verify queue and web/src/sessions/verification.ts/state.ts queue reducers; shared/wire and nvim queue readers (wire shape unchanged). Tests found by contract fields/functions/log wording across all tiers: suite-stage-rules, suite-close-component, suite-cover, suite-soak, suite-persistence, dev-t3-coverage, merge-batches, executor-admission-lock; config-set and suite-wait-metrics pin touched/new config keys. Docs/skills: docs/agents/tests.md, docs/hub/running.md, hub/README.md, implement skill. QA briefs/startup probes/frozen CLI usage search found no consumer of the new decision line or keys; existing warning line stays unchanged. Config fields and result.json shardWait are additive; previous queue wire shape is unchanged. Conservative full import graph scan includes 782 reachable tests (17 unresolved-graph cases included conservatively); local selection is changed files and direct importers, not that closure. C1 red observed running instead of queued; fake clock owns policy deadlines. This is admission policy, not a gate (rule 27); C2 intentionally left for Coordinator post-merge evidence.

### rev-40 · 2026-11-27T04:53:52.187Z

verdict: review
result: not clear
by: rev-40 [reviewer]
run: rev-40-20261127-2100-source1
commit: 55a511c7a982721dc9ee858a9a22045776d4fc29
scope: full
findings: [{"severity":"medium","text":"M1: restored pre-change job.config bypasses config capture and lacks fallback_size/fallback_workers; direct reads select undefined. Normalize absent new fields from shared defaults while preserving admitted settings/overrides; cover legacy snapshot restart.","file":"hub/src/hub/suites.ts","line":1442},{"severity":"medium","text":"M2: RemoteBudgetFull deletes selected fallback config but leaves shardWait.path/shardingSkipped; next capture resets c16/4 to ordinary c8/2 and never reapplies fallback. Persist effective policy across retry/restart, with acquire-race control.","file":"hub/src/hub/suites.ts","line":1319}]
finding_counts: {"high":0,"medium":2,"low":0}

Source not clear; A-23729 records Standards/Spec and two medium findings. Implementer6579f3de confirms neither recovery boundary has another owner. Ordinary wait/shard/fallback, cloned config, overrides, actual-price spend path and reporting are retained positive source facts; current8controls miss legacy admission snapshots and acquire-time capacity refusal. Correct defaults via shared owner and preserve effective fallback through config recapture, with fake-clock/executor restart/race controls. C1 failed; C2 intentionally remains unchecked/unverified for Coordinator post-merge dev evidence. A-23727/local update scoped only; no configured run/source pass at this head. Hold released for corrections; fresh source review precedes verification. No Reviewer edits/executions.

Criteria: C1 failed (Fallback defaults are absent in legacy saved config snapshots, and acquire-time RemoteBudgetFull discards selected fallback size/workers on retry.).

### impl-2100 · 2026-11-27T04:59:39.335Z

Review fixes M1/M2 at aa7d90dba5c52de5ad3c3c7da44b8aff64b9c32b: red legacy snapshot selected undefined workers; red acquire-time capacity refusal/restart reset 4 workers to 2. Shared config-default owner now normalizes only undefined new retained-policy fields. The selected fallback size/workers persist in additive shardWait.fallback metadata and are reapplied after config recapture. Fake-executor restart controls cover defaults, independent overrides, both overrides and a custom c-8/3 selection surviving reload to c-16/4. Source-tree tests passed: stage-rules 44, config-set 25, wait-metrics 8, cover 25, persistence 31, soak 37, close-component 19, protocol 18. Final-head typecheck passed; full test lint pending. A-23730 contains scoped red/green evidence and consumer delta, supplementing A-23727 and A-23729. No dev merge after first source review; configured verification not submitted. C2 remains unchecked for Coordinator post-merge evidence.

### rev-40 · 2026-11-27T05:01:13.845Z

verdict: review
result: clear
by: rev-40 [reviewer]
run: rev-40-20261127-2100-source2
commit: aa7d90dba5c52de5ad3c3c7da44b8aff64b9c32b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Corrected source clear; A-23731 records both axes, zero findings. M1 fills only absent retained policy fields via shared defaultConfig, preserving admitted settings; legacy restart control retains7.25cap and concretec16/4, red-before-fix retained. M2 persists effective fallback tuple independently of disposable config and reapplies it through one helper on capture/retry; five acquire-refusal/restart/override/custom-reload controls retain exact size/workers/remote/terminal assertions. Original wait/shard/fitting/soak, actual-price spend path and fake whole-case ownership retained. A-23730/request local44/static0 and selected checks are scoped reported evidence, no Linux/full closure proof. C1 done/source-correct, verification pending authorized exact-head configured result. C2 stays intentionally unchecked/unverified for Coordinator post-merge dev run. A-23729 failed source history retained. Hold released; no Reviewer execution.
