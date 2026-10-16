---
id: T-589
kind: task
title: A failed `demo start` leaves its lease releasing for minutes after the droplet is gone
state: open
status: backlog
size: S
labels:
  - needs-triage
  - hub
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-16T11:01:51.429Z
updated: 2026-10-16T11:19:47.735Z
---

## Summary

E-425's demo, QA run qa-2026-10-16-27-22: `cland demo start E-425 --commit 133ce008… --json` exited 1 with `cland: machine command failed or exceeded its time bound`, about 50 s after the droplet was created. Its lease df159ade then read `releasing` for 7 minutes or more, while `cland executor status` counted only one tagged droplet, belonging to another run. The provider had apparently destroyed it, but the lease record never moved to released.

## Evidence

- Lease df159ade-30c3-4486-9cf1-029ea09c9dce (droplet 609660462, lon1 c-8, snapshot cland-v0-39776bc65f50, rebuilt at 10:59Z by `cland executor prepare`).
  - Timeline: createStarted 10:54:18.846Z, createFinished 10:54:20.659Z, deleteStarted 10:55:11.730Z. Still `releasing` at 11:01:18Z.
  - The error names no failing machine command or bound.
- Same snapshot, minutes later: impl-588b's droplet verify 84d72d8f ran past 300 s normally, so the image itself works.
- The hub is pid 73959, with T-583 (demo release after an accepted delete) live.

## Acceptance criteria

- [ ] C1. A `demo start` that fails during delivery names the failing step: SSH readiness, bundle copy, dependency install or Neovim, with its bound and the command's exit or stderr tail.
- [ ] C2. After a failed start, the lease reaches released within the D18 bound (6 minutes) once the provider reports the droplet gone, and `demo status` and `executor status` agree.

## Comments

### coord · 2026-10-16T11:19:47.735Z

Second instance, on the stop path. In E-425's demo run qa-2026-10-16-27-22, lease 7799a2e0 (droplet 609663506) took `demo stop` at about 11:13:45Z: deleteStarted 11:13:45.986Z, and the stop returned exit 0 with state releasing. At 11:19:20Z it still read releasing, while `executor status` counted only one tagged droplet, another run's. The first lease, df159ade, moved to released only at 11:04:26Z, right after the 10-minute reconciliation sweep. So on hub pid 73959 (started 10:53Z, f6045f83 code), the release confirmation right after delete does not mark the lease released, and only the sweep does, 0–10 min later. E-423's D18 at 10:20Z, on hub pid 29477 with the same executor code, released in 14 s. That suggests the immediate confirmation depends on timing: the provider's droplet listing lagging behind the delete. This puts E-423 D18's "released within 6 minutes" at risk on any given stop. Raise in triage.
