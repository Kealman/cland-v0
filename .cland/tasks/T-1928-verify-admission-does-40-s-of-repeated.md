---
id: T-1928
kind: task
title: Verify admission does ~40 s of repeated candidate lint and planning before acknowledging a submission
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-16T23:36:00.713Z
updated: 2026-11-24T12:36:30.817Z
---

## Summary

Before a `cland verify` submission is durably admitted and acknowledged, the hub repeats the candidate tree and Git checks, test selection, the immutable and worktree lints, tier and duration planning, and command, limit, head, authority and cache validation, then persists the run. On 2026-11-16 that took about 40 s for local submissions (runs 2933ff09 and cea6eda4, A-20468), so the client's reply deadline was missed. T-1927 widens the client deadline; this item makes admission itself faster.

## Acceptance criteria

- [ ] C1. A profile of one local submission names the time of each substep before durable admission, from a scratch project under representative load.
- [ ] C2. Repeated candidate lint and planning work is cached or moved after the acknowledgement, while every candidate and authority check still gates admission. The time to acknowledge drops measurably against C1's baseline, and the item states the before and after figures (test plus measurement).

## Comments

### coord · 2026-11-24T12:03:40.387Z

Live evidence, 2026-11-24 on hub #101. A CPU profile shows 56% of the hub's main thread in test-lint-policy.ts:173 `#drain`, which leads to analyzeTestSource and the TypeScript checker. suite.start took 20 to 32 s and merge 108 to 130 s at a crew load of about 20 sessions. Hub RSS grew from 0.57 GB to 3.08 GB in 2 h (T-2080). This is probably the dominant admission cost that C1 asks you to name. Check whether the drain runs per admission or per landing, and whether its TypeScript programs are released afterwards.

### coord · 2026-11-24T12:14:24.520Z

Second profile, from cland-impl: 8 s at 12:13Z on hub #102, with TestLintWarmer idle and the hub at 131% CPU, RSS 1.5 GB. Main-thread breakdown:
- 26% graphImports (hub/src/suite-import-parser.ts:4, TypeScript parsing of test imports);
- 19% checkTestLint (test-lint-policy.ts:69, then testLintFacts and analyzeTestSource, the admission re-lint);
- 15% lintDurationIdentities (suite-test-identities.ts:27) plus parseDurationManifest and readDurationManifest (suite-durations.ts, YAML parse);
- 17% idle.
The load came from verify admission (T-2027) plus merge-batch preparation (44b401d8), both on the main thread. Three session.launch calls timed out at 60 s while this was going on. This is the dominant admission cost C1 asks you to name. A fix should cache per tree, or move this work into a worker the way T-2084 does for the warmer.

### coord · 2026-11-24T12:36:30.817Z

Baseline on hub #102 at +30 min (12:35Z, cland-impl), with the warmer quiet after startup:
- Every `merge` enqueue took 101–135 s to answer (12:21, 12:26, 12:31 and 12:34Z).
- Every `suite.start` took 20–88 s (12:08, 12:14, 12:21, 12:27 and 12:34Z).
- task.view, comment and edit calls took 5.7–10 s a few times around those calls; otherwise they took 0.21–0.24 s.
- RSS was 1.23 GB, then 0.56 GB after a GC.
This is the before figure for C2: admission and enqueue preflight are now the main-thread cost on their own.
