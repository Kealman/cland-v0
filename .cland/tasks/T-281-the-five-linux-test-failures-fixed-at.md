---
id: T-281
kind: task
title: The five Linux test failures fixed at their cause; platform skips listed by reason
state: open
status: review
criterion_seq: 6
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-279
  - T-280
topic: topic-181
branch: t/T-281-the-five-linux-test-failures-fixed-at
created: 2026-10-12T11:54:20.772Z
updated: 2026-10-13T01:00:22.705Z
---

## Summary

With the listing portable, five tests still fail on Linux in the T-256 prototype: a fake harness that dies on `EPIPE`, a handover test that reads the audit log too early, an init check that is wrong when run as root, and two tests that run out of time under load. This ticket fixes each at its cause, never with a retry, and makes the runner list every platform skip with its reason on every platform.

## Parent

T-268: Suite spend and Linux portability. Realises T-266 (the hub and the suite portable to Linux) under epic T-268, slice 5 of 6. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor").

## What to build

Each failure as T-266 and the prototype's research note diagnose it (`docs/research/remote-executor.md` on `prototype/remote-executor`, read with `git show`):

- **The fake's hook stdin.** `hub/test/fakes/claude-code/fake-claude.ts` writes each settings hook's payload to the hook's stdin with nothing listening for `'error'` on that stream; when the hook (`sh -c`, which is the fast `dash` on Ubuntu) exits before reading, the `EPIPE` is an uncaught exception and the fake session dies (`hub/test/aide.test.ts`, "cland init writes the Aide defaults and CLI launches several Aides", failed 4 of 6 alone on Linux). The fake handles the error on the hook's stdin as Claude Code does: a hook that did not read its payload still runs to its exit code, logged as today.
- **The handover audit line.** `hub/test/handover.test.ts`, "a handover without a complete note is refused…", reads `.cland/log/hub.log` as soon as the refused `role.handover` returns, while the hub writes that audit line asynchronously. The test waits for the expected audit records (the file already does this elsewhere with `eventually`), asserting the same records in the same order.
- **The root-safe init check.** `hub/test/init.test.ts`, "cland init on an empty repository: … no machine path in it", asserts that no committed file contains `homedir()`; as root that is `/root`, which a shipped skill's text contains as part of "App/root". The check asserts what it means: no committed file names the home directory as a path (a path boundary on both sides), so it holds for `/root` and for any `/home/<user>`, and it still fails if a file names the real home directory.
- **The load-sensitive tests.** `hub/test/lead-permissions.test.ts` ("a verifier spawned while its item leaves the Lead subtree is refused and cleaned up", a 15-second wait for the fake verifier timed out at a load of 8 to 10 on 8 vCPUs) and `hub/test/tracker-ready.test.ts` ("restart reconciles a stop recorded before queued hold cleanup…", `2 !== 3`) pass alone and fail under the full run. Find each one's cause first. Where the cause is a wait that is too short for a loaded machine, the test gets the time through a configurable test window (the T-174 knobs shorten production windows and the failure deadlines such as `eventually`'s 15 seconds are hard-coded today, so this means a test-only knob documented in `hub/README.md` beside the existing ones, with no production default changed); where the cause is an ordering race (a count read before the state it counts has settled), the test waits for the state, as the handover fix does. Never a retry, and no assertion loosened.
- **The platform skips.** The runner's summary lists every skipped test with its file, name and reason on every platform (today: the four macOS `sandbox-exec` cases, the real `opencode` binary when absent, the `skills-qa` recover case when run as root, and any skip of the Neovim or `jq` prerequisites). As an ordinary user on Linux that is five skips, or four with `opencode` installed; the count is not fixed, the reasons are. The summary must not use the line shapes the hub's suite report already counts (`# skipped N`, `ℹ skipped N` in `hub/src/hub/suites.ts`), so no count is doubled.
- **Linux.** Iterate in a local Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user with a home under `/home`, no `PS_PERSONALITY` and no `CLAND_TEST_*` variable set.
- **Doc.** `hub/README.md`'s Tests section: the skip summary, the new test-window knob if one is added, and a short "Running the suite on Linux" note (Ubuntu 24.04 packages, Node and the pinned Neovim, an ordinary user, nothing added to the login environment).

Demo, as the epic words it: each of the five failing files passes ten runs in a row alone in the Linux container.

Out of scope: the full run on a droplet (slice 6); the remote executor; changing what any of these tests checks.

Constraints:
- The five failures are fixed at their cause; no retry, no skip, no longer production timeout. A test-window knob is test-only.
- Tests go through the hub's frame protocol first and the fake harnesses second; no new seams inside the hub.
- Suites for review run through `cland verify`. Commit on the task branch, push to `origin`; `dev` only through `cland merge`. English everywhere.

## Acceptance criteria

- [x] C1. The fake Claude session survives a hook that exits before reading its stdin; a test reproduces that hook on macOS and proves the session keeps answering.
  - done: impl-281 · 2026-10-12T21:22:45.572Z
- [x] C2. The handover test waits for its audit records; the init test is root-safe and still fails when a committed file names the real home directory (shown by a test or a recorded check); each load-sensitive test's cause is named in the item and fixed by a wait for state or a test window, with no retry and no loosened assertion.
  - done: impl-281 · 2026-10-12T21:28:49.130Z
- [x] C3. In an Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user, each of `aide`, `handover`, `init`, `lead-permissions` and `tracker-ready` passes ten runs in a row alone; the log is published as an artifact in this item's topic.
  - verified: rev-26 [reviewer] · run rev-20261013-281-linux · 2026-10-12T23:44:26.116Z · commit 336f125c78080c444f1f2e8e74460df6f5f6d1f9
  - done: impl-281 · 2026-10-12T23:44:36.895Z
- [ ] C4. The runner lists every skipped test with file, name and reason on macOS and on Linux, and the hub's suite report counts are unchanged by it.
- [x] C5. `hub/README.md` describes the skip summary, any new test-window knob and how to run the suite on Linux.
  - done: impl-281 · 2026-10-12T21:23:29.415Z
- [x] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
  - done: impl-281 · 2026-10-12T22:08:10.489Z
  - verified: rev-26 [reviewer] · run rev-20261013-281-host · 2026-10-12T22:08:12.908Z · commit 0e80988b97f73a9f052954d34b68e974c72bf625

## Comments

### coord · 2026-10-12T20:35:40.204Z

Note from T-280's container run (impl-280, 2026-10-12 20:35Z): the local Ubuntu 24.04 container must run with `docker run --init` (or a real init as PID 1). Started with `sleep infinity` as PID 1, it accumulated 1,218 unreaped zombies during the suite, which contaminates every process-disappearance and restart test. Docker Desktop on this Mac exposes 4 CPUs; leave the human's settings as they are (4 is the local upper bound, the 8 vCPU evidence is T-282's droplet run). Start Docker Desktop only for the run and quit it afterwards.

### impl-281 · 2026-10-12T21:21:58.883Z

Diagnosis so far: aide and tracker-ready share the fake Claude hook-stdin EPIPE. A Linux baseline of tracker-ready failed at 2 !== 3 with rev exited and its hold gone; a one-purpose exception monitor recorded EPIPE at fake-claude.ts:227 (A-1640). Changing only the fake stdin error handling made the unchanged test pass. There is no hold-count settling race to paper over. The handover baseline missed the last forbidden audit record; it now waits for that record then asserts the original six records in order. Root init baseline failed on App/root text; the check now recognizes absolute path/component boundaries and its real-home injection still fails the assertion. The verifier marker test waits for worktree setup and a complete harness spawn: a controlled 16-second fake startup exceeds its original 15-second wait. Its test-only window is configurable (30 seconds by default for that marker); the fixture gate now waits for explicit release instead of expiring after 20 seconds. No production timeout, assertion, retry or skip was changed. Docker Desktop was started for these runs with settings unchanged; the Ubuntu 24.04 container uses --init and --cpus=4.

### rev-26 · 2026-10-12T21:26:24.711Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261012-281-1
commit: 8ee27aa737710137a0cfcd923a509641a989e364

Medium: hub/test/handover.test.ts:213 polls hub.log after role.handover without awaiting and asserting hub.status with flushLogs:true, contrary to the standing T-291 rule; file polling retains a bounded asynchronous-log race. Await the barrier and retain the ordered six-record assertion. No additional material code finding. C1/C5 code and focused evidence checked; C3/C4/C6 remain unverified pending platform proof artifacts and ordinary macOS cland verify evidence. Review evidence published in this topic.

Criteria: C2 failed (handover.test.ts:213 reads hub.log without awaiting the required successful hub.status flushLogs barrier.).

### impl-281 · 2026-10-12T21:28:50.551Z

Review fix: 0aa2b498 asserts the hub.status flushLogs:true frame before every handover audit read, retaining the exact records and wait. Focused refusal passes on macOS and Linux. The 8ee27aa proof batch was intentionally stopped after aide's ten consecutive green runs to replace the candidate; no failure was retried and C3 was not marked done. The revised full batch will run at 0aa2b498 when the integrated dev suite releases the machine slot. Docker Desktop was quit during that wait; it will be started again only for my remaining runs, with 4 CPUs unchanged and --init.

### impl-281 · 2026-10-12T21:43:08.455Z

Docker lifecycle correction: AppleScript quit had left the backend alive, so I cleared its stalled shutdown via docker desktop stop --force, then docker desktop start completed. docker info confirms 4 CPUs; settings unchanged. A queued wrapper timed out during that lifecycle transition before starting any Linux test. The candidate remains 0aa2b498, and I am waiting for T-291's targeted merge proof to release the actual machine slot before starting the revised proof batch.

### impl-281 · 2026-10-12T21:54:00.839Z

Blocked platform evidence: the Coordinator-authorized restart also exited 137 externally after five consecutive aide runs passed 7/7. Both owner records still named PID 45702/token tSRH51LX0x8UkQ; Docker remained running, OOMKilled:false. No third hand-run batch is being started. The Coordinator stopped hand-run admission until T-309 diagnoses the live-holder kills, instructed me to stop the container and Desktop, and authorized the ordinary queued C6 macOS cland verify all run. The T-281 implementation patch is unchanged at 0aa2b498; C3 and C4 remain pending.

### impl-281 · 2026-10-12T21:55:53.795Z

C6 ordinary host run: 9737b169-bc56-40ae-9a4f-c9ffeb2b31ae submitted at pushed merge head 0e80988 after fetching and merging origin/dev; worktree clean. The handover merge conflict retained the asserted flushLogs barrier and exact-record wait. Result addressed to rev-26 and impl-281. Docker/container stopped. Corrected final interruption log is A-1656: aide ten rounds, handover five rounds plus partial sixth; A-1657 explains that Docker exec outlived the killed host supervisor and continued writing. The whole interrupted batch is excluded, and C3/C4 remain blocked on T-309.

### impl-281 · 2026-10-12T22:08:12.773Z

C6 complete: ordinary macOS cland verify all run 9737b169-bc56-40ae-9a4f-c9ffeb2b31ae at 0e80988 passed 1685/1685, fail 0, skipped 0, duration 720.04 s. Log A-1661; each phase emitted suite skip details 0 without count duplication. Linux C3/C4 remain blocked until T-309 lands and the Coordinator hands the machine back; Docker Desktop is stopped.

### impl-281 · 2026-10-12T22:33:24.838Z

T-309 integrated: fetched/merged origin/dev through 92a0f50 into task head b79b11d; no conflicts, implementation hunks unchanged. The runner now publishes startedUtc while preserving the skip reporter and phase behavior. Candidate bundle prepared. Per Coordinator order, no hand run starts until the hub restarts on the fix and T-291 finishes its remaining merge stress rounds; Docker stays stopped.

### impl-281 · 2026-10-12T23:21:20.132Z

Refreshed and pushed 336f125 after merging origin/dev, including T-309 UTC lease identity and T-310. No task-hunk change or conflict. Combined Linux driver prepared: holds both host leases across ten solo runs per file and the container full run, publishes the proof log, then quits Docker. Coordinator order: wait for T-303's resubmitted ordinary run to finish, do not take its cancellation gap; T-281 then owns both Linux phases, and announces the end to Coordinator, impl-304 and impl-291.

### impl-281 · 2026-10-12T23:44:37.533Z

C3 complete in A-1687: all five files passed ten consecutive whole-file solo runs (fifty runs total) at336f125, one file at a time, ordinary /home/runner user, --init,4 local CPUs, no test/ps overrides. Started23:31:53Z, finished23:43:48Z. No failure, skip, cancellation or retry; prior interrupted batches excluded. The container full phase now runs at the same candidate under the retained joint host leases.

### impl-281 · 2026-10-12T23:48:43.282Z

Container full preflight A-1689 passed typecheck but refused recovery of two dead lease owners inherited from the copied T-280 image: saved run-root device/inode identity differed after the Docker snapshot. Corrected only private container lease files and their advertised dead roots after confirming both owner PIDs absent; no host lease or repository code changed. Owner/stat correction evidence published. Container/Desktop stopped during the wait for T-304's admitted run. Fetched/merged origin/dev4e75311, pushed full candidate6255631. C3 proof A-1687 at336f125 remains complete and verified; only full phase resumes.

### impl-281 · 2026-10-13T00:10:15.835Z

Container full phase at 6255631 finished with one failure outside the five original files: cli-identity.test.ts:95 reads hub.log without a flush barrier; the forbidden hub unmute audit is absent. T-291 b0fc308 adds the barrier to this exact helper. A-1698 preserves full output: free30/30,machine1367 tests1351pass1fail15skips, each with file/name/reason. Neovim did not run because hub failed. No rerun. Container stopped and Docker Desktop quit. C3 remains completed in A-1687; C4 coverage and refreshed final-head C6 pending.

### impl-281 · 2026-10-13T00:10:54.242Z

Coordinator decision: A-1698's single failure is the T-291 audit-log barrier class, fixed in its b0fc308 cli-identity helper. Wait for T-291 to merge into dev; then merge origin/dev without copying its hunk, take one protected all-phase container run, and follow with ordinary macOS cland verify all for refreshed C6. Do not repeat C3's 50 solo runs. The first full fixture lacked the documented jq prerequisite (12 of 15 existing skips); install jq in the private fixture before the corrected all-phase run. Docker remains quit while waiting.

### impl-281 · 2026-10-13T00:39:05.426Z

Coordinator-directed shared dev fix e215e534 was cherry-picked unchanged after fetching origin and pushed as 270bdd8. It changes only layers.test.ts's gn wait to include the existing exclusion before screen capture; assertions remain unchanged. No test/suite launched. Awaiting T-291 dev merge before the protected container all-phase run and refreshed ordinary macOS C6.

### impl-281 · 2026-10-13T01:00:14.581Z

Merged published origin/dev b48bba2 including T-291's flush barriers and T-304, pushed fba1599. The shared layers wait cherry-pick merged identically. Refreshed review request sent. Coordinator requires T-307's queued full run to finish and the stand-in's empty-queue hub restart before my Linux handoff. No hand run admitted; Docker remains stopped.
