---
id: T-280
kind: task
title: One process listing that both the BSD and the procps ps accept
state: open
status: backlog
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-278
topic: null
branch: null
created: 2026-10-12T11:54:20.717Z
updated: 2026-10-12T11:54:39.355Z
---

## Summary

On Linux, `npm test` dies 1.4 seconds in because the runner's sweep lists processes with the BSD form `ps ww -axo …`, which procps rejects ("must set personality to get -x option"), and the hub's own `hub/src/system-processes.ts` makes the same call. This ticket gives the hub and the test cleanup one listing that both `ps` dialects accept, covered by a test of both dialects, so the suite runs past its first phase on Ubuntu 24.04 with no `PS_PERSONALITY`.

## Parent

T-268: Suite spend and Linux portability. Realises T-266 (the hub and the suite portable to Linux) under epic T-268, slice 4 of 6. Spec: docs/spec/v0.1.2.md §3.14 ("Before the executor").

## What to build

One way to list processes, the same on macOS and Linux.

- **Where.** `hub/src/system-processes.ts` (the whole-table listing behind `endProcess` and the orphan sweeps) and the test cleanup in `hub/test/process-cleanup.ts` (its whole-table and per-pid listings, as slice 2 left them). The other forms the code uses (`-o lstart= -p`, `-o stat= -p`, `-o command= -p`) already print the same on both dialects, per the T-256 prototype; keep them unless the census or a test says otherwise. The environment read for run markers keeps its existing split: `/proc/<pid>/environ` on Linux, `ps eww` on macOS.
- **How.** List with the POSIX selection and output options both dialects accept (all processes, or the given pids; the columns pid, parent, group, start time, state and the full command line, never truncated), as the epic's choice says. Read `/proc` on Linux only where a column needs it (for example if procps cannot print the full command line or the start time in the shape the parser needs). Nothing sets `PS_PERSONALITY`, in code or environment. Parse one format: one parser shared by, or identical in, both places, keeping today's rules (zombies dropped; the hub's own pid must appear, or the table is refused as unverifiable; start times normalised so a recorded identity compares equal across the two listings and across `processStarted` in `hub/src/hub/lock.ts`).
- **The test.** Recorded output of the new listing from macOS `ps` and from procps-ng 4.0.x (Ubuntu 24.04), including a long command line, a command line with spaces and quotes, a zombie and a start time with a single-digit day, is parsed to the same rows; and on whichever platform the test runs, the real `ps` lists the test's own process and a child it starts, with identities that match `processStarted`. Update the existing fake `ps` boundaries the change affects (for example the fake in `hub/test/system-processes.test.ts` keys on the old `-axo` argument) without weakening what they check.
- **Linux.** Iterate in a local Ubuntu 24.04 container limited to 8 CPUs, running as an ordinary user with a home under `/home`. Run `npm run typecheck && npm test` there once and keep its log.
- **Doc.** `hub/README.md` names the listing's form and that it holds on macOS and Linux, where it says cleanup uses `ps` plus `lsof` on macOS and `/proc` on Linux.

Demo, as the epic words it: `npm test` on Ubuntu 24.04 runs past its first phase with no `PS_PERSONALITY`. (The five test failures of T-266 may still fail here; they are slice 5.)

Out of scope: the five Linux test failures and the skip summary (slice 5); the droplet run (slice 6).

Constraints:
- Production semantics of `endProcess` and the sweeps do not change: identity is verified before every signal, the hub and its ancestors are protected, a table that cannot be verified is refused.
- Tests go through the hub's frame protocol first and the fake harnesses second; no new seams inside the hub.
- Suites for review run through `cland verify`. Commit on the task branch, push to `origin`; `dev` only through `cland merge`. English everywhere.
- A new test file is classified in the hub's shard manifest.

## Acceptance criteria

- [ ] `hub/src/system-processes.ts` and `hub/test/process-cleanup.ts` list processes with one form that macOS `ps` and procps-ng both accept; no code or script sets `PS_PERSONALITY`.
- [ ] A test parses recorded macOS and procps output of that form (long and quoted command lines, a zombie, a single-digit day) to identical rows, and lists real processes on the platform it runs on with identities equal to `processStarted`'s.
- [ ] In an Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user, the listing test passes and `npm test` runs past its first phase without `PS_PERSONALITY`; the log is published as an artifact in this item's topic.
- [ ] `hub/README.md` describes the listing and that it holds on both platforms.
- [ ] The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
