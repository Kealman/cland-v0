---
id: T-278
kind: task
title: Test teardown kills the process groups it started; the machine-wide scan
  once per phase
state: closed
status: done
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-268
blocked_by:
  - T-277
topic: topic-175
branch: t/T-278-test-teardown-kills-the-process-groups
created: 2026-10-12T11:54:20.614Z
updated: 2026-10-12T19:20:04.447Z
closed: 2026-10-12T19:20:04.622Z
---

## Summary

Every test teardown today lists the whole machine's processes (and, on macOS, every process's working directory) to find what the test left behind. This ticket makes a teardown kill only the process groups the test started, verified by identity, and keeps one machine-wide scan per phase in the runner as the safety net, so the suite's `ps` spawns drop by at least half.

## Parent

T-268: Suite spend and Linux portability. Realises T-267 (the suite's spend) under epic T-268, slice 2 of 6. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor").

## What to build

The test helpers track what they start and clean it up without scanning the machine.

- **Today.** The test helpers register ownership with `ownDirectory` (every `tempProject`) and `ownProcess` (`startDaemon`, `spawnSpoke`, the fake harnesses, the Neovim harness), both in `hub/test/process-cleanup.ts`. Each teardown runs `cleanupProcesses`, which lists every process on the machine with `ps ww -axo …`, on macOS reads every process's cwd with `lsof` for a directory sweep, lists the machine again to revalidate, then polls `ps -p` until the targets are gone. The runner (`hub/test/run-suite.ts`) and `hub/src/suite-lock.ts`'s `sweep` also clean after each phase.
- **After.** A helper that starts a process records its process group and the leader's start identity at spawn, as it records the pid today. A teardown signals those groups (and the recorded pids that are not group leaders) after verifying the recorded identities with one targeted probe of exactly those pids, never a listing of the whole machine; it waits for them to go with targeted probes only. Processes the hub starts for a test (the daemon's harness sessions and their children) are found the same way where the test can know them through the protocol or the hub's own records, without a new seam inside the hub; whatever a test still misses is left to the per-phase sweep, which reports it. A directory teardown (`ownDirectory`) removes the directory after its owned groups are gone; it no longer reads every process's cwd.
- **The safety net.** The runner's machine-wide scan runs once per phase, after the phase's test process exits, as it does today, and keeps its ownership proofs (start identity, cwd containment in the run root, ancestry, the run marker as a hint only). It prints every process it cleans, so a leak a teardown missed stays visible.
- **The hub's own probes.** If the census of slice 1 shows that a large share of the `ps` spawns comes from production code exercised by the tests (for example a polling loop in `hub/src/system-processes.ts` that lists the whole machine every 50 ms while it waits for a process tree to exit), apply the same principle there: probe the captured pids, not the machine. This production change is in scope (the Coordinator's decision of 2026-10-12). Production semantics (identity checks before each signal, the freeze before SIGKILL, protection of the hub and its ancestors) stay exactly as they are; say in the item what was cut and why.
- **Measure.** Run the census of slice 1 on the branch and compare it with the baseline through the census's comparison; publish the comparison as an artifact in this item's topic.
- **Doc.** `hub/README.md`'s paragraphs on test teardown say what a teardown kills now, that the per-phase scan is the safety net, and how a leak shows up in the runner's log.

Demo, as the epic words it: the census after the change shows the `ps` count cut by at least half, with the suite green through `cland verify`.

Out of scope: the `ps` dialect (slice 4: keep the current `ps` forms; do not set `PS_PERSONALITY`); the fixture repository (slice 3); any change to what a test asserts.

Constraints:
- The epic's risk applies: group tracking must not leave orphans when a test crashes; that is why the per-phase scan stays. A teardown never signals a group unless its leader and every member it signals are verified as the test's own, as today.
- Tests go through the hub's frame protocol first and the fake harnesses second; no new seams inside the hub.
- The census run takes a queue slot like any suite run. Suites for review run through `cland verify`. Commit on the task branch, push to `origin`; `dev` only through `cland merge`. English everywhere.

## Acceptance criteria

- [x] C1. No test teardown lists every process on the machine or reads every process's cwd; only the runner's per-phase sweep does, once per phase (a Reviewer can check the call sites; a test proves that a teardown spawns no machine-wide listing).
  - done: impl-278 · 2026-10-12T16:02:10.274Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-2 · 2026-10-12T19:03:25.632Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
- [x] C2. A complete census on the branch, compared with slice 1's baseline (A-1535), records the full run's `ps` cut with the remaining sources named; the comparison artifact is published in this item's topic. The halving target moves to the combined result of T-278 and T-279, judged on T-279's census and on the epic's criterion (the Coordinator's decision of 2026-10-12: A-1580 shows 28,888 → 17,147, a 40.6% cut, and no further cut is safe without weakening an identity check).
  - done: impl-278 · 2026-10-12T18:42:39.899Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-2 · 2026-10-12T19:03:25.633Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
- [x] C3. A test proves that a teardown kills a process group the test started, including a grandchild in that group, and leaves a process of another group with the same command alone; a test proves a crashed test's leftover is cleaned and printed by the per-phase sweep.
  - done: impl-278 · 2026-10-12T19:00:46.558Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-2 · 2026-10-12T19:03:25.633Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
- [x] C4. In a full run, the per-phase sweeps print no more leftover cleanups than the baseline run did.
  - done: impl-278 · 2026-10-12T17:55:39.028Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-2 · 2026-10-12T19:03:25.633Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
- [x] C5. `hub/README.md` describes the teardown and the per-phase safety net.
  - done: impl-278 · 2026-10-12T16:02:13.520Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-2 · 2026-10-12T19:03:25.633Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c
- [x] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
  - done: impl-278 · 2026-10-12T19:19:13.828Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-278-3 · 2026-10-12T19:19:34.927Z · commit ea9a08da862f09a3a2c4cef7f991f3874323698c

## Comments

### impl-278 · 2026-10-12T15:53:55.688Z

Baseline A-1535 read: cleanup helper processes accounts for 12,007 ps calls; shared production probe runner 13,220, including infrastructure/lock waits (5,654). Implementation separates registered group/PID teardown from root discovery; directory cleanup uses registrations from its TestContext and known protocol/CLI PIDs. Runner root sweep is consolidated to one discovery pass per phase, with targeted revalidation/waits. Production exit waiting will probe the captured PIDs; full-tree capture and freeze remain.

### impl-278 · 2026-10-12T17:59:10.700Z

Full census at f32605f is A-1580: 17,147 ps vs baseline 28,888, all three phases completed; zero phase cleanups vs baseline two (C4 done). Nvim prompt-draft case timed out under peak load 26.11 and passed unchanged alone; Coordinator accepts it as a load flake, counts stand. C2 remains short of 50%. Final cuts only avoid already-absent registered cleanup probes and reuse a successful current-process identity in acquireLock’s own ownership record, matching acquireLockAsync’s existing self cache. Guard: no foreign PID is cached; processStarted/processStartedAsync and every foreign-PID probe before a signal remain fresh. Full targeted ancestor protection is retained. If census three remains short, I will report the remaining sources for the Coordinator’s decision rather than cut any safety check.

### impl-278 · 2026-10-12T18:42:42.253Z

Coordinator revised C2: complete comparison and named remaining sources satisfy this slice; halving belongs to combined T-278 + T-279 and the epic criterion. A-1580 is the completed census (17,147 ps, 40.6% reduction, zero phase leftovers). Final guards do not materially increase counts; A-1589 documents the third incomplete measurement and its added queue probes, remaining production/cleanup/lock sources. No further identity checks will be cut. Third machine-phase failure tracker-criterion-write.test.ts:86 reproduces alone on 0bb69b2 (A-1590); clean-dev 37a6a23 reproduction is running to distinguish a dev defect from this branch.

### rev-23 · 2026-10-12T18:50:56.129Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-278-1
commit: b2205d4529b35a8466875ac55ba95acc98b6266a

Medium: hub/src/system-processes.ts:125 polls only owned.keys during TERM grace, removing old inspect/extend coverage. L can fork C while alive during grace, then exit; C never enters owned, remaining becomes empty and termination reports success without freeze/KILL. Existing late-child test only forces escalation while L remains alive.
Medium: hub/test/process-cleanup.ts:250 drops an absent registered leader before querying its captured group; live reparented members are left running and ownDirectory removes their fixture. Preserve targeted group coverage and individually verified survivors without trusting a missing/reused leader or signalling unrelated members.
C2 revised census evidence checked: A-1580 28,888→17,147 ps (40.643%), C4 zero phase cleanup vs baseline two. Own-lock-only cache and fresh pre-signal/ancestor/freeze guards inspected; C1 call sites and C5 docs read. Ordinary C6 full verify pending; A-1589 incomplete not C2 evidence. Source traces/regression expectations A-1594: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1594-t-278-review-late-child-and-exited-leader-ownership-gaps.md.

Criteria: C3 failed (Registered group cleanup drops an already-exited leader before probing its surviving reparented children and may remove their fixture while they run.), C6 failed (Targeted production grace waits cannot capture children born after TERM; graceful leader exit can report success with a surviving child.).

### impl-278 · 2026-10-12T19:00:50.434Z

Addressed review A-1594 in ea9a08d: production grace waits use bounded targeted parent discovery then current parent/start proofs and existing reservation capture; observed late children/grandchildren survive graceful parent exit only until verified cleanup. Dead registered leaders retain targeted group coverage; cwd under an inode-owned fixture plus fresh member identity/group checks prove reparented survivors, signalled individually without an absent leader's group authority. Reused-parent children, unrelated group members, replacement leaders and protected/older groups remain safe. Red regressions reproduced both findings, then cleanup21/21, production24/24, runner45/45 and stop-races14/14 passed, typecheck green. No safety assertions removed or retries/skips added. Fresh origin/dev fetch+merge up to date37a6a23, pushed ea9a08d. Superseded C6 run cancelled (A-1595); new review/full verify follows.

### rev-23 · 2026-10-12T19:03:25.633Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-278-2
commit: ea9a08da862f09a3a2c4cef7f991f3874323698c

No remaining high/medium source findings. Grace selected-descendant walk plus current parent/start proof retains late child/grandchild after graceful parent exit; reused parents do not confer ownership. Dead registered leaders retain targeted group/cwd proof; original live leader required for negative group signals, otherwise verified survivors get positive-PID signals. Fresh pre-signal, ancestors, reservations/authority and freeze retained. A-1596 regressions/logs green: cleanup21, production24, runner45, stop-races14; typecheck passes. C1–C5 checked, revised C2/C4 complete A-1580 comparison retained. C6 unverified pending ordinary full exact-head result; source objection resolved, no full-green claim. A-1597: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1597-t-278-ownership-re-review-clear-at-ea9a08d-c6-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### impl-278 · 2026-10-12T19:19:14.146Z

C6 completed through ordinary cland verify all run d5aaf623-1ddb-4f63-827a-a4980c3b1da4 at exact pushed review head ea9a08da862f09a3a2c4cef7f991f3874323698c: exit0, 1670/1670 passed, zero fail/cancelled/skipped/todo. Full typecheck and all three phases passed; artifact A-1602. Suite duration791.93s, queue238.67s, peak load31.07. Head remains unchanged and worktree clean. C1–C5 already verified by rev-23; C6 marked done and final verification requested.

### rev-23 · 2026-10-12T19:19:34.928Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-278-3
commit: ea9a08da862f09a3a2c4cef7f991f3874323698c

No remaining high/medium findings. C1–C5 assessment A-1597 retained; C6 now established by ordinary full verify d5aaf623/A-1602 at unchanged exact head: typechecks pass, 30/30 hub free +1341/1341 machine +299/299 Neovim =1670/1670; zero failures/cancellations/skips/todos, exit0. Both ownership regressions, phase crash cleanup, and own-lock/fresh foreign PID guards pass. Final phase cleanup count zero vs baseline two. Revised C2 complete A-1580 comparison retained; no halving claim for this slice. A-1603: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1603-t-278-final-review-full-green-at-ea9a08d.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-12T19:20:04.447Z

Merged dfd32cbbeb61b02e3d3dc03bf3266be1498070ce onto dev.
