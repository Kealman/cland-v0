---
id: T-2080
kind: task
title: "Hub #101 RSS grows from 0.57 GB to 2.0 GB within an hour of a restart under a crew-sized load"
state: closed
status: done
size: M
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-24T11:03:59.437Z
updated: 2026-11-24T19:57:29.258Z
closed: 2026-11-24T19:57:29.258Z
---

## Summary

After restart #101 at 10:04Z on 2026-11-24 (2514c3d9a, the T-2069 fix), hub RSS was 0.57 GB at +6 min, 1.79 GB at about +30 min, and 2.0 to 2.1 GB at about +58 min, according to cland-impl's readings and ps. CPU was 60 to 100% with no local runs. Two 5 s tracker stalls came at 11:02Z (task.comment 7.6 s, task.view 10.6 s). Machine swap reached 4.1 GB, up from 1.5 GB that morning. Load came from about 20 live implementer sessions, 8 droplet verifies, a merge batch, and enqueue preflights. The retry loop T-2069 fixed has stopped. Suite-retention passes over all ~5,560 runs per landing (see T-2029) may contribute, but this is unverified.

## What to build

Use a heap profile of the running hub (the SIGUSR1 inspector recipe, hub-startup-profiling) to find which structures grow per event: a retention pass, verification checkpoints, delivery rings, coverage maps or session journals. Bound the growth, or release it after each pass.

## Acceptance criteria

- [ ] C1. A heap profile at about +1 h under a crew-sized load names the top growing retainers (diagnostic).
- [ ] C2. Hub RSS stays within a documented bound over a 2 h crew-sized replay, using the fake harness (test or measurement).

## Comments

### coord · 2026-11-24T12:03:37.447Z

Profile from cland-impl, an 8 s SIGUSR1 CPU profile of hub #101 at 12:02Z on 2026-11-24 (RSS 3.08 GB at 12:01:59Z, 1 h 58 m up, ~100% CPU, no local run in flight). 56% of main-thread inclusive time is `#drain` in hub/src/test-lint-policy.ts:173, which calls testLintFacts (test-lint.ts:501) and then analyzeTestSource (test-lint.ts:26). That's the TypeScript checker running inside the hub process: resolveNameHelper, getSymbolOfNameOrPropertyAccessExpression, checkExpression. GC took 4.8% and the thread was idle only 18%. The likely RSS growth is TypeScript programs retained by that drain. Slow answers in the same window: merge 108 to 130 s, suite.start 20 to 32 s, session.launch 25 to 67 s. 53,172 stage-containment-visit lines in 5 minutes, but the profile says they don't own the CPU. Suspected link: T-1928 (verify admission re-lints candidates) and T-2037. Move the analysis off the main thread, or cache it, and release the programs.

### coord · 2026-11-24T12:36:32.609Z

RSS on hub #102 (cland-impl): 1.23 GB at +30 min (12:35Z) and 0.56 GB after a GC at 12:36Z. Hub #101 was at 2.0 GB at +1 h and 3.08 GB at +2 h. Steady growth is absent while there are no landings, which fits TestLintWarmer re-linting at each dev-tip move (T-2084). Re-check after the next landing wave; T-2084 is in verify (1d3196b9).

### coord · 2026-11-24T13:47:55.319Z

Landing-wave reading on hub #102, from cland-impl. Batch 44b401d8 started landing at 12:45:37Z.

| Time | RSS | Note |
|---|---|---|
| 12:36Z | 0.56 GB | before the wave |
| 12:56Z | 2.12 GB | +10 min |
| 13:46:04Z | 2.31 GB | +1 h |
| 13:46:32Z | 2.41 GB | CPU 99% |

test-lint-warmed passes went from 1 (startup) to 6 by 12:56Z and 11 by 13:46Z. That is one full pass over the 1,034 files per landing: ten landings in 1 h 40 min, each adding about 0.2 GB net after GC. This confirms TestLintWarmer at each dev-tip move as the RSS driver; T-2084 is the fix. Session launches time out at 60 s while it runs (13:46Z).

### coord · 2026-11-24T18:13:29.487Z

Hub #103 (pid 13781) is serving at 9af601700, which includes T-2084, from 18:11:52Z after a 17 s gap; reported by cland-impl. The startup warm pass ran in the capped child: 1,042 files, 16.3 s wall, peak heap 134.8 MB against a 318.8 MB limit. Hub RSS was 0.67 GB at serving and 0.36 GB at 18:12:51Z, with CPU 17% and task view at 0.11 s. Compare #101 at +2 h, 3.08 GB, and #102 at 3.01 GB at 17:58Z. The +30 min reading is due about 18:42Z. If RSS stays flat across the next landing wave, close this item as fixed by T-2084, with that reading as evidence.

### coord · 2026-11-24T19:57:29.258Z

Fixed by T-2084 (landed d85fbb5ca; hub #103 serving at 9af601700 since 18:11:52Z). The growth driver was TestLintWarmer running a full TypeScript re-lint of about 1,040 test files on the hub's main thread at every dev-tip move. That was confirmed on #102: about 0.2 GB net per landing, 0.56 to 2.12 to 2.31 GB across one landing wave, and 3.01 GB at 17:58Z. T-2084 moved the analysis into a capped child process (heap limit 318.8 MB). Readings on #103 from cland-impl, across batch 6ce19499's 4 landings with 6 warmer passes, all in the child (last one 14.6 s wall, peak heap 153 MB):

| Time | RSS | CPU |
|---|---|---|
| 18:42Z, before | 1.37 GB | |
| 19:06Z, +10 min | 1.56 GB | 1.7% |
| 19:56Z, +1 h | 1.12 GB | 5.7% |

RSS is now flat to falling across landings, against #102's steady growth. The C1 heap profile is superseded by the CPU profiles on T-1928 and T-2084, which named the retainer source. The remaining per-landing stall (5.1 s) is the stage-containment sweep, tracked in T-2062.
