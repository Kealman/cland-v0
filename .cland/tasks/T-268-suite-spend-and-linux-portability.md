---
id: T-268
kind: epic
title: Suite spend and Linux portability
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: T-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T11:35:13.526Z
updated: 2026-10-12T11:35:13.526Z
---

## Goal

The suite costs less to run and runs on Linux as it runs on macOS, so a remote executor can take it. One full run spawns about 77 thousand short-lived processes, 36 thousand of them `git` and 20 thousand `ps`, and takes 13 minutes locally; on Linux it stops after 1.4 seconds on a BSD-only `ps` call and, with that worked around, fails five tests (the T-256 prototype on a DigitalOcean c-8 droplet). This epic measures where the spawns come from, cuts the big sources, and fixes the Linux failures at their cause.

## Contents

- **T-267, the suite's spend** (spec §3.14, "Before the executor"): a census of the suite's spawns per test file and helper; then cuts where there is room: a prepared fixture repository copied or cloned with shared objects instead of rebuilt with many `git` calls, the children a test started tracked by pid and process group instead of a machine-wide `ps` scan per teardown, the compile cache where T-220's guard allows it, and batching of what the hub phase repeats per test; the wall time and the spawn counts before and after, recorded on T-267.
- **T-266, the hub and the suite portable to Linux** (§3.14): a process listing that both `ps` dialects accept, in `hub/src/system-processes.ts` and in the test cleanup; the fake Claude's hook stdin handling `EPIPE`; the handover test waiting for its audit line; root-safe assertions in the init test; the two load-sensitive tests (`lead-permissions`, `tracker-ready`) given the time they need; the macOS-only cases skipped with a reason.

Not in this epic: the executor that runs the suite on a cloud machine, its image and its lifecycle ("Remote executors"); the hub's verification queue and its budget, which stay as v0.1.1 built them.

Choices where the spec is silent:

- T-267 comes first: its census tells T-266 which `ps` and `git` calls matter, and its cuts change the code T-266 touches.
- The census counts spawns from inside the suite's Node processes, through a module preloaded with `NODE_OPTIONS` that records each `child_process` spawn with its command and its test file; on Linux, process accounting (`acct`) cross-checks the totals, as in the prototype. The census tool stays in the repository for later measurements.
- The machine-wide `ps` scan stays once per phase, as the runner's safety net; a test's teardown kills only the process groups it started.
- The portable listing uses the POSIX options both dialects accept and reads `/proc` on Linux only where a column needs it; nothing sets `PS_PERSONALITY`.
- A load-sensitive test gets its time through the configurable test windows (T-174), never a retry; the five failures are fixed at their cause, as T-266's criteria say.
- The Linux runs are made as an ordinary user with a home under `/home`, as the executor will run them. Iterations may use a local Ubuntu 24.04 container limited to 8 CPUs; the acceptance run is one run on a DigitalOcean c-8 droplet with the prototype's scripts (`hub/prototype/remote-executor/` on `prototype/remote-executor`, read with `git show` and run from a scratch directory), with the token read from the human's environment and never written anywhere.
- The platform skips (the four macOS `sandbox-exec` cases, the real `opencode` binary, and the root-only case when run as root) are listed by reason in the runner's summary on every platform.

## Tracer-bullet order

1. **The census.** A spawn census of one full run, per test file and helper, published as an artifact on T-267 with the run's wall time. Demo: the artifact names the ten largest sources of `git`, `ps` and Node spawns with their counts.
2. **Teardown without the machine-wide scan.** The runner and the test helpers track the process groups they start and kill those, and the machine-wide scan runs once per phase. Demo: the census after the change shows the `ps` count cut by at least half, with the suite green through `cland verify`.
3. **A prepared fixture repository.** The repository and territory fixtures are built once per worker and copied or cloned with shared objects for each test, and the hub phase's other repeated setup is batched where the census shows room. Demo: the census shows the `git` count cut by at least half, with the wall time before and after recorded on T-267.
4. **One process listing for both dialects.** `hub/src/system-processes.ts` and the test cleanup list processes in a form both `ps` dialects accept, with a test that parses recorded macOS and procps output. Demo: `npm test` on Ubuntu 24.04 runs past its first phase with no `PS_PERSONALITY`.
5. **The Linux failures at their cause.** The fake's hook stdin handles `EPIPE`, the handover test waits for the audit line, the init check is root-safe, the load-sensitive tests get their windows, and the runner lists the platform skips by reason. Demo: each of the five failing files passes ten runs in a row alone in the Linux container.
6. **The acceptance run.** One full run on a c-8 droplet as an ordinary user with PATH only, and the local run through `cland verify`, both green and recorded on T-266. Demo: the droplet run's log artifact shows the suite green with the platform skips listed by reason, and the droplet is gone afterwards.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI and a shell, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

QA runs the census on `dev` and compares it with the census recorded before the first cut. QA runs `cland verify` on `dev` and reads a green result. QA then runs the full suite once on a c-8 droplet with the prototype's scripts and the token from the human's environment, as an ordinary user with no environment variable beyond PATH, and reads the green log with the platform skips listed by reason; afterwards the provider's tag listing is empty. In the Linux container QA runs the listing test on both `ps` dialects, and each of the five formerly failing files alone.

- [ ] A census artifact names the sources of the `git`, `ps` and Node spawns with counts per test file and helper, before the first cut and on the final `dev`.
- [ ] A full run's `git` and `ps` spawn counts are at least halved, with the wall time before and after recorded on T-267.
- [ ] No test was weakened, skipped or retried to get there, and the suite is green on macOS through `cland verify`.
- [ ] `hub/src/system-processes.ts` and the test cleanup list processes the same way on macOS and Linux, covered by a test on both `ps` dialects.
- [ ] The five Linux failures of the T-256 prototype are fixed at their cause.
- [ ] `npm run typecheck && npm test` passes on Ubuntu 24.04 with 8 vCPUs, as an ordinary user, with no environment variable beyond PATH, and the platform skips are listed by reason.
- [ ] `hub/README.md` describes the census, the platform skips and how to run the suite on Linux; T-266 and T-267 are closed.

## Dogfooding

Every later run of the build is cheaper: the crew's `cland verify` runs, the Reviewers' suite evidence and QA's demos all run the trimmed suite. The suite runs on Linux from here on, which "Remote executors" needs before it moves the crew's suites to droplets.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Measurement.** A census run is a full suite run and takes its place in the queue like one.
- **Risks.** A prepared fixture must not leak state between tests: shared objects are read-only, and each test gets its own refs and worktrees. Group tracking must not leave orphans when a test crashes, which is why the per-phase scan stays.
- **References.** `docs/research/remote-executor.md` on `prototype/remote-executor` (the run, the failures, the process counts); T-218 "Verification at crew scale" (artifact A-1142) for the anatomy of the hub phase.
- **Order.** First in the hub lane; "Prefixes and categories" waits for it, and "Remote executors" needs its Linux run.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.14 (Before the executor) and §4 (Order).
- Tickets: T-267 and T-266, children of this epic; T-256 (decided, §3.14); T-218 (research, A-1142); T-174, T-220 and T-221 (earlier cuts of the suite).
- Branch: `prototype/remote-executor` (`docs/research/remote-executor.md`, `hub/prototype/remote-executor/`).
- GLOSSARY: Territory, Task branch.
