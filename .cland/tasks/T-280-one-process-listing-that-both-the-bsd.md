---
id: T-280
kind: task
title: One process listing that both the BSD and the procps ps accept
state: open
status: review
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: T-268
blocked_by:
  - T-278
topic: topic-179
branch: t/T-280-one-process-listing-that-both-the-bsd
created: 2026-10-12T11:54:20.717Z
updated: 2026-10-12T19:34:08.060Z
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

- [x] C1. `hub/src/system-processes.ts` and `hub/test/process-cleanup.ts` list processes with one form that macOS `ps` and procps-ng both accept; no code or script sets `PS_PERSONALITY`.
  - done: impl-280 · 2026-10-12T19:26:59.958Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-1 · 2026-10-12T19:28:51.806Z · commit a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce
- [x] C2. A test parses recorded macOS and procps output of that form (long and quoted command lines, a zombie, a single-digit day) to identical rows, and lists real processes on the platform it runs on with identities equal to `processStarted`'s.
  - done: impl-280 · 2026-10-12T19:27:00.685Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-1 · 2026-10-12T19:28:51.806Z · commit a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce
- [ ] C3. In an Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user, the listing test passes and `npm test` runs past its first phase without `PS_PERSONALITY`; the log is published as an artifact in this item's topic.
- [x] C4. `hub/README.md` describes the listing and that it holds on both platforms.
  - done: impl-280 · 2026-10-12T19:27:01.084Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-1 · 2026-10-12T19:28:51.806Z · commit a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce
- [ ] C5. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.

## Comments

### impl-280 · 2026-10-12T19:22:30.940Z

Docker Desktop 29.7.2 is available and was started for this item. Coordinator decision: leave Desktop settings at 4 CPUs; local iterations are bounded by 8 CPUs, not required to expose 8. Ubuntu 24.04 container will use --cpus=4. Desktop will be quit after container work. T-282 owns the 8 vCPU acceptance run.

### impl-280 · 2026-10-12T19:26:24.468Z

Implementation: shared processTableArgs/parseProcessTable in hub/src/process-table.ts; -ww -e -o for discovery, -ww -p -o for captured identities. Production own-PID refusal and T-278 signal/identity checks remain intact. Mac/procps 4.0.4 fixture captures preserve dialect spacing/state/argv; only PIDs and dates are canonicalized. Targeted checks pass: system-processes 27/27 on macOS and Ubuntu; cleanup 21/21 and protocol/async-process 5/5 on macOS. Manifest lint passes. Fetch/merge origin/dev found the branch current at dfd32cb.

### rev-23 · 2026-10-12T19:28:51.806Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-280-1
commit: a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce

No high/medium source findings. Shared -ww/-e or -p/-o arguments/parser, production own-PID refusal and T-278 ownership/signal checks retained; fake boundaries assert exact form with original safety assertions. Read-only fixture parser confirms identical live rows, zombie drop, normalized single-digit date and 4181-character full command. Real own/child identity/tail test read; lead reports macOS/Ubuntu targeted checks passing. Local extra native ps probe is sandbox-denied EPERM, not product evidence. README and existing shard classification checked. C1,C2,C4 verified; C3 Linux full artifact and C5 macOS full cland verify remain pending. A-1606: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1606-t-280-source-and-fixture-review-clear-at-a9f28fb.md.

Criteria: C1 verified, C2 verified, C4 verified.

### impl-280 · 2026-10-12T19:34:08.060Z

Source review clear (rev-2026-10-12-280-1) verifies C1/C2/C4 at a9f28fb. C3/C5 remain pending. T-279 requested the next suite gap for its hand-run census followed by macOS verify; T-280 has not started a full run and yielded that gap. Docker Desktop is being stopped while waiting, preserving the prepared Ubuntu container; it will restart for C3 after T-279 notifies completion.
