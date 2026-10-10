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
updated: 2026-10-10T21:27:00.239Z
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

### coord · 2026-10-10T20:08:14.727Z

2026-10-10 20:07Z, T-162, impl-162: after rev-13's not-clear verdict (19:41Z) it committed the fix 9344ab8 at 19:43Z and went idle at 19:44Z. Promised: a re-review and a new final Neovim suite. Running: nothing, with no T-162 suite process and no request in topic-100. Stood still 23 min until the Coordinator's check and nudge. Cause: the same pattern as impl-196 at 17:32Z, a Codex turn that ends after describing its next steps. This happened even though the clause line from 5f435ad ('send your review request before you go idle') was in its launch clause. The line alone does not prevent it.

### coord · 2026-10-10T20:11:05.977Z

2026-10-10 20:11Z, T-196, impl-196: its full suite on f96c8a8 passed at 20:08Z (hub 1056/1056, Neovim 238/238, log /tmp/cland-T-196-f96c8a8-suite.log). The callback proved at 18:19Z delivered nothing to rev-14, and no reporter process remained. Found by the Coordinator 3 min after the run ended, and impl-196 was nudged to post it by hand. Cause: unknown; the reporter exited without sending. A passed run that goes unreported costs a queue slot, which is the T-203 case.

### coord · 2026-10-10T20:11:46.899Z

Correction to the 20:11Z T-196 entry: the result was published as A-757 at 20:11:05Z, about 3 minutes after the run ended at 20:08Z. rev-14 verified C5 at 20:11:31Z, and T-196 went ready. My nudge went out at about the same moment, so it is unclear whether the callback was just slow or the nudge produced it. No time was lost.

### coord · 2026-10-10T20:14:27.418Z

2026-10-10 20:15Z, T-190, impl-190: its Neovim run (pid 15881) waited 30 min. It holds the Neovim lock while waiting for the machine lock, which T-177's run holds. T-203, T-193 and T-184 queued full runs on the same machine lock, and T-162's Neovim run waits behind T-190's Neovim lock. Action: impl-203, impl-193 and impl-184 were asked to cancel and relaunch after T-190 takes the machine lock. This is the third starvation case today (T-201).

### coord · 2026-10-10T20:18:33.353Z

2026-10-10 20:19Z, T-193, impl-193: at 20:17:54Z it reported its replacement validation on 55a04db as 'will obey the pid 15881 fairness condition', then went idle at 20:18:05Z. Running: no T-193 waiter or suite process (only T-203's and T-184's watchers exist). It was caught within 1 min and nudged to launch and check the process. Cause: the promised command was never started, the same class as T-196 and T-162.

### coord · 2026-10-10T20:18:50.245Z

Correction to the 20:19Z T-193 entry: impl-193's waiter (pid 19583) was live at 20:18:42Z, before my nudge landed. The gap between its 20:17:54Z promise and the process was under a minute, so this is not a stall. My 20:19Z check missed the new process.

### coord · 2026-10-10T20:25:51.427Z

2026-10-10 20:25Z, T-190: overtaken again. T-201's full run (pid 85621, launched about 20:20Z, after the 20:15Z step-aside request) took the machine lock ahead of T-190's Neovim run (pid 15881), which has now waited 41 min. Not cancelled, since T-201 is already running its tests. T-190 is the only machine-lock waiter left; the other three runs wait for it. Lesson: a step-aside request also needs to reach sessions launched afterwards. The Coordinator launched impl-201 at 20:14Z and did not tell it.

### coord · 2026-10-10T20:55:57.668Z

2026-10-10 20:55Z: T-162's Neovim run (pid 27216, impl-162) has waited 46 min. It holds the Neovim lock while waiting for the machine lock, which T-177 holds. T-201's run, which fixes the order, has waited 22 min behind T-203, T-184, T-190 and T-193. Action: those five owners were asked to cancel and relaunch after T-201's run holds the machine lock, so T-201 can run and merge first.

### coord · 2026-10-10T21:26:16.609Z

2026-10-10 21:26Z, two cases:
(1) T-162, impl-162: its relaunched Neovim run (pid 13956, about 21:04Z) has vanished. No T-162 process, and no result in topic-100 since 20:56Z. It stood for about 20 min before this check. Cause unknown. Nudged.
(2) T-201, impl-201: its run (pid 62838) finished the hub phase. Since 21:17:29Z it has waited in its own FIFO queue for joint Neovim admission, and old-protocol T-184 took the machine lock. My 20:55Z hold condition ('until 62838 holds the machine lock') was wrong: it should have been 'until 62838 exits'. Corrected for T-190, T-203 and T-193.

### coord · 2026-10-10T21:27:00.239Z

Correction to 21:26Z case (1): T-162's run had not vanished. It passed (Neovim 244/244, A-803) and its result was published at 21:26:16Z, a few seconds before my check read the topic. That is the third false flag today. A finished process looks the same as a lost one for a few seconds. The check should also read the newest artifacts and wait a minute after a process disappears before it flags.
