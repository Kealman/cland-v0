---
id: T-280
kind: task
title: One process listing that both the BSD and the procps ps accept
state: closed
status: done
criterion_seq: 5
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-268
blocked_by:
  - T-278
topic: topic-179
branch: t/T-280-one-process-listing-that-both-the-bsd
created: 2026-10-12T11:54:20.717Z
updated: 2026-10-12T21:12:50.102Z
closed: 2026-10-12T21:12:50.339Z
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
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-2 · 2026-10-12T20:38:08.348Z · commit d846da3f4f2a2c2e740971932f71623b506f772f
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-4 · 2026-10-12T20:50:04.058Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-5 · 2026-10-12T21:12:24.825Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
- [x] C2. A test parses recorded macOS and procps output of that form (long and quoted command lines, a zombie, a single-digit day) to identical rows, and lists real processes on the platform it runs on with identities equal to `processStarted`'s.
  - done: impl-280 · 2026-10-12T19:27:00.685Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-1 · 2026-10-12T19:28:51.806Z · commit a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-2 · 2026-10-12T20:38:08.348Z · commit d846da3f4f2a2c2e740971932f71623b506f772f
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-4 · 2026-10-12T20:50:04.058Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-5 · 2026-10-12T21:12:24.825Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
- [x] C3. In an Ubuntu 24.04 container limited to 8 CPUs, as an ordinary user, the listing test passes and `npm test` runs past its first phase without `PS_PERSONALITY`; the log is published as an artifact in this item's topic.
  - done: impl-280 · 2026-10-12T20:36:32.083Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-2 · 2026-10-12T20:38:08.348Z · commit d846da3f4f2a2c2e740971932f71623b506f772f
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-4 · 2026-10-12T20:50:04.059Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-5 · 2026-10-12T21:12:24.825Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
- [x] C4. `hub/README.md` describes the listing and that it holds on both platforms.
  - done: impl-280 · 2026-10-12T19:27:01.084Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-1 · 2026-10-12T19:28:51.806Z · commit a9f28fb5b26f7c4e432c79c286bdd129f8fd3bce
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-2 · 2026-10-12T20:38:08.348Z · commit d846da3f4f2a2c2e740971932f71623b506f772f
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-4 · 2026-10-12T20:50:04.059Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-5 · 2026-10-12T21:12:24.825Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da
- [x] C5. The suite is green on macOS through `cland verify`, and no test is weakened, skipped or retried.
  - done: impl-280 · 2026-10-12T21:12:12.727Z
  - verified: rev-23 [reviewer] · run rev-2026-10-12-280-5 · 2026-10-12T21:12:24.825Z · commit 857b769bc03d3d2afbb134f6c8734bbe3b8e13da

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

### impl-280 · 2026-10-12T20:15:10.346Z

T-279's census and final macOS suite completed at 20:14Z (A-1615). The next queue check found a new T-291 hand-run holder started at 20:14:31Z, so C3's full Ubuntu run has still not started. Requested the Coordinator reserve the next gap for T-280's container run then host verify, and asked impl-291 for completion notification. Docker Desktop is being stopped again while waiting.

### impl-280 · 2026-10-12T20:15:53.404Z

Coordinator decision at 20:15:42Z reserves the next machine gap after T-291's current round for T-280: Ubuntu container full run first, then host cland verify all. Coordinator will queue integrated dev behind the host verify; T-291 holds its next round during the container run. Docker remains stopped until the current round releases.

### impl-280 · 2026-10-12T20:18:33.042Z

T-291 released its current proof round, but T-288 run 543870eb had already been admitted at 20:16:29Z. Coordinator reaffirmed at 20:18:22Z: the gap after T-288 is reserved for T-280's container run then host verify; integrated dev and T-291 rounds remain held until our host verification is queued. Subscribed to T-288's completion artifacts; Docker remains stopped.

### impl-280 · 2026-10-12T20:21:54.905Z

C3 Ubuntu full run admitted manually in the reserved gap: verify queue had no holder/waiters at 20:21:24Z; container command began at 20:21:33Z. Running npm run typecheck && npm test once at exact a9f28fb, Ubuntu 24.04.5 arm64/procps-ng 4.0.4/Node 24.21.0, runner uid 1001 HOME=/home/runner, cgroup cpu.max 400000/100000 (4 CPUs), PS_PERSONALITY absent. Full log retained for artifact publication. No host verify queued until this completes and Docker stops.

### impl-280 · 2026-10-12T20:35:28.297Z

Container setup finding during full run: initial docker run used sleep infinity as PID 1 without --init. ps observed 1,218 zombies, all parented by PID 1. This can make process-disappearance/restart tests fail despite dropped zombie listing rows; the full Linux failure list is therefore environment-confounded, not a clean product regression baseline. Typecheck, 30 first-phase tests and the portable listing startup demo passed. The full run will finish once and its complete log will be published with this limitation. Further local container checks will use Docker --init (https://docs.docker.com/reference/cli/docker/container/run/).

### impl-280 · 2026-10-12T20:36:31.708Z

Coordinator instruction at 20:35:37Z: stop the contaminated container run now; C3 only needs listing pass and npm test past its first phase. Stopped at 20:36Z (docker exec exit 137), published original partial log A-1623 with Ubuntu/ordinary-user/4-CPU/PS_PERSONALITY-absent header, passed typecheck, all 30 hub-free tests and entry into hub machine. A-1605 records earlier Linux listing tests 27/27. Zombie limitation accompanies the result; it does not establish each failure's cause. T-281's Linux container runs use --init. Docker Desktop quit; settings unchanged. Fetched/merged latest origin/dev before final host verify.

### impl-280 · 2026-10-12T20:37:12.137Z

Latest origin/dev merged and task head d846da3 pushed. Review request sent for C3/C5 with artifacts A-1623/A-1624 before submitting ordinary cland verify all e146e6d7-21a8-4595-a122-6b156e254e4e to rev-23 and impl-280 in topic-179. No full-suite retry or test weakening; going idle for the hub result.

### rev-23 · 2026-10-12T20:38:08.348Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-280-2
commit: d846da3f4f2a2c2e740971932f71623b506f772f

No high/medium findings. Portable listing/parser, fixtures and safety checks are unchanged from source-clear a9f28fb. C3's limited Ubuntu startup demonstration is satisfied by A-1623 metadata/typecheck/30 hub-free passes/entry into hub machine and A-1605's Linux listing test 27/27. Later interrupted results carry the missing-init zombie limitation, not full Linux clearance. C5 remains unverified pending exact-head macOS cland verify. Evidence A-1626: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1626-t-280-ubuntu-startup-evidence-and-merge-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-280 · 2026-10-12T20:38:19.126Z

Review clear rev-2026-10-12-280-2 verifies C1–C4 at merged head d846da3. C3 startup evidence is accepted with A-1624's interrupted-container limitation retained (review artifact A-1626). impl-291 confirmed host run e146e6d7 admitted at 20:37:27Z and released its reservation after Docker stop/admission. Only C5 remains; waiting for the exact-head macOS full-suite result.

### rev-23 · 2026-10-12T20:48:43.288Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-12-280-3
commit: d846da3f4f2a2c2e740971932f71623b506f772f

Medium — hub/test/suite-runner.test.ts:774: scan counter still matches retired ww -axo, so portable -ww -e never creates scans and line 792 throws ENOENT. Migrate the exact whole-table boundary while preserving one-sweep and cleanup assertions.
C1–C4 assessment retained; C5 failed on full result A-1630 (1380/1381, exit 1). Evidence A-1631: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1631-t-280-full-verification-stale-phase-sweep-ps-boundary.md.

Criteria: C5 failed (Full verify e146e6d7 fails phase-sweep scan counter because its ps wrapper still matches ww -axo; Neovim not reached.).

### impl-280 · 2026-10-12T20:49:30.300Z

C5 failure in A-1630 reproduced with targeted node --test --test-name-pattern='one per-phase discovery sweep' hub/test/suite-runner.test.ts: scans ENOENT. Cause: missed fake shell wrapper still counting ww -axo. Corrected only its pattern to the exact portable -ww -e -o columns; cleanup log, orphan ESRCH, exactly-one sweep and directory removal assertions unchanged. Corrected targeted test passes 1/1. Commit/fetch/merge/push followed by corrected-head full verification; this is a boundary fix, not a retry of unchanged code.

### impl-280 · 2026-10-12T20:49:49.560Z

Corrected head 857b769 pushed; origin/dev fetched/merged and current. Review requested before corrected-head ordinary cland verify all submission. Only change since d846da3 is the exact ps scan-counter boundary in suite-runner.test.ts. Waiting for the hub's full result.

### rev-23 · 2026-10-12T20:50:04.059Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-280-4
commit: 857b769bc03d3d2afbb134f6c8734bbe3b8e13da

No high/medium findings. The single fake-boundary correction matches exact portable whole-table arguments, excludes targeted probes, and preserves real ps execution and all one-sweep/cleanup assertions. Targeted red/green is reported 1/1 after correction. C1–C4 verified; C5 awaits the complete exact-head macOS full suite. Evidence A-1632: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1632-t-280-corrected-phase-sweep-boundary-review.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified.

### impl-280 · 2026-10-12T21:12:13.259Z

Corrected-head ordinary cland verify all 96700814 completed green at exact 857b769: 1,684/1,684 passed, 0 failed/cancelled/skipped/todo; suite 711.37s. Durable log A-1637. C5 marked done; C1–C4 review-verified and final C5 review verification pending. Docker remains quit. Keeping claim until merge.

### rev-23 · 2026-10-12T21:12:24.825Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-12-280-5
commit: 857b769bc03d3d2afbb134f6c8734bbe3b8e13da

No high/medium findings. C1–C4 assessment retained; C5 verified by full exact-head cland verify 96700814 in A-1637: typecheck, hub-free 30/30, hub-machine 1351/1351, Neovim 303/303, total 1684/1684, zero skips/cancellations, exit 0. Portable recorded/live identity and corrected one-sweep regressions pass. Ubuntu C3 limitations remain as A-1626 records. Evidence A-1638: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1638-t-280-final-review-complete-exact-head-verification.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified.

### coord · 2026-10-12T21:12:50.102Z

Merged 40f0e49cc7602d5dbaaf8febe67849e6d1488316 onto dev.
