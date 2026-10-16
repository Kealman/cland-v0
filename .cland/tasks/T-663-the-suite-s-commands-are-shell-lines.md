---
id: T-663
kind: task
title: The suite's commands are shell lines from one resolver, with today's npm lines unchanged
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by: []
topic: null
branch: null
created: 2026-10-16T16:35:22.893Z
updated: 2026-10-16T16:36:03.598Z
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

- [ ] C1. The resolver returns today's lines for the `auto`, `all`, `hub` and `nvim` requests and for a full selection (new unit test `hub/test/verification-commands.test.ts`).
- [ ] C2. A local run's log still shows `$ npm run typecheck` before `$ npm test`, and the existing suite tests (`suite.test.ts`, `suite-runner.test.ts`, `suite-cancel.test.ts`) pass unchanged.
- [ ] C3. `stall_timeout` still stops a silent command run through the shell with its whole process tree, including a pipeline line such as `sleep 999 | cat` (case added to `suite-timeouts.test.ts`).
- [ ] C4. A fake-droplet run's `run.sh` holds the resolver's lines in order, and `executor-run.test.ts` passes with its typecheck-before-test assertion unchanged.
- [ ] C5. The host gate log reads `Host gate: npm run typecheck`, and a failing host gate still creates no machine (`executor-run.test.ts`).
- [ ] C6. `grep` finds no npm argument vector for the suite commands outside the resolver in `hub/src/hub/suite-worker.ts`, `hub/src/hub/suites.ts` and `hub/src/executor/droplet/run.ts`.
