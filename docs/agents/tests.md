# Running tests

Run full suites through the package scripts, one invocation at a time per session:

- `npm test`: hub, then Neovim under one machine-queue ticket. The run takes both locks jointly before starting and retains them through both phases; each phase cleans up its processes and temporary root before the next starts.
- `npm test --workspace hub`: hub only, with the machine lock `/tmp/cland-suite.lock`.
- `npm run test:nvim`: Neovim only, queueing once for joint admission to `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock`.

Every phase takes the machine lock, so hub and Neovim suites serialize across sessions, projects and worktrees. Neovim-only and full runs admit only when both locks are free, under both recovery guards; they hold neither while waiting. A legacy Neovim-first waiter can therefore take the free machine lock and finish without a cycle. A full run keeps its admission between phases, so no other run can pass it and the remaining waiters keep their order. Targeted single-file `node --test <file>` runs are free.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. Before polling any recovery guard, each waiter atomically publishes its PID, process start identity, monotonic queue time and worktree in `<lock>.queue/`. This persistent queue sits beside the temporary ownership directory so release and stale-holder recovery preserve waiting tickets. The oldest live ticket alone can take all required free locks, regardless of poll timing. Dead or reused-PID tickets are swept; interruption removes the waiter’s own ticket. A waiter prints its queue position, the holder, start time and holder worktree (unavailable for older holders). A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite using that lock is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.
