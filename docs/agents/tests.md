# Running tests

Run full suites through the package scripts, one invocation at a time per session:

- `npm test`: hub, then Neovim. Each phase releases its lock and cleans up its temporary root before the next phase starts.
- `npm test --workspace hub`: hub only, with the machine lock `/tmp/cland-suite.lock`.
- `npm run test:nvim`: Neovim only, with `/tmp/cland-suite-nvim.lock`.

Hub and Neovim suites can run concurrently across sessions; runs of the same phase serialize across projects and worktrees. Targeted single-file `node --test <file>` runs are free.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. A waiter prints the holder and start time. A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite of that phase is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.
