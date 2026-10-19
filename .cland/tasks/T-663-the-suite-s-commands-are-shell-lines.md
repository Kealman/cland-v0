---
id: T-663
kind: task
title: The suite's commands are shell lines from one resolver, with today's npm lines unchanged
state: closed
status: done
size: S
criterion_seq: 6
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by: []
topic: topic-559
branch: t/T-663-the-suite-s-commands-are-shell-lines
created: 2026-10-16T16:35:22.893Z
updated: 2026-10-19T07:53:48.000Z
closed: 2026-10-19T07:53:48.000Z
---

## Summary

Prefactoring for "Verification for any stack" (spec v0.1.4 §3.7). The suite worker, the host gate and the droplet's `run.sh` get their commands from one resolver as shell command lines, run through `/bin/sh -c`, instead of three hard-coded npm argument vectors. The resolver still returns today's npm lines, so nothing changes yet.

## What to build

- **One resolver.** Add a module (for example `hub/src/verification-commands.ts`) that takes a job (`mode`, `selection`) and returns `{ check, test }` as command lines. It returns exactly the lines run today: `npm run typecheck` for `check`, and for `test`: `npm test` for a full selection or the `auto`/`all` request, `npm test --workspace hub` for `hub`, `npm run test:nvim` for `nvim`. `suiteCommands` in `hub/src/hub/suite-worker.ts` goes. `hub/src/executor/droplet/run.ts` imports it from `suite-worker.ts` today and moves to the resolver.
- **Shell lines.** `suiteCommand` in `hub/src/suite-command.ts` spawns `/bin/sh -c <line>` instead of `npm <args>`. It keeps the ownership capture, stall stop, output observation and exit mapping. The owned process tree gains the shell as its root, and a simple command line exec's through it.
- **The worker** logs `$ <line>` (for today's lines the text stays byte-identical: `$ npm run typecheck`, `$ npm test`). It handles the commands by name, not by index. The compatibility-lease release for runners without `inheritedLease` happens before `test`. Coverage output goes to `test` only.
- **The host gate** in `hub/src/hub/suites.ts` (`#hostGate`) runs the resolver's `check` line through `/bin/sh -c` and logs `Host gate: <line>`, which still reads `Host gate: npm run typecheck`. Its failure message stays as today, and ticket T-668 renames it.
- **The droplet's `run.sh`** gets `@COMMANDS@` from the same lines: `echo '$ <line>'`, then `sh -c '<line>' || exit $?`, with the lock release before `test` as today.

**Keeping cland's own suite intact.** Every line it runs keeps the same text in the same order with the same environment, locally, on the host and on the droplet. The modes, shards, load gate, coverage recording and durations do not change. Only the spawn goes through `/bin/sh`.

## Acceptance criteria

- [x] C1. The resolver returns today's lines for the `auto`, `all`, `hub` and `nvim` requests and for a full selection (new unit test `hub/test/verification-commands.test.ts`).
  - done: impl-663 · 2026-10-19T06:20:25.099Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.239Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
- [x] C2. A local run's log still shows `$ npm run typecheck` before `$ npm test`, and the existing suite tests (`suite.test.ts`, `suite-runner.test.ts`, `suite-cancel.test.ts`) pass unchanged.
  - done: impl-663 · 2026-10-19T06:20:25.463Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.239Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
- [x] C3. `stall_timeout` still stops a silent command run through the shell with its whole process tree, including a pipeline line such as `sleep 999 | cat` (case added to `suite-timeouts.test.ts`).
  - done: impl-663 · 2026-10-19T06:20:25.913Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.239Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
- [x] C4. A fake-droplet run's `run.sh` holds the resolver's lines in order, and `executor-run.test.ts` passes with its typecheck-before-test assertion unchanged.
  - done: impl-663 · 2026-10-19T06:20:26.352Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.239Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
- [x] C5. The host gate log reads `Host gate: npm run typecheck`, and a failing host gate still creates no machine (`executor-run.test.ts`).
  - done: impl-663 · 2026-10-19T06:20:26.704Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.240Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
- [x] C6. `grep` finds no npm argument vector for the suite commands outside the resolver in `hub/src/hub/suite-worker.ts`, `hub/src/hub/suites.ts` and `hub/src/executor/droplet/run.ts`.
  - done: impl-663 · 2026-10-19T06:20:27.150Z
  - verified: rev-30 [reviewer] · run rev-20261019-663-source · 2026-10-19T06:22:11.056Z · commit 2601907064ea79354500a5bab9abe581833bf2b3
  - verified: rev-30 [reviewer] · run rev-20261019-663-final · 2026-10-19T06:39:12.240Z · commit 2601907064ea79354500a5bab9abe581833bf2b3

## Comments

### impl-663 · 2026-10-19T06:12:43.009Z

Read E-614 plan and constraints. Test-first at ticket seams: T1 verification-commands resolver; existing worker/host/fake-droplet coverage; existing process-lifecycle stall cleanup test. No configuration behavior in this prefactor.

### impl-663 · 2026-10-19T06:16:36.802Z

Implemented verificationCommands({ mode, selection }, check) returning named shell lines, preserved expanded candidate npm run check and legacy typecheck detection. Worker, host gate and droplet run.sh now execute through /bin/sh -c; named test handling preserves compatibility-lease release and coverage routing. Red/green: resolver initially missing; direct pipeline lifecycle case fails with npm spawning and passes with shell spawning. Host test:lint, typecheck and tier lint pass; timeout file 8/8 green (39.93s), suite-check 3/3 (3.06s), unchanged suite.test.ts 11/11 (21.90s). Remaining required runner/cancel/fake-droplet regressions running one file at a time before review.

### rev-30 · 2026-10-19T06:22:11.056Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-663-source
commit: 2601907064ea79354500a5bab9abe581833bf2b3
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-5820 Standards/Spec audit has no findings. Shared named resolver preserves mode/full-selection and expanded-check/legacy-typecheck behavior (Coordinator e3f6e1b0). Local/host/droplet use quoted shell lines with prior ordering, lease timing, environment and supervision retained; old vector host receipts safely force a remote recheck. New T1 table and native pipeline cleanup control preserve existing assertions; no config behavior added. Pinned grep establishes C6, verified here. C1–C5 await unchanged-head mode-free task gate and native host evidence; T3 is landing-batch evidence, not task execution. QA none.

Criteria: C6 verified.

### rev-30 · 2026-10-19T06:39:12.240Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261019-663-final
commit: 2601907064ea79354500a5bab9abe581833bf2b3
scope: evidence
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Final clear; A-5831 combines source A-5820, accepted exact-head 6457fd3e/A-5830 (1469/1469, zero fail/cancel/skip) and durable native host A-5821. Resolver 2/2 plus both 5/5 repetition groups; all 389 global groups pass. Native host timeout/pipeline 8/8, suite 11/11, runner 43/43, cancel 6/6, executor-run 14/14, lease contract 6/6, check 3/3 retain shell-tree cleanup, command order, host failure/no-machine and lease/coverage controls. Five inherited report-only T-803 rows disclosed. C1–C6 verified; no findings, QA none. T3 Linux remains landing-batch evidence; not claimed from task receipt.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified.

### coord · 2026-10-19T07:53:48.000Z

Merged 354c20cdffcaab0c447218c1254d24241723e90d onto dev.
