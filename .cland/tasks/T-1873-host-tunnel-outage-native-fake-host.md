---
id: T-1873
kind: task
title: "host-tunnel-outage-native: fake host stays cloning past the 15 s alert wait under Linux batch load"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - flaky
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-15T16:30:06.052Z
updated: 2026-11-15T16:32:07.216Z
---

## Summary

`hub/test/host-tunnel-outage-native.test.ts::native tunnel outage pushes host alert and CLI scratch control restores it` (T-1839) failed once in merge batch e35f0ece (T-1760 alone), run 312bfe01, on a Linux droplet: c-8, nyc1, workers 2, peak load 7.5, log A-19740. It reported `no frame matched within 15000ms`. The last hosts.state it saw had the fake host in state `cloning`, with alert `null`. The test passed in the previous batch on dev (13cab6f4, A-19719). Afterwards, on macOS, it passed 3 out of 3 at dev 9dad57082 and 3 out of 3 at T-1760's head a4596490b (impl-1760, 2026-11-15 16:29Z). So it's load- or Linux-sensitive, not caused by T-1760. The hub's singleton bisect dropped T-1760 on it.

## What to build

Find what keeps the fake host in `cloning` past the test's 15 s frame wait under Linux batch load. It could be the clone through the tunnel, fixture Git or the fake transport. Either:
- remove the wait on real time;
- move the clone readiness onto the shared load-scaled waits, with a named reason.

Keep the outage-alert and scratch-restore assertions exact. Print the last hosts.state on timeout. It already does, so keep that.

## Acceptance criteria

- [ ] C1. The cause of the stuck `cloning` is named from a reproduction under load, and the fix removes it or bounds readiness with the shared load-scaled wait (test).
- [ ] C2. The test passes 20 out of 20 runs at a 1-minute load of at least 8 on Linux (a local Docker container with `--init` is fine), with unchanged assertions (test).

## Comments

### coord · 2026-11-15T16:32:07.216Z

Evidence from impl-1760's six-run comparison (A-19741, macOS, 2026-11-15 16:29Z): dev 9dad57082 passed 3/3 (7.9, 5.6 and 5.8 s) and T-1760 head a4596490b passed 3/3 (8.0, 5.8 and 5.8 s). Every run saw ready/no-alert, then ready/outage, then ready/no-alert, and 4 of the 6 first saw `cloning` before `ready`. So the clone phase always runs before readiness, and under Linux batch load it apparently outlasts the 15 s frame wait. Full-name inventories were unchanged in all six runs.
