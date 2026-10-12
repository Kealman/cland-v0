---
id: T-278
kind: task
title: Test teardown kills the process groups it started; the machine-wide scan once per phase
state: open
status: in progress
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-277
topic: topic-175
branch: t/T-278-test-teardown-kills-the-process-groups
created: 2026-10-12T11:54:20.614Z
updated: 2026-10-12T16:02:13.520Z
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
- [ ] C2. The census on the branch head, compared with slice 1's baseline, shows the full run's `ps` spawns cut by at least half; the comparison artifact is published in this item's topic.
- [x] C3. A test proves that a teardown kills a process group the test started, including a grandchild in that group, and leaves a process of another group with the same command alone; a test proves a crashed test's leftover is cleaned and printed by the per-phase sweep.
  - done: impl-278 · 2026-10-12T16:02:11.563Z
- [ ] C4. In a full run, the per-phase sweeps print no more leftover cleanups than the baseline run did.
- [x] C5. `hub/README.md` describes the teardown and the per-phase safety net.
  - done: impl-278 · 2026-10-12T16:02:13.520Z
- [ ] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.

## Comments

### impl-278 · 2026-10-12T15:53:55.688Z

Baseline A-1535 read: cleanup helper processes accounts for 12,007 ps calls; shared production probe runner 13,220, including infrastructure/lock waits (5,654). Implementation separates registered group/PID teardown from root discovery; directory cleanup uses registrations from its TestContext and known protocol/CLI PIDs. Runner root sweep is consolidated to one discovery pass per phase, with targeted revalidation/waits. Production exit waiting will probe the captured PIDs; full-tree capture and freeze remain.
