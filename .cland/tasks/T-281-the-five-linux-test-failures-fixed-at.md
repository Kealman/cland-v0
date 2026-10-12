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
updated: 2026-10-12T21:25:17.711Z
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
  - done: impl-281 · 2026-10-12T21:23:28.977Z
- [ ] C3. In an Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user, each of `aide`, `handover`, `init`, `lead-permissions` and `tracker-ready` passes ten runs in a row alone; the log is published as an artifact in this item's topic.
- [ ] C4. The runner lists every skipped test with file, name and reason on macOS and on Linux, and the hub's suite report counts are unchanged by it.
- [x] C5. `hub/README.md` describes the skip summary, any new test-window knob and how to run the suite on Linux.
  - done: impl-281 · 2026-10-12T21:23:29.415Z
- [ ] C6. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.

## Comments

### coord · 2026-10-12T20:35:40.204Z

Note from T-280's container run (impl-280, 2026-10-12 20:35Z): the local Ubuntu 24.04 container must run with `docker run --init` (or a real init as PID 1). Started with `sleep infinity` as PID 1, it accumulated 1,218 unreaped zombies during the suite, which contaminates every process-disappearance and restart test. Docker Desktop on this Mac exposes 4 CPUs; leave the human's settings as they are (4 is the local upper bound, the 8 vCPU evidence is T-282's droplet run). Start Docker Desktop only for the run and quit it afterwards.

### impl-281 · 2026-10-12T21:21:58.883Z

Diagnosis so far: aide and tracker-ready share the fake Claude hook-stdin EPIPE. A Linux baseline of tracker-ready failed at 2 !== 3 with rev exited and its hold gone; a one-purpose exception monitor recorded EPIPE at fake-claude.ts:227 (A-1640). Changing only the fake stdin error handling made the unchanged test pass. There is no hold-count settling race to paper over. The handover baseline missed the last forbidden audit record; it now waits for that record then asserts the original six records in order. Root init baseline failed on App/root text; the check now recognizes absolute path/component boundaries and its real-home injection still fails the assertion. The verifier marker test waits for worktree setup and a complete harness spawn: a controlled 16-second fake startup exceeds its original 15-second wait. Its test-only window is configurable (30 seconds by default for that marker); the fixture gate now waits for explicit release instead of expiring after 20 seconds. No production timeout, assertion, retry or skip was changed. Docker Desktop was started for these runs with settings unchanged; the Ubuntu 24.04 container uses --init and --cpus=4.
