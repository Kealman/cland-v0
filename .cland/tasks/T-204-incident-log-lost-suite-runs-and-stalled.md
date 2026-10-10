---
id: T-204
kind: task
title: "Incident log: lost suite runs and stalled leads waiting on them"
state: open
status: backlog
labels:
  - needs-triage
  - tech-debt
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-10T18:43:39.635Z
updated: 2026-10-10T19:22:50.485Z
---

A running log, kept at the human's request, of incidents where a suite run or its result got lost, or a lead sat idle waiting for one. We'll decide what to do about the pattern later. Possible directions: T-201 (fair suite lock), a `cland suite --report` helper (the T-189 finding), a hub queue for shared resources (v0.1.1 observation).

Source: the Coordinator's hourly lost-work check (19:13Z, then every hour at :13), plus anything noticed by hand. Each incident goes in as a comment, one per incident, in this format:

- **When** (UTC), **item**, **session**
- **What**: the promise or status against what was actually running
- **Cause**, if known (nohup, callback refused, lock wait, …)
- **Cost**: roughly how long the item stood still
- **Recovery**: who nudged and what happened

## Incidents so far

1. **2026-10-10 ~18:28Z, T-187, impl-187.** Its C4 needed the Neovim package suite at 53aff50. The run was started with nohup and vanished without a result. The Coordinator's status still showed it as queued. aide-1 found no process at ~18:36Z. The Coordinator nudged at ~18:38Z, and the run was relaunched with a confirmed process. Cause: nohup broke the result path. Cost: ~10 min idle before it was noticed.
2. **2026-10-10 ~18:17Z, T-196, impl-196 (near-miss).** The earlier verification invocation's callback tried a raw `topic.send` and was refused as human-only, so its result was lost (A-709 FAIL). The lead asked the Coordinator, proved a `send` callback, and reran. The rerun from 18:20Z did deliver (A-711, 18:38:47Z), but at ~18:36Z it was not visible as a suite process. Lesson: process checks alone can misjudge a run.
3. **2026-10-10, T-176, impl-176.** Its merge-suite npm test waited on the lock for 24+ min behind T-190. That is not a loss, but it is a long unfair wait (see T-201).

## Comments

### coord · 2026-10-10T18:44:01.156Z

Earlier incidents the same day, from the Coordinator's record:
4. 2026-10-10 ~16:14Z, T-183, impl-183. The full suite on d4561fb finished at 16:14Z (2 hub failures, A-676), but the wrapper's completion used a spoke-only frame over the client socket, so nothing was delivered. Found when the Coordinator asked at 16:57Z. Stood still ~43 min. The reporter path was then proved with a dummy (A-678).
5. 2026-10-10 ~16:50Z, T-190, impl-190. A nohup-launched full suite on 98be620 never persisted (empty runner log). Found at 16:56Z when the Coordinator asked for the old run to be cancelled. Stood still ~6 min, with no result lost because the head was superseded.
6. 2026-10-10 17:32–18:05Z, T-196, impl-196. After self-review it went idle having promised a review request and a suite. No request was sent, and the nohup suite died with the tool shell. The hub's 30-min idle event reached the Coordinator at 18:02:50Z, followed by a nudge at 18:05Z. Stood still ~33 min.
7. 2026-10-10 15:4x–16:34Z, T-176, impl-176. Its first full suite (pid 8174) waited for the lock from 16:34Z and lost the race to T-143's run, then to T-183's. It took the lock at ~17:49Z after the Coordinator had T-190 step aside. Waited ~75 min (T-201).
Fixes in flight: T-201 (lock FIFO), T-203 (`cland suite --report`), and the Implementer clause line against nohup (5f435ad).

### coord · 2026-10-10T19:17:55.398Z

Hourly check 19:17Z. No lost runs: T-176, T-187, T-190 and T-196 each have a live suite process, and no result is missing from their topics (reviews clear; C4/C5 wait on these runs). Two long lock waits (T-201):
- T-176, impl-176: `run-suite all` on 1e25f99, started 18:10Z, still running at 19:17Z (67 min). It held the machine lock around 18:38Z for its hub phase, then waited again for its Neovim phase.
- T-187, impl-187: `run-suite nvim` on 53aff50, started 18:39Z (38 min). It took /tmp/cland-suite-nvim.lock first and has waited on the machine lock since, behind T-196's hub phase (holder pid 66359).
Cause: the nested order (the Neovim lock first, then the machine lock, T-175) lets a Neovim run hold the Neovim lock while it waits for the machine lock, so every other run's Neovim phase (T-176, T-190) waits behind it too. No nudge sent: the owners cannot shorten a lock wait. New suite launches are held until T-176 is through.

### coord · 2026-10-10T19:18:34.434Z

Correction to the 19:17Z entry (from aide-1's process check at 19:19Z): T-176's run (pid 16824) has waited the whole 67 minutes, at 0% CPU with no test children. It was overtaken, not slow. T-196's run, requested at 18:40:48Z (30 minutes after T-176 queued), took the machine lock and started its runner at 19:05:53Z. Action at 19:20Z: impl-187 and impl-190 were asked to cancel their waiting Neovim runs and relaunch after T-176 holds the machine lock.

### coord · 2026-10-10T19:20:18.472Z

2026-10-10 19:20Z, T-187, impl-187: on stepping aside, it found that its relaunched reporter (18:39Z) would also have lost its result. The callback sent a spoke-only `send` frame over the CLI socket, the same failure as impl-183's at 16:14Z. Caught before any result was lost; it is being rebuilt with a delivery proof. Cause: each session writes its own reporter (T-203).

### coord · 2026-10-10T19:22:50.484Z

Follow-up on T-176 (19:22Z): its run passed (A-721, hub 1043/1043 in 869 s, Neovim 234/234), finishing at 19:22Z. The 869-second hub phase places its start near 19:05Z, so T-176 had the machine lock from about 19:05Z. The holder.json readings at 19:17Z (pid 66359) and aide-1's runner attribution disagree with that. The hub phase and Neovim phase may hold the locks separately. Either way, T-176 waited from 18:10Z to about 19:05Z, 55 minutes.
