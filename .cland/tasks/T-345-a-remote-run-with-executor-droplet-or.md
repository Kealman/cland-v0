---
id: T-345
kind: task
title: "A remote run: with executor = droplet or --executor droplet, cland verify delivers a bundle and the hub's suite selection to a droplet, runs detached as an ordinary user, polls status and log by offset, and posts the result with the droplet, its lifetime and its cost"
state: open
status: in progress
size: L
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-342
  - T-344
topic: topic-223
branch: t/T-345-a-remote-run-with-executor-droplet-or
created: 2026-10-13T20:53:45.864Z
updated: 2026-10-13T23:39:12.113Z
---

## Summary

`cland verify` runs a suite on a droplet from the prepared snapshot, end to end:

- it bundles the candidate against the snapshot's base;
- it delivers the bundle with the hub's selection in `CLAND_SUITE_SELECTION`;
- it starts the run detached as `runner`;
- it polls status and log by offset;
- it collects, releases the droplet and posts the result as a local run does.

The result names the droplet, its platform, its lifetime and its cost. The executor comes from `[verification] executor` per project, and `--executor` overrides it per run.

## Parent

E-271: Remote executors, tracer bullet 3 of 6. Spec: `docs/spec/v0.1.2.md` §3.14:

- deliver the tree as a bundle together with the suite selection, since a bundle carries no `origin/dev`;
- local and remote are switchable per run, with a per-project default;
- one scheduler, one cache and one report on both paths.

The epic's choices: the run starts detached as an ordinary user and leaves an exit code and a done marker; status and `log(offset)` poll over SSH; a lost connection never kills the run; the gate accepts a Linux result as suite evidence. Prior work: T-282's driver (A-1917):

- `vm-run.sh`: detached under `setsid`, the done marker, the exit code, the timeout from the remaining budget, an ordinary login;
- `run-all.sh`: the stages `deliver`, `suite`, `poll` and `collect`.

The lesson of A-1874 also applies: a typecheck failure reached a droplet because no local gate ran first. ADR 0004: the bundle comes from the territory, and nothing on the machine pushes anywhere.

## What to build

**Choosing the executor.**

- `[verification] executor = "local" | "droplet"` (default `local`) in `hub/src/init/config.ts`.
- `cland verify --executor local|droplet` in `hub/src/cli/suite.ts` and `SUITE_USAGE`, and an `executor` field on the `SuiteStart` frame in `hub/src/protocol.ts`. It overrides the project default for that run.
- The job records its executor at submission. An unknown value is refused.
- In this ticket a droplet run still takes the hub's one admission slot, but not the local compatibility leases: a remote run uses no local CPU. Ticket T-347 gives remote runs their own budget.

**The local gate.** Before acquire, the hub runs `npm run typecheck` in the job's cwd at the job's head, on the host. A failure is reported as the run's result, with no droplet created. The typecheck runs again on the machine, because it checks the Linux build too.

**Delivery.**

- `git bundle create <run dir>/tree.bundle <head> ^<merge-base(head, snapshot.base)>`, made in the job's cwd. When no merge base exists, it is a full bundle.
- The bundle goes to `~/runs/<id>/tree.bundle` through the machine transport (ticket T-344).
- As `runner`, `git -C ~/cland fetch ~/runs/<id>/tree.bundle`, then `git checkout --detach <head>` and `git clean -fdx -e node_modules -e .cache`.
- Then check that `git rev-parse HEAD` equals the job's head and that `git status --porcelain` is empty.
- When the candidate's `package-lock.json` hash differs from the snapshot's, run `npm ci`. When the Neovim pin differs, seed it with `node nvim/bin/nvim-path.ts`. The log says which.
- A dirty worktree cannot be bundled. Ticket T-346 sends it to the local queue; in this ticket it is refused with that cause.

**The selection and environment.** `~/runs/<id>/env` holds only three variables:

- `CLAND_SUITE_SELECTION`: the job's selection as JSON. The hub computed it on the host with `selectPackageSuite`, where `origin/dev` exists.
- `FORCE_COLOR=0` and `NO_COLOR=1`.

The package runner reads the selection through `selectionFromEnv` and never fetches. The commands are `suiteCommands(job)` from ticket T-342, the same as the local worker's. The run takes the machine's own `/tmp/cland-suite.lock`; nothing from the host's leases goes to it.

**Start.** `hub/src/executor/droplet/run.sh` is new, adapted from T-282's `vm-run.sh` without the samplers or `acct`.

- It is uploaded to `~/runs/<id>/` and started as `runner` with `setsid nohup bash ~/runs/<id>/run.sh </dev/null >~/runs/<id>/out 2>&1 &`.
- It writes `~/runs/<id>/platform` (`uname -s -r -m`, `node --version`, the Neovim pin), `suite.log`, `exit` and finally `done`.
- It wraps the commands in `timeout` set to the lease's remaining lifetime less a 120 s collection margin. Ticket T-346 adds the configured run timeout.
- `start` is idempotent: a `~/runs/<id>/started` marker refuses a second launch.

**Status and log.** The hub polls each remote job every 10 s, not on the scheduler's 1 s tick.

- `status` reads `done` and `exit`.
- `log(offset)` reads at most 256 KiB of `suite.log` from the offset (`tail -c +<offset+1> | head -c`). The hub appends the bytes to the job's local `suite.log`, so the artifact, `suiteSummary` and `#reportSuite` work unchanged.
- A failed SSH poll is `unknown` and retried, and never ends the run.
- The run is `lost` in two cases: the API answers 404 for the droplet, or the machine stays unreachable for 5 minutes while the API says `active`. A lost run releases the droplet and is reported with the cause `remote machine lost`.

**Collect and release.** After `done`, the hub:

- reads the last log bytes, `exit` and `platform`;
- writes the local `result.json` receipt (`code`, `cause`, `finished`, `platform`), so `Suites.#inspect` takes the usual path;
- releases the droplet (ticket T-343) and records `machine` (`name`, `size`, `region`, `lifetimeMs`, `costUsd`) on the job.

**Cancel.** `cland verify cancel` signals the remote process group (`kill -TERM -<pgid>` from `~/runs/<id>/pgid`), waits up to 10 s, collects and releases. Destroying the machine always cancels.

**The result.** `#reportSuite` prints the executor line as `Executor droplet · c-8 lon1 · cland-v0-1a2b3c4d · linux x64 6.8.0-… · Node v24.21.0 · Neovim v0.12.5 · lifetime 1398 s · cost $0.0971`. `suite-result` carries `machine`.

- A green droplet result is cache evidence for its tree and mode (T-233) and names its executor.
- The merge gate accepts a Linux result as suite evidence. The macOS-only cases appear among the `suite skip` records as today; they run in the release's final local run.

**Restart.** At hub start, an `active` lease with a run reattaches. Polling resumes from the local log's size as the offset, and the result is reported once. A lease past its deadline is released, and its run is reported with the cause `remote machine lifetime expired`.

**Docs.** `hub/README.md`, "Remote executors: droplets": choosing the executor, `--executor`, delivery against the snapshot base, the selection, the result line, the local typecheck gate, and what a Linux result proves.

**Demo** (the epic's words). With `executor = "droplet"`, `cland verify` on a task branch posts a green result naming the droplet, its lifetime and its cost, and the droplet is gone afterwards.

**Out of scope.** The fallback to local, the run timeout setting, the sweep timer and the daily cap (ticket T-346). Parallel remote runs (ticket T-347). The clauses and skills (ticket T-348).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project, in the style of `hub/test/suite.test.ts`. That includes a bare `origin` for the selection, as its "auto suite reports the fetched diff decision" case does. Tests run against the fake API and the fake machine; the fixture package's `typecheck` and `test` scripts are trivial `node -e` commands. No `npm test` case reaches DigitalOcean.
- No new seams inside the hub: only environment and `CLAND_TEST_*` timing overrides. Classify new test files in `hub/test/shards.json`. Read the logs after the `flushLogs` barrier (T-291).
- The token reaches the API's `Authorization` header only. It never reaches the bundle, the env file, `run.sh`, the machine or the result.
- A real check runs in a scratch project hub on the branch, under D25 until ticket T-346 enforces the cap: one `cland` droplet alive at a time, at most 45 minutes (a full suite on c-8 takes about 23 minutes end to end), and create, destroy and cost posted on this item.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. A fixture task branch with a hub-only diff runs with `executor = "droplet"` against the fakes: the fake machine receives a bundle; its run sees `CLAND_SUITE_SELECTION` equal to the host's selection (`hub-only`), with `FORCE_COLOR=0` and `NO_COLOR=1`; it runs typecheck, then the selected test command, as `runner`. One result is posted with the executor line, the lifetime and the cost. The fake API shows the droplet and the key deleted.
- [ ] C2. `--executor local` overrides a droplet default, and `--executor droplet` overrides a local default. An unknown value is refused. `cland task view --json` shows the run's `verify.executor`.
- [ ] C3. A host typecheck failure posts a failed result and creates no droplet. A failing remote test posts one failed result with its failures. A remote typecheck failure stops before the tests.
- [ ] C4. A long fake run shows up incrementally in the local log. Fake `ssh` failing for N calls mid-run does not end the run, and the final result is complete. A droplet deleted from the fake API mid-run yields one result with `remote machine lost`, and the lease is released.
- [ ] C5. `cland verify cancel` mid-run stops the remote group, posts one cancelled result and destroys the droplet.
- [ ] C6. With `cland hub stop` and start mid-run, the hub reattaches through the lease and reports exactly once.
- [ ] C7. A green droplet result is a cache hit for a later `--executor local` request on the same tree and mode, and names `droplet`.
- [ ] C8. The sentinel token appears nowhere: not in the bundle, the env file, `run.sh`, the fake machine's files, the logs, the journal, the result or the artifact.
- [ ] C9. Real check, posted on this item: one `cland verify --executor droplet` of this repository at the branch head on c-8, with its result, platform, lifetime and cost, and an empty tag listing afterwards.
- [ ] C10. `hub/README.md` describes choosing the executor, delivery, the selection, the result line and what a Linux result proves.

## Comments

### impl-345 · 2026-10-13T23:39:12.113Z

Implementing executor selection, a host typecheck gate before acquire, incremental bundle delivery, detached runner scripts, byte-offset polling, cancellation/restart and the existing cache/report path. Frame tests will use the prepared-image fixture, fake DigitalOcean API and fake machine.
