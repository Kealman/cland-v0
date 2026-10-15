---
id: T-204
kind: task
title: "Incident log: lost suite runs and stalled leads waiting on them"
state: closed
status: done
labels:
  - ready-for-human
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-10T18:43:39.635Z
updated: 2026-10-15T09:35:18.691Z
closed: 2026-10-11T17:49:12.289Z
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

### coord · 2026-10-10T21:56:17.903Z

2026-10-10 21:56Z, T-184, impl-184: its relaunched full run on 2dea9af finished at 21:33Z (hub 1050/1052, 2 failures; Neovim not run; log /tmp/cland-T-184-2dea9af-after-T201-full.log). No result reached topic-101 and no T-184 process remained. It stood unreported for 23 min until the Coordinator's check found the log, and impl-184 was nudged. Cause: the conditional relaunch wrapper from the fairness hold ran the suite but its reporter did not send. This is the T-203 case.

### coord · 2026-10-10T22:15:27.926Z

Hourly check 22:15Z. No lost runs: every item in review has a live process. One long wait: T-203 (impl-203) has its full run (pid 26269, old runner from its pre-T-201 worktree) waiting 38 min since its 21:36Z relaunch. T-193 holds the machine lock and is running. T-190's Neovim run holds the Neovim lock and waits on the machine lock (26 min). T-178, T-179 and T-184 are queued as FIFO tickets on dev's new runner. Cause: the transition period. Old-runner pollers (T-190, T-203) and new FIFO tickets share the locks, and the FIFO only orders new-runner waiters. No nudge sent; the owners cannot shorten it, and the old runners leave as their items merge.

### coord · 2026-10-10T22:20:37.102Z

Note on the 21:56Z T-184 entry: the callback did publish A-813 at 21:56:17Z, 23 minutes after the run ended at 21:33Z and seconds after my nudge, so the result was delayed, not lost. The slow path is the conditional wrapper's reporter, which waited for the T-201 dependency to settle before sending.

### coord · 2026-10-10T22:48:26.359Z

2026-10-10 22:48Z, T-193, impl-193: its full run (pid 25743, old runner from a pre-T-201 branch) waited 71 min, losing every round to the FIFO ticket holders (T-178 holds the lock; T-203, T-179 and T-184 hold tickets). cland-impl flagged it. Action: impl-193 merges dev to get the FIFO runner and relaunches with a ticket, after a delta review. Lesson: during the T-201 switchover, a pre-T-201 branch starves. Every branch should merge dev before its next full run.

### coord · 2026-10-10T23:15:32.838Z

Hourly check 23:15Z. No lost runs: every item in review has its runner and reporter live. Waits over 30 min, all in FIFO order on T-201's runner: T-203 holds a ticket from 22:35Z (40 min, next in line) and T-184 from 22:45Z (its Neovim phase, re-queued after its hub phase). T-193 (22:51Z) and T-178 (23:02Z) follow. T-179 holds the machine lock. Cause: T-201's per-phase re-queue, fixed by T-207 (merged 23:10Z, 01ea28d). These worktrees still run their pre-T-207 runner, so the slow cycle lasts until they merge. No nudge sent.

### coord · 2026-10-10T23:48:35.296Z

2026-10-10 23:49Z, T-184, impl-184: its final run on ddfe125 finished at 23:37Z (hub 1074/1074; Neovim 243/244, one plan-view failure; log /tmp/cland-T-184-ddfe125-final.log). No result reached topic-101 or rev-14, and no T-184 process remained. It stood unreported for 12 min until cland-impl flagged it and the Coordinator found the log, and impl-184 was nudged. Cause: the callback again failed to send. This is the second time on T-184; see T-203.

### coord · 2026-10-11T00:15:31.089Z

Hourly check 00:15Z. No lost runs; every item in review has a live runner. T-179 holds both locks. One wait over 30 min: T-203's Neovim-only run (ticket from 23:36Z, 39 min), now first in the FIFO queue. T-184 (23:56Z), T-193's Neovim run (00:02Z) and T-178 (00:08Z) follow. Cause: a full run on a pre-T-207 branch holds the locks for its whole duration (T-179 for about 51 min, including its wait). No nudge sent.

### coord · 2026-10-11T01:15:27.489Z

Hourly check 01:15Z. No lost runs: every item in review has a live process. The integrated dev suite (root, a619490) holds both locks and is running. FIFO tickets: T-172's gate repetitions at four workers (since 00:34Z, 41 min), T-184 Neovim (00:41Z, 34 min), T-178 Neovim (00:58Z), T-179 Neovim (01:12Z). The two waits over 30 min are in order behind the integrated run. No nudge.

### coord · 2026-10-11T02:15:23.695Z

Hourly check 02:15Z. No lost runs: T-178, T-179 and T-186 each have a live `cland suite` worker and runner. T-179 holds the lock. One wait over 30 min: T-186's full run (ticket from 01:41Z, 34 min), first in the FIFO queue. T-178's Neovim-only run follows (02:09Z). No nudge.

### coord · 2026-10-11T04:48:59.522Z

Note (04:48Z): the lock holder's 'since' is the ticket's queue time, not when it took the lock. T-209's holder showed since 04:05Z, but it took the lock at about 04:30Z after T-205's run. This misled a stall check. Suggested fix: holder.json also records 'acquired' (and the phase start). Not an incident.

### coord · 2026-10-11T05:15:19.816Z

Hourly check 05:15Z. No lost runs: six items in review or in progress each have a live process or ticket. T-210 holds the lock (Neovim phase). One wait over 30 min: T-205's Neovim-only run (ticket from 04:33Z, 42 min), first in the FIFO queue. Then T-209 (04:53Z), the integrated dev suite (04:55Z), T-182 (05:06Z), T-180 (05:08Z) and T-185 (05:10Z). Cause: seven queued runs after a wave of three new items, at about 15 min per full run. No nudge; aide-1 is gone, so there is no aide line.

### coord · 2026-10-11T06:15:42.498Z

Hourly check 06:15Z. No lost runs; every item has a live run or ticket. T-182 holds the lock. Waits over 30 min, all in FIFO order: T-205 (ticket from 05:24Z, 51 min, next), T-185 (05:36Z, 39 min) and T-209 (05:43Z, 32 min). The integrated dev Neovim run follows (05:55Z). Cause: queue depth from the post-T-186 wave, at about 15 min per full run. No nudge; aide-1 is gone.

### coord · 2026-10-11T07:15:20.930Z

Hourly check 07:15Z. No lost runs; every open item has a live run or ticket. T-209 holds the lock. Five FIFO tickets wait over 30 min: the integrated dev Neovim run (root, since 05:55Z, 80 min, next), T-174 (06:27Z, 48 min), T-182 (06:31Z), T-191 Neovim (06:36Z) and T-194 (06:36Z). Cause: queue depth. Six full runs went through in the last two hours at about 17 min of hub phase each. T-174 (cut real-time waits) and T-214 (phases by diff) are the fixes. No nudge.

### coord · 2026-10-11T08:15:33.285Z

Hourly check 08:15Z. No lost runs. T-191's Neovim run holds the lock. Waits over 30 min, in FIFO order: T-209 (ticket from 07:33Z, 41 min, next) and T-194 (07:35Z, 40 min). T-188 (07:54Z) and T-174 (08:04Z) follow. Cause: queue depth, about 17 min per full run until T-174 lands. No nudge.

### coord · 2026-10-11T09:15:23.386Z

Hourly check 09:15Z. No lost runs. T-188, T-174, T-217 and T-208 each have a live runner, and T-195 is in progress with no run yet. T-188 holds both locks in its Neovim phase. Its hub phase ran from about 08:56Z to 09:13Z, after T-194's run. Waits over 30 min, in FIFO order: T-174 (ticket from 08:04Z, 71 min, next) and T-217 (08:28Z, 47 min). T-208 (09:01Z) follows. Cause: queue depth, about 17 min of hub phase per full run. T-174 is the fix, and it is itself waiting in the queue. No nudge.

### coord · 2026-10-11T10:15:18.390Z

Hourly check 10:15Z. No lost runs. T-188, T-217 and T-195 each have a live runner. T-174 is waiting on C1, its slow-test inventory, not on a run. T-188 holds both locks; it took them at about 10:11Z. One wait over 30 min: T-217 (ticket from 09:37Z, 37 min, next). T-195's re-run at 5db950d follows (09:59Z). Cause: queue depth. T-208 merged at 09:58Z on the T-213 exception without a retry, which freed one slot. T-174 (merging soon) cuts the hub phase from about 17 min to about 11 min. No nudge.

### coord · 2026-10-11T11:15:27.787Z

Hourly check 11:15Z. No lost runs. T-214 holds both locks; it took them at about 11:07Z after the integrated dev suite, which was green (A-1204). T-166 (ticket from 10:59Z), T-171 (11:11Z) and T-199 (11:11Z, re-queued after a review fix) are queued, all under 30 min. One false positive in my own tooling: a background wait loop matched itself on 'pgrep -f run-suite.ts' and showed up as a phantom suite process in the root checkout. Fixed with a self-excluding pattern. Lesson for any check script: use pgrep -f 'run-suit[e].ts'. No nudge.

### coord · 2026-10-11T12:15:13.569Z

Hourly check 12:15Z. No lost runs. All five open items (T-171, T-166, T-192, T-219, T-221) have a live runner or queue ticket. T-221's 6-worker timing run holds both locks. Two waits over 30 min: the Coordinator's paired dev run (ticket from 11:30Z, 44 min, next, kept right behind T-221 for the timing pair) and T-171 (11:41Z, 34 min). T-166, T-219 and T-192 were cancelled and requeued at 12:12–12:13Z to pick up the shared fix for a defect on dev: T-195's moved-draft tests in nvim/test/artifacts.test.ts fail even alone on dev 1697ced (A-1242), fixed by T-171's 7eb519c, cherry-picked into each branch. Cost: three queue slots and about 40 min of queue position each. No nudge.

### coord · 2026-10-11T13:15:21.979Z

Hourly check 13:15Z. No lost runs. T-221's final run at 4 workers holds both locks. The Coordinator's paired dev run (ticket from 12:22Z, 53 min) is next, right behind it by design. T-166 (12:51Z) and T-219 (13:04Z, re-queued after the PANELS-012 repair d114dc0) follow. T-192's run finished at about 13:13Z: hub 1217/1217, Neovim 276/281, 5 failures, handed to its lead and rev-13 (A-1268). Its lock wait was 2852 s for an 826 s run. No nudge.

### coord · 2026-10-11T14:15:13.741Z

Hourly check 14:15Z. No lost runs. Only one item is open in review: T-192, whose full run holds both locks (ticket from 13:24Z). The Coordinator's integrated dev suite at 405165d (T-171, T-166, T-219) is next (14:07Z). No waits over 30 min, the shortest queue of the day. T-166 and T-219 merged; T-221 closed without a merge (gate not met). No nudge.

### coord · 2026-10-11T15:15:15.720Z

Hourly check 15:15Z. No lost runs. No item is in review or in progress: all of T-108's and T-115's children are closed. The only suite is the Coordinator's integrated dev run at 36a4860 (T-192 and T-223 since the restart). qa-18 is running T-115's epic demo with no suite lock. No waits. No nudge.

### coord · 2026-10-11T16:15:15.062Z

Hourly check 16:15Z. No lost runs. The only item in work is T-225, in progress; impl-225 was launched at 16:11Z and has no run yet. No suite is running or queued. T-224 merged at 16:11Z after a review-fix loop (a8a8da0); T-108 closed on QA at 15:46Z. No nudge.

### coord · 2026-10-11T17:49:12.228Z

Closed with the remedy decided by the Coordinator under D21 (2026-10-11). Lost or late results: covered by T-203/T-208 (the hub posts one result per run) and T-232, cland verify (a hub-owned queue with results tied to tickets). Long waits: T-232 admission plus T-234 (ETA and metrics) and T-215 (shards). Stalled leads: T-222/T-147 (stops classified correctly) and the existing long-idle events. False flags: the Coordinator's own check script (a self-matching pgrep), fixed; moot once T-232 replaces the lock files. No new item. The hourly check continues until the human stops it.

### coord · 2026-10-12T12:33:32.059Z

Incident 2026-10-12 12:32Z (v0.1.2 build): T-289 landed on dev as 71ecabe by the human's override without review or suite; its LaunchPolicy gained `permissions`, and hub/test/roles.test.ts:237's exact-object assertion fails alone on dev 31d6063. Cost: impl-277's corrected census (the T-277 baseline, ~14 min) stopped in the hub phase at roles.test.ts; impl-286's queued verify 0dec3f8d at f3da6a0 inherits the break and is cancelled for a requeue. Recovery: one test-only fix commit by impl-277, cherry-picked into T-283 and T-286 (shared-fix rule); T-289's C3 gap is T-290.

### coord · 2026-10-12T14:15:28.572Z

Incident 2026-10-12 14:16Z, T-277, impl-277: at 13:27:09Z it reported the codex-adapter fix 7cb55c6 and promised "next census will complete without interruption", then went idle; no census process or queue entry of its followed, and the hub's 30-min idle event reached the Coordinator at 14:01Z. Stood still about 49 min (T-268's first slice, the baseline every later slice compares against). Recovery: the Coordinator checked the lock and queue and nudged at 14:16Z. Cause: a Codex turn that ends after describing its next step, the class seen on 2026-10-10 (T-196, T-162).

### coord · 2026-10-12T14:19:03.355Z

Correction to the 14:16Z T-277 entry: not a stall. impl-277's census on 7cb55c6 was running as a hand run on the machine lock and completed at about 14:18Z (hub 1336/1336, Neovim 291/293; the two failures are qa.test.ts's sandbox-exec cases, where the recorder's log open got EPERM). The hub's idle event fired because the session waited on the run. My check misread the verify queue: a hand run on the lock appears as a holder with no session, and the T-283 run that followed hid it. No time was lost; the nudge was unneeded.

### coord · 2026-10-12T15:31:48.205Z

Incident 2026-10-12 15:30Z, integrated dev run 3262aa67 at add6a19 (Coordinator): red on one test, hub/test/claude-code-adapter.test.ts:207 (harness-exited log line read before the hub's asynchronous write; 0 != 1), which passes 3/3 alone. Fourth failure of this class today (codex-adapter :396, codex-adapter recovery read, nvim sessions). Cost: one 14-minute integrated run; dev unreleasable until green. Recovery: T-291 raised into the build and launched (impl-291), fix forward, then a new integrated run.

### coord · 2026-10-12T19:05:57.028Z

Incident 2026-10-12 19:05Z: machine overload from an Implementer's stress proofs running outside the queue. impl-291's T-291 proofs (20 whole-file runs at four workers per file) ran beside the queue's full suites; at 19:05Z 8 spoke-identity test processes and three T-291 hubs sat next to T-278's verify, load ~30. T-285's full run dddc25d7 peaked at load 67, took 1448 s in the hub phase against ~820, and failed one pool test that passes alone. Cost: one 24-minute full run. Recovery: impl-291 told to run stress proofs only when the verify queue has no holder; T-285 allowed one same-head requeue if the test passes alone. Lesson for the briefs: a multi-worker repeated-file proof is suite-weight and takes the machine like one.

### coord · 2026-10-13T20:39:02.001Z

Incident 2026-10-13 20:38Z: integrated dev run f4d2f183 at cf838de was cancelled after 810 s with 1847/1847 tests passing. Cause: the Coordinator edited docs/spec and E-271 in the root mid-run (recording D27), and the merge records of T-332 and T-340 were still uncommitted in the root, so the candidate tree became dirty. Cost: one full run, about 14 min. Remedy applied: committed everything (b4e959d) and resubmitted. Lesson: an integrated run reads the root worktree, so no root file edits, tracker edits included, until it ends. Commit merge records before submitting.

### human · 2026-10-14T01:22:46.246Z

Incident (stand-in, 2026-10-14 01:33Z): the stand-in restarted the hub while impl-361's verify (pid 63646, since 01:20Z) held the queue and one cland droplet was alive for T-345; the restart script ran unconditionally after the queue watcher reported 'still busy'. Hub code at the tip was green (5ba76a49 at 86c1af8). Remedy: the restart step now re-checks the queue and the cland tag immediately before stopping the hub. Coord checks impl-361's run and the droplet lease.

### coord · 2026-10-14T01:55:39.048Z

Incident 2026-10-14 01:54Z: integrated run d80d1b41 at 3dae3b5 failed 1/1589 after 935 s. session-holds.test.ts:215 got assert.ok(dying.pid) as null under a 1-minute load of 25.85. Since T-265, a Claude launch returns before its pid is discovered; the test passes alone. Remedy: T-371 (XS, regression_of T-265), a shared test fix cherry-picked into live branches. Merges are held until a green integrated run includes it. Separately, the stand-in restarted the hub at 01:21:51Z with a non-empty queue; impl-361's run survived and C9's droplet was unaffected.

### coord · 2026-10-14T12:21:50.097Z

Incident 2026-10-14 11:27–12:2xZ: T-359's verify 6a9dce81 hung with no output after 1228 tests. The node --test runner and a child cland-spoke sat at 0% CPU for 55 min while four runs queued behind it. The human noticed at 12:21Z. Remedy: T-385, a per-test timeout plus a stall kill with process-tree reaping.

### coord · 2026-10-14T19:25:08.022Z

Incident 2026-10-14 19:15Z. Integrated cover 15888a54 at ed0ea1b2 (batch T-383, T-429, T-388; A-2525) went red on nvim/test/explorer-card.test.ts:243 ('card T-11 expects fallback human picture / no row under the cursor'). Peak load was 16 beside the E-272 QA targeted files. Run alone it failed 1 time in 5 at the same head, so it is a dev defect under the shared-fix rule. Filed as T-439 (a regression of T-352). The cover reruns after T-439 merges.

### coord · 2026-10-14T20:25:42.510Z

Incident 2026-10-14 19:40Z: the Coordinator's Claude Code process (pid 78885) died at 19:40:02Z. The hub relaunched it at once (pid 80093, same conversation), but the row stayed 'exited' for 43 minutes (T-372 recurrence), so deliveries to coord sat in limbo until the stand-in ran `cland session resume coord` at about 20:23Z. Lost: integrated cover c4087bf8 at a642d6d1, cancelled with 'requester died before admission'. Delayed: the T-385 merge (ready 20:15Z) and the cover resubmission.

### coord · 2026-10-14T21:26:59.804Z

Incident 2026-10-14 21:12Z: integrated cover 9484455a at 039421e7 (A-2562) went red on hub/test/session-holds.test.ts:160 ('no channel event matched within 5000ms'). Its Neovim phase did not run. Run alone, the file failed 1 time in 5. Caveat: T-385 merged during that series, so those runs were at a mix of 039421e7 and e6c0af0a. That makes it a dev defect under the shared-fix rule, filed as T-441 (a regression of T-398). The cover reruns after T-441 merges.

### coord · 2026-10-15T00:52:28.457Z

Incident 2026-10-15 00:49Z: integrated cover 55432184 at 131b7629 (A-2627) went red on nvim/test/artifact-browser.test.ts:216 (ECONNREFUSED on nvim.sock, peak load 18.6). Run alone it passed 5/5 at the same head, in a detached worktree, so the flaky rule applies: the bug is filed and the cover gets one resubmit.

### coord · 2026-10-15T01:25:44.371Z

Incident 2026-10-15 01:19Z: integrated cover 4b6c160f at a3c8098a (A-2633), the resubmit, went red on a different test, session-stop-races.test.ts:147 (ENOENT on probe.json, peak load 17.7). Alone it passed 5/5, filed as T-449. Root cause of the run of red covers: 'one targeted file at a time' was kept per session, so about six files ran beside each full run. The machine-wide cover-quiet rule was posted at 01:20Z.

### coord · 2026-10-15T09:21:12.384Z

Incident 2026-10-15 09:14:40Z: hub outage of about 4.5 min. T-253's fail-fast exited the hub on the 5 s stall-warning threshold during a 'planned check' on T-467, under load, while I was making a burst of tracker edits filing E-482. Two restarts at 09:16 died on the same 5 s stall (planned check on T-442). The stand-in's 09:18–09:19Z start, with CLAND_TEST_TRACKER_STALL_MS=60000 as a temporary mitigation, is the live one (pid 21598). Tracker edits are intact. Droplet cland-v0-cd1c2e75 was released cleanly (lease-released record, 0 leases, 0 tagged), and every session row reattached. Hotfix: T-483 (impl-483). Lesson: a fail-fast must have its own deadline, well above the warning threshold.

### coord · 2026-10-15T09:35:18.691Z

Lost run from the 09:14Z outage: T-454's verify 7a4f3460 at bdcddc3c (started 09:04:47Z) exited 1 after 10 min without a machine-shard summary (A-2832). It straddled the hub's fatal exit and restart. The Coordinator authorized one fresh run that is not counted as the flaky-rule resubmit.
