---
id: T-267
kind: task
title: "Suite spend: 36k git and 20k ps spawns per run; measure the sources and cut them where there is room"
state: open
status: backlog
labels:
  - v0.1.2
  - hub
assignee: null
parent: T-268
blocked_by: []
topic: null
branch: null
created: 2026-10-12T09:51:33.334Z
updated: 2026-10-12T15:48:46.632Z
---

## What happened

The T-256 prototype (docs/research/remote-executor.md on prototype/remote-executor) counted the suite's process churn on a DigitalOcean c-8 droplet: 77,132 process exits during one full run, of which 36,621 were `git`, 20,599 were `ps` and about 9,000 were Node; peaks of only 95 user-space processes and 694 threads, so the churn is sequential spawning, not concurrency. The T-218 research already named the hub phase process-bound (about 450 daemons, 670 CLI spawns, a machine-wide `ps` per teardown, no compile cache). The suite takes 13 minutes locally and 16 on the droplet.

## What to build

The human's decision (2026-10-12): before the remote executor, optimise the suite where there is room. First measure where the spawns come from (per test file and per helper: repository fixtures, territory and worktree setup, merges, the per-teardown process scan), then cut the big sources: a prepared fixture repository cloned with shared objects or copied instead of rebuilt with many `git` calls; pid tracking of spawned children instead of a machine-wide `ps` scan per teardown; the compile cache; batching of what the hub phase runs per test. Report the before and after wall time and spawn counts in the item; the local macOS run and the Linux run (T-266) both stay green.

## Acceptance criteria

- [ ] A measurement artifact names the sources of the git, ps and Node spawns with counts per test file and helper.
- [ ] The full suite's git and ps spawn counts drop by at least half, with the wall time before and after recorded.
- [ ] No test is weakened or skipped to get there; the suite stays green on macOS and on Linux.

## Comments

### coord · 2026-10-12T11:54:39.618Z

Realised by the slices T-277 (the census), T-278 (teardown by process group, the ps cut) and T-279 (the prepared fixture repository, the git cut). This item stays open as the record and closes when T-279 lands, with the before/after wall time and spawn counts its Implementer sends recorded here.

### coord · 2026-10-12T15:48:38.200Z

Not closed yet: kept open until T-279 lands (record of the cuts).

### coord · 2026-10-12T15:48:46.632Z

Correction (Coordinator, 15:49Z): the close at 15:48:38Z was a slip of mine; T-267 is reopened and stays open as the record until T-279 lands. Baseline so far: A-1535 at 7cb55c6, 86,457 spawns (git 32,341, ps 28,888, node 6,017), 905 s.
