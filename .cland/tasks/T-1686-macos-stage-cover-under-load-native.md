---
id: T-1686
kind: task
title: "Stage-5 native tests time out under load on both platforms: host-survival-native tunnel wait, host-reboot-native role-cleared, claude-code-remote release wait"
state: open
status: in progress
size: S
criterion_seq: 2
labels:
  - qa-found
  - ready-for-agent
assignee: null
parent: E-1532
blocked_by: []
topic: null
branch: t/T-1686-macos-stage-cover-under-load-native
created: 2026-11-05T09:33:44.695Z
updated: 2026-11-05T09:50:02.529Z
---

## Summary

The E-1532 stage-5 macOS cover 5768d4e4 at f66710b3 (A-16827, local darwin arm64, workers 2) ran under heavy machine load: peak 1m load 14.5 and 4.5 GB of swap in use afterwards. Besides the revoke timeout (T-1685), four native tests failed, each on a bounded wait:

- claude-code-remote "lost native release-restart reply settles without replaying native stop": `native turn settled before release fault: not within 2000 ms` (line 235).
- host-reboot-native "reboot retires one host …": no `role-cleared` log entry with reason 'its harness exited' for the flavour (line 103); 9.6 s.
- host-survival-native "three remote harnesses retain births … across 20s hub downtime": `persisted spoke response cx tunnel: not within 15000 ms`; the load gate passed 2/5; 58.9 s.
- executor-prepare "prepare builds a reusable snapshot …": 'unknown (inspection deferred)' instead of 'current'. This is the known T-1675 pattern.

The same tests passed on the Linux covers and batches. The load was partly the machine itself: swap was in use, and long-running sessions and the hub were resident.

## What to build

For each test, decide whether the bounded wait reflects a product guarantee that should hold on a loaded macOS host (then fix the product), or a test wait that should follow the product's own observation (then fix the test without weakening the assertion). host-reboot-native's missing `role-cleared` entry needs a closer look: check whether it is a missed event under load or a log race.

## Acceptance criteria

- [ ] C1. Each of the three failures (host-survival-native tunnel wait, host-reboot-native role-cleared, claude-code-remote release wait) is classified as a product cause or a test wait, with a reproduction under CPU load or a named cause (evidence).
- [ ] C2. The fixes keep every assertion, and each named test passes 10/10 locally under CPU load, on macOS and in a Linux container (evidence).

## Comments

### coord · 2026-11-05T09:49:29.136Z

Not macOS-only (coord, 09:50Z). The Linux stage-5 cover rerun 384ddd4d at f66710b3 (A-16828, 2 shards) failed:
- host-survival-native "three remote harnesses retain … 20s hub downtime": the same `persisted spoke response cx tunnel: not within 15000 ms`, 59.3 s, and the load gate passed 3/5 (shard-1, degraded disk: fsync 73 ms, SQLite 385 ms);
- host-reboot-native: the load gate passed 4/5 (shard-2);
- host-revoke-native: base fail plus load gate 4/5 (T-1685).
These native tests were added or changed in stage 5 (survival by T-1612, reboot by T-1613), and the load gate repeats them five times under load. Moved into E-1532 stage 5: the stage cannot close on a green pair while they fail under load on both platforms.
