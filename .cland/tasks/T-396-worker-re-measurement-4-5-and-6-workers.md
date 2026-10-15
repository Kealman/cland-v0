---
id: T-396
kind: task
title: "Worker re-measurement: 4, 5 and 6 workers locally and 6 and 8 on a c-16, after the inspection diet and the in-process hub, and the defaults set from the numbers"
state: open
status: planned
size: XS
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-392
  - T-393
topic: null
branch: null
created: 2026-10-14T12:28:19.638Z
updated: 2026-10-15T15:32:05.954Z
---

## Summary

The machine shard runs at four workers on a Mac with four performance and six efficiency cores. The load sits at 14–15, and readiness flakes appear above 15, so more workers have not paid so far. Once the inspection diet and the in-process hub cut the CPU per test, the trade may change. This ticket measures 4, 5 and 6 workers locally and 6 and 8 on a c-16 droplet, and sets the defaults from the result.

## Parent

"Test speed: structural" (R-294), tracer bullet 4; research #9 (`docs/research/test-speed.md` §3.4; §2 point 3).

## What to build

- **Configurable worker count.** The count is hard-coded in `hub/src/suite-shards.ts` `classify` (`workers: resource === 'free' ? 1 : 4`, and 4 for Neovim in `packageShards`). It becomes `[verification] workers` (default 4) with a per-executor override for droplets, `[verification.droplet] workers`.
- **Local runs.** Run the full suite at 4, 5 and 6 workers on the local executor at one head. Each run starts only when the verify queue has no holder or waiter, under the load rule. For each, record the wall time, the hub phase, the peak one-minute load and any failure that passes alone. Repeat each count once.
- **Droplet runs.** Run 6 and 8 workers on one c-16 droplet within D27/D28's limits, posting create, destroy and cost.
- **The defaults.** Pick the fastest count with no load-only failure across both repeats. If none beats 4 by at least 10% locally, keep 4.

## Acceptance criteria

- [ ] C1. `[verification] workers` and `[verification.droplet] workers` set the machine shard's worker count, default 4, proven by a test reading a fixture config.
- [ ] C2. The measurement table (workers, executor, wall, hub phase, peak load, failures that pass alone, cost for droplets) for 4/5/6 local and 6/8 c-16, two runs each locally, is posted on the item.
- [ ] C3. The chosen defaults follow the rule above, and the item names the numbers that decided them.
- [ ] C4. Droplet runs stay within the day's $3 cap, with create, destroy and cost posted and the `cland` tag listing empty afterwards.
- [ ] C5. `hub/README.md` (Tests) documents the worker settings and the measured trade-off.
