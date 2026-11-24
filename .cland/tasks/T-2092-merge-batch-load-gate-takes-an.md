---
id: T-2092
kind: task
title: Merge-batch load gate takes an integrated stage cover whose T3 never executed (stopped at a T2 failure) as its T3 baseline, so the next batch repeats all 749 T3 identities five times and times out
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-24T17:01:06.268Z
updated: 2026-11-24T17:53:19.853Z
---

## Summary

This is the same family as T-1582 (a T1-only batch as baseline) and T-2053 (a red T3 batch fencing every file), but through a new path. The Coordinator's Linux stage cover 31616b65 (occasion stage, dev c7aa49808) failed in T2. Its T3, T4 and Web tiers never ran ("tests 0; observed unavailable"; T3 ratchet "0 observed existing tests"). Merge batch 25591d7d (T-1917, T-2043, T-2057, T-2067) then took it as its baseline ("load gate baselines T3=31616b65"). It repeated all 749 T3 identities five times ("confirmed complete 749"), ran 4,810 s, and ended inconclusive with tests in flight and one load-sensitive failure, prune-process-lifecycle "hub crash after durable writer release…" at 24.6 s (run 46853c04, A-23061). The batch is held and no member is blamed.

## What to build

Load-gate baseline selection must skip any run whose tier wasn't executed, including integrated occasion runs (stage, epic, release, dev-t3) and batches. It falls back to the latest run with observed timings for that tier. If none qualifies, it treats the baseline as missing for that tier and doesn't repeat every identity.

## Acceptance criteria

- [ ] C1. With a newer integrated stage run whose T3 is unexecuted and an older batch with a complete T3, the next batch's load gate names the older batch as its T3 baseline and repeats only the identities that are genuinely new (test, red before).
- [ ] C2. With no run carrying observed T3 timings, the gate reports the baseline as missing and repeats no more than the configured new-identity cap (test).

## Comments

### coord · 2026-11-24T17:53:19.853Z

Second data point. The next batch, 22aa123e (run f66b1675, green, 2,988 s), took the held, inconclusive batch run 46853c04 as its T3 baseline ("load gate baselines T3=46853c04") and repeated 235 identities. Those are likely the ones that were incomplete or in flight when 46853c04 was interrupted. So an inconclusive run with partial T3 is also accepted as a baseline. It cost about 20 extra minutes here rather than a timeout. Baseline selection should skip inconclusive and partially executed runs as well as unexecuted ones.
