# Running tests

Implementers run full suites through the hub, one invocation at a time per session:

```sh
cland verify all --report <item-topic> --to <reviewer-name> --to <your-name>
```

Send the review request first. Before the final suite, fetch and merge `origin/dev` into the task branch. The CLI prints the run id, worker PID (null while queued) and hub queue position, then exits. Go idle: the hub delivers one result with the exit code, test counts, failures, branch/head and durable log artifact. The worker survives the caller's shell exiting. The hub keeps its run record across restart; a killed worker produces a result naming the signal while the hub is live, or a missing-exit-receipt crash report after restart. A permission change can hold reporting: `cland hub status --json` exposes pending runs and their reporting error; restoring permission lets the hub retry without duplicating a committed result. A recipient hygiene refusal holds the whole result until every intended recipient is admissible, so a partially muted recipient cannot lose its report.

Omitting the mode selects phases from the branch diff against freshly fetched `origin/dev`, including working changes. `all` or `--all` forces full. Integrated `dev`, shared or ambiguous changes, empty diffs and fetch failures run full. A package-local diff runs that package plus the cross-package smoke baseline; `hub` and `nvim` reduce only matching qualifying diffs. The duration line and report include the mode, reason and deciding files. See [phase rules and smoke baselines](../../hub/README.md#tests). Each run first executes `npm run typecheck`, then the package test script from the calling worktree. `--report` names the result topic; repeat `--to` to name recipients. With a session name in `--report`, the hub uses the caller's claimed item topic and addresses that session. Reporting uses the caller's stable session identity and current artifact/send permissions; an Implementer needs its own item topic or a topic with a delivered request.

The hub persists the request, exact head, item, diff selection, enqueue time and priority in its database before acknowledging it. Admission gives the Coordinator's integrated dev requests first priority, then the item rank captured at submission, then enqueue order. One run is admitted at a time. The queue and its order survive restart; a known dead requester's queued run becomes one hub cancellation note to its original recipients. A disconnected spoke alone is not evidence of death.

A green run may be reused for the identical committed candidate tree and effective
mode. The candidate excludes only `.cland/tasks`, so tracker-only dev merges hit;
other paths and dirty working changes do not. `--fresh` forces execution, and
`[verification].cache_max_age_minutes` defaults to 1440 (0 disables reuse). Hits
name the requested head, original run/head and tree hash and post once as usual.
The Reviewer still verifies criteria at the requested exact head using that
result; a cached result never revives an old criterion mark automatically.

`[verification].budget` in `.cland/config.toml` defaults to 1. Values above 1 log `verification-budget-capped` and use 1. T-215 keeps this conservative budget after classifying only five files as hermetic; process-heavy overlap remains disabled. `cland suite` remains an alias, including cancellation.

The compatibility shim retains `/tmp/cland-suite.lock` and `/tmp/cland-suite-nvim.lock` for hand-run `npm test` and pre-V1 branches. A holder or earlier live legacy ticket blocks hub admission. The worker atomically takes both leases before typecheck to cover a racing hand run. A V1 package runner borrows that verified lease and publishes its per-run recovery record in `<lock>.runs/<token>.json` through every shard; a pre-V1 package runner takes its own legacy lease after protected typecheck. A queued head change cancels the request; successful results keep the submitted exact head. The merge gate's rules are unchanged.

The underlying package scripts remain available for humans and isolated CI:


- `npm test`: automatic phase selection; `npm test -- --all` forces full.
- `npm test --workspace hub` and `npm run test:nvim`: request the matching reduced mode, widening to full when the diff does not qualify.

`hub/test/shards.json` classifies every hub test. `npm run test:shards` and package admission reject unclassified files, missing files and free files with process/port/timer APIs, process-fixture helpers, real-time waits, lock paths or Neovim. The five hermetic files run on one worker; hub machine files and Neovim run on four. Only machine shards take `<lock>.machine`. Suite reports include shard durations, machine wait, total wall time, compatibility wait and hub queue wait. Production overlap stays disabled.

Every package run takes both legacy locks jointly and retains them through its phases, including smoke, so hub and Neovim suites serialize across sessions, projects and worktrees. Runs admit only when both locks are free, under both recovery guards; they hold neither while waiting. A legacy Neovim-first waiter can therefore take the free machine lock and finish without a cycle. No other run can pass between phases and the remaining waiters keep their order. Targeted single-file `node --test <file>` runs are free.

Both locks use the same PID/start-time ownership, stale-holder recovery and interruption cleanup. Before polling any recovery guard, each waiter atomically publishes its PID, process start identity, monotonic queue time and worktree in `<lock>.queue/`. This persistent queue sits beside the temporary ownership directory so release and stale-holder recovery preserve waiting tickets. The oldest live ticket alone can take all required free locks, regardless of poll timing. Dead or reused-PID tickets are swept; interruption removes the waiter’s own ticket. A waiter prints its queue position, the holder, start time and holder worktree (unavailable for older holders). A dead holder is recovered after a one-second grace period, with its owned processes and temporary root cleaned before a new phase starts. Interrupting a waiter leaves the live holder's lock intact.

An ownerless manual lock stays held. The wait message names the lock's `rmdir` command; use it only after verifying that no suite using that lock is running. `CLAND_TEST_SKIP_LOCK=1` is for isolated CI jobs.

See [the runner and process-fixture notes](../../hub/README.md#tests) when adding tests that spawn processes.
