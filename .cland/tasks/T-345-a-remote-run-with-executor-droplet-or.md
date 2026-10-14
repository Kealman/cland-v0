---
id: T-345
kind: task
title: "A remote run: with executor = droplet or --executor droplet, cland verify delivers a bundle and the hub's suite selection to a droplet, runs detached as an ordinary user, polls status and log by offset, and posts the result with the droplet, its lifetime and its cost"
state: open
status: review
size: L
criterion_seq: 10
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
updated: 2026-10-14T01:06:24.390Z
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

- [x] C1. A fixture task branch with a hub-only diff runs with `executor = "droplet"` against the fakes: the fake machine receives a bundle; its run sees `CLAND_SUITE_SELECTION` equal to the host's selection (`hub-only`), with `FORCE_COLOR=0` and `NO_COLOR=1`; it runs typecheck, then the selected test command, as `runner`. One result is posted with the executor line, the lifetime and the cost. The fake API shows the droplet and the key deleted.
  - done: impl-345 · 2026-10-13T23:49:36.002Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.389Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C2. `--executor local` overrides a droplet default, and `--executor droplet` overrides a local default. An unknown value is refused. `cland task view --json` shows the run's `verify.executor`.
  - done: impl-345 · 2026-10-13T23:49:41.238Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.389Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C3. A host typecheck failure posts a failed result and creates no droplet. A failing remote test posts one failed result with its failures. A remote typecheck failure stops before the tests.
  - done: impl-345 · 2026-10-13T23:49:42.498Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.389Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C4. A long fake run shows up incrementally in the local log. Fake `ssh` failing for N calls mid-run does not end the run, and the final result is complete. A droplet deleted from the fake API mid-run yields one result with `remote machine lost`, and the lease is released.
  - done: impl-345 · 2026-10-13T23:57:27.168Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.389Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C5. `cland verify cancel` mid-run stops the remote group, posts one cancelled result and destroys the droplet.
  - done: impl-345 · 2026-10-13T23:49:44.047Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.390Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C6. With `cland hub stop` and start mid-run, the hub reattaches through the lease and reports exactly once.
  - done: impl-345 · 2026-10-13T23:57:27.914Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.390Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C7. A green droplet result is a cache hit for a later `--executor local` request on the same tree and mode, and names `droplet`.
  - done: impl-345 · 2026-10-13T23:49:45.452Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.390Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [x] C8. The sentinel token appears nowhere: not in the bundle, the env file, `run.sh`, the fake machine's files, the logs, the journal, the result or the artifact.
  - done: impl-345 · 2026-10-13T23:49:46.429Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.390Z · commit f7e696654e88c941273dc3be93024f48a22f774c
- [ ] C9. Real check, posted on this item: one `cland verify --executor droplet` of this repository at the branch head on c-8, with its result, platform, lifetime and cost, and an empty tag listing afterwards.
  - failed: rev-23 [reviewer] · 2026-10-14T00:18:21.311Z · note The real c-8 attempt cannot authenticate runner within 180 seconds: inherited snapshot clean removes its key-copy hook; no remote suite result was established.
- [x] C10. `hub/README.md` describes choosing the executor, delivery, the selection, the result line and what a Linux result proves.
  - done: impl-345 · 2026-10-13T23:49:47.766Z
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-2 · 2026-10-14T00:00:25.926Z · commit 0f85b00dfdb4d6c2c292bde6eb260aa0c0ded3d7
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-4 · 2026-10-14T00:26:19.966Z · commit f7e696654e88c941273dc3be93024f48a22f774c
  - verified: rev-23 [reviewer] · run rev-2026-10-14-345-5 · 2026-10-14T01:06:24.390Z · commit f7e696654e88c941273dc3be93024f48a22f774c

## Comments

### impl-345 · 2026-10-13T23:39:12.113Z

Implementing executor selection, a host typecheck gate before acquire, incremental bundle delivery, detached runner scripts, byte-offset polling, cancellation/restart and the existing cache/report path. Frame tests will use the prepared-image fixture, fake DigitalOcean API and fake machine.

### rev-23 · 2026-10-13T23:53:35.208Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-13-345-1
commit: dedb3246e41dc405a69491a90f38845b632463cf
scope: full

Medium — hub/src/hub/suites.ts:301–323 (droplet.ts:258): restart trusts the pre-delivery job lease instead of authoritative lease.json, allowing repeated delivery/clean of a started run; active launching suite leases are also mistaken for orphan leases. Reconcile durable ownership at acquisition/delivery/start checkpoint windows.
Medium — hub/src/executor/droplet/run.ts:63 (suites.ts:331): executed start with lost SSH reply fails/releases a live machine, while a marker-only interrupted start never launches on retry. Cover both admission uncertainty cases and keep one actual group.
Complete source review found no additional blocker. C4/C6 failed; real C9 and full verification remain pending corrected source clear. A-2125: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2125-t-345-full-source-review-remote-admission-and-restart-blockers.md.

Criteria: C4 failed (A detached start that executes but loses its SSH reply becomes a terminal launch failure and releases the live machine instead of retaining unknown admission.), C6 failed (Launching restart trusts stale scheduler lease execution state and can re-deliver a live checkout; reconciliation can also release a launching suite's owned active lease.).

### rev-23 · 2026-10-14T00:00:25.926Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-345-2
commit: 0f85b00dfdb4d6c2c292bde6eb260aa0c0ded3d7
scope: full

No high or medium findings remain. Authoritative lease reload and durable suite ownership resolve restart/re-delivery/orphan-release windows. Detached descriptor admission and pending/unknown reconciliation resolve executed lost-reply and marker-only starts; A-2127 adds boundary regressions for all cases, retaining original tests. Complete source scope A-2125 carried forward. C10 verified from docs; C1–C8 await exact-head full verification and C9 the authorized bounded real receipt. A-2131: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2131-t-345-corrected-full-source-review-at-0f85b00d.md.

Criteria: C10 verified.

### rev-23 · 2026-10-14T00:18:21.311Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-2026-10-14-345-3
commit: 0f85b00dfdb4d6c2c292bde6eb260aa0c0ded3d7
scope: evidence

Medium — hub/src/executor/droplet/prepare.ts:126: inherited image preparation installs the runner-key hook before cloud-init clean removes it; concrete C9 diagnosis reports root SSH succeeds but runner keys/hook are absent. Fake clean=true masks the boot defect. C9 failed; separate T-368 fix and modeled prepare→snapshot acquire regression need source review before fresh image/run evidence. A-2134 was intentionally cancelled before edits; it is not the defect and provides no green verification. Prior admission/restart source review remains applicable. A-2136: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2136-t-345-c9-not-clear-inherited-snapshot-key-hook-deleted-during-clean.md.

Criteria: C9 failed (The real c-8 attempt cannot authenticate runner within 180 seconds: inherited snapshot clean removes its key-copy hook; no remote suite result was established.).

### impl-345 · 2026-10-14T00:24:51.241Z

C9 exposed T-344's runner key hook being deleted by cloud-init clean; Coordinator filed T-368 and authorized its fix here. Separate commit f7e69665 installs the hook after cleaning and adds realistic fake key injection/authorization plus a prepare→snapshot acquire regression (red before fix, green after). Evidence A-2142/A-2135. Preparation 11/11 and remote 16/16 targeted checks pass; replacement source review requested. Old full run cancelled; bad image and all droplets removed. C9 awaits a fresh fixed-code snapshot and exact reviewed-head run.

### rev-23 · 2026-10-14T00:26:19.966Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-345-4
commit: f7e696654e88c941273dc3be93024f48a22f774c
scope: delta

No high or medium source findings. Separate T-368 commit correctly installs the key-copy hook after clean; the fake models clean/root-only injection/boot/SSH authorization, with old-order red/new-order green prepare→acquire coverage. Incoming T-265/T-358 code matches reviewed heads and final evidence. Prior complete T-345 scope retained. C10 refreshed; C1–C8 await new exact-head full verification, C9 a fresh fixed-code image and bounded reviewed-head c-8 result/cleanup. Old failure/cancellation remain non-green evidence. A-2144: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2144-t-345-delta-source-clear-t-368-image-boot-fix-and-dev-integration.md.

Criteria: C10 verified.

### rev-23 · 2026-10-14T01:06:24.390Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-2026-10-14-345-5
commit: f7e696654e88c941273dc3be93024f48a22f774c
scope: evidence

No high or medium findings in source/full suite. Exact-head full cland verify 89660b57 / A-2151 passed both typechecks and 1917/1917 tests, zero failures/cancellations/skips/todo. All remote frame, admission/restart, secret/cache/accounting and realistic snapshot-boot regressions pass. A-2144 remains current. C1–C8/C10 verified; C9 remains unverified pending fresh fixed-code image, reviewed-head c-8 result and sanitized cleanup/cost receipt. This is not final task readiness. A-2152: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2152-t-345-exact-head-full-evidence-clear-real-c9-pending.md.

Criteria: C1 verified, C2 verified, C3 verified, C4 verified, C5 verified, C6 verified, C7 verified, C8 verified, C10 verified.
