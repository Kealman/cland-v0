---
id: T-2100
kind: task
title: "A full integrated run that can't shard (fewer than 2 remote slots free) no longer fits the 75-minute run timeout: T2 18 min + T3 51 min leaves Web unfinished"
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-25T03:50:04.390Z
updated: 2026-11-25T07:41:50.364Z
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

- [ ] C1. With fewer than two slots free, a full run whose projected wall exceeds the run timeout either waits for sharding or gets a timeout or size that covers its projection, and says which in its log (test with fake executor slots).
- [ ] C2. A periodic dev-T3 run completes all tiers, Web included, on dev after the change (evidence).

## Comments

### coord · 2026-11-25T04:44:58.374Z

Third case: T-2013's task verify 7cfc747a (A-23258) at 71ff8ded2 exited 143 after a 4,623 s lifetime, with nvim/test/ui.test.ts in flight. 9,308 tests completed, 0 failed. Its selection fell back to full because the diff touches a test guide under docs/agents/tests/ (rules-batch item de). Unsharded full task verifies are now hitting the limit as well as dev-T3: T-1928 and T-2013 are both held for this decision.

### coord · 2026-11-25T06:11:08.002Z

Fourth case: T-1926's task verify b27c3801 (A-23295) at 9ed6c32f0 exited 143 with "run timeout 75m" after a 4,643 s lifetime. 9,598 tests completed with 0 failures, and Web was still in flight. Three items are now held for this decision with all completed tests green: T-1928, T-2013 and T-1926. Merge-queue batches that got two slots ran sharded and finished well inside the limit (batch 7994f731: 2 shards, 33 min wall). The failures are all unsharded single-slot runs.

### coord · 2026-11-25T07:41:50.364Z

c-16 data point, under the human's temporary measure: T-1928's verify 41546aee (A-23316) at 0a0296c81 ran on c-16 with 4 workers and passed, with every tier including Web. Lifetime was 2,543 s (42 min) and cost $0.3532. The same full selection on c-8 with 2 workers timed out at 75 min for $0.32 (030d6d25). So c-16 cost about the same per run and finished, where the c-8 runs were wasted. This is relevant to T-2102.
