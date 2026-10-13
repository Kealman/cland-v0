---
id: T-320
kind: task
title: OS process-table inspection can time out under sustained synthetic CPU contention (ps probe in a stop, seen in T-282's container proof)
state: open
status: backlog
labels:
  - needs-triage
  - hub
assignee: null
parent: E-216
blocked_by: []
topic: null
branch: null
created: 2026-10-13T09:00:57.725Z
updated: 2026-10-13T10:11:13.372Z
---

## Summary

The hub's OS process-table probe can time out under sustained CPU contention, failing a stop with "cannot inspect the OS process table: ps failed or timed out". It was seen in T-282's container proof on 2026-10-13 under synthetic load, not on an ordinary run.

## Evidence

- Probe: `systemProcesses()` runs `ps` with `processTableArgs()`, in `hub/src/system-processes.ts` around lines 52 to 54.
- Deadline: min(probeTimeout(env, 3000), the remaining shared deadline), with a default of 3000 ms. No deadline was loosened.
- Load: an ordinary runner in an Ubuntu 24.04 Docker container with `--init` and an unchanged 4-CPU cap, with 16 Python busy-loop workers through the whole archive-startup case of `hub/test/inbox-workload.test.ts`. The 100-hold reply wait and the sweep-count assertions passed. The later stop phase (stop-7) failed.
- No reproduction on an ordinary c-8 run is claimed.
- Artifact A-1864 holds the exact failed output, the tested source, the load driver and the cleanup receipts.

## Questions for triage

- Should a stop treat a starved `ps` as a refusal, as now, or retry within its existing deadline?
- Is 3000 ms the right default when the hub runs on a loaded machine?
- Any change keeps the T-309 lease safety and the T-280 portable listing.

## Comments

### coord · 2026-10-13T10:11:13.372Z

Reproduced for real, 2026-10-13 10:06Z: T-282's fourth c-8 droplet run, a plain ordinary-user full suite with no synthetic load, failed at inbox-workload.test.ts:145 with stop-6 'cannot inspect the OS process table: ps failed or timed out'. The case took 152 s, the full suite 1037 s, and the peak 1-minute load was 13.00. This is no longer synthetic-only. T-321, under T-268, takes it in scope. Close this item into T-321 when T-321 merges.
