# Running tests

Implementers run full suites through the hub, one invocation at a time per session:

```sh
cland suite all --report <item-topic> --to <reviewer-name> --to <your-name>
```

Send the review request first. Before the final suite, fetch and merge `origin/dev` into the task branch. The CLI prints the run id, worker PID and project queue position, then exits. Go idle: the hub delivers one result with the exit code, test counts, failures, branch/head and durable log artifact. The worker survives the caller's shell exiting. The hub keeps its run record across restart; a killed worker produces a result naming the signal while the hub is live, or a missing-exit-receipt crash report after restart. A permission change can hold reporting: `cland hub status --json` exposes pending runs and their reporting error; restoring permission lets the hub retry without duplicating a committed result. A recipient hygiene refusal holds the whole result until every intended recipient is admissible, so a partially muted recipient cannot lose its report.

`all` is the default. `hub` and `nvim` choose the corresponding phase. Each run first executes `npm run typecheck`, then the package test script from the calling worktree. `--report` names the result topic; repeat `--to` to name recipients. With a session name in `--report`, the hub uses the caller's claimed item topic and addresses that session. Reporting uses the caller's stable session identity and current artifact/send permissions; an Implementer needs its own item topic or a topic with a delivered request.

The project queue position counts this hub's unfinished jobs when submitted. Cross-project lock waiting remains in the log, with the lock holder's PID and start time.

The underlying package scripts remain available for humans and isolated CI:


- `npm test`: hub, then Neovim under one machine-queue ticket. The run takes both locks jointly before starting and retains them through both phases; each phase cleans up its processes and temporary root before the next starts.
- `npm test --workspace hub`: hub only, with the machine lock `/tmp/cland-suite.lock`.
- `npm run test:nvim`: Neovim only, queueing once for joint admission to `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock`.

Every phase takes the machine lock, so hub and Neovim suites serialize across sessions, projects and worktrees. Neovim-only and full runs admit only when both locks are free, under both recovery guards; they hold neither while waiting. A legacy Neovim-first waiter can therefore take the free machine lock and finish without a cycle. A full run keeps its admission between phases, so no other run can pass it and the remaining waiters keep their order. Targeted single-file `node --test <file>` runs are free.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. Before polling any recovery guard, each waiter atomically publishes its PID, process start identity, monotonic queue time and worktree in `<lock>.queue/`. This persistent queue sits beside the temporary ownership directory so release and stale-holder recovery preserve waiting tickets. The oldest live ticket alone can take all required free locks, regardless of poll timing. Dead or reused-PID tickets are swept; interruption removes the waiter’s own ticket. A waiter prints its queue position, the holder, start time and holder worktree (unavailable for older holders). A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite using that lock is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.
