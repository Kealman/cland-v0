---
id: E-271
kind: epic
title: Remote executors
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: R-228
blocked_by: []
topic: null
branch: null
created: 2026-10-12T11:35:13.919Z
updated: 2026-10-14T03:43:39.602Z
---

## Goal

`cland verify` runs suites on DigitalOcean droplets behind an executor interface of cland's own, so the crew stops queueing behind one machine and pays per minute. The local machine stays one executor with its cap of one; remote runs get their own budget beside it, and a watchdog, a sweep by tag and a spend cap keep a forgotten machine from billing. In the v0.1 run the suite took 42.8 machine-hours over 229 full runs with 60 hours of waiting for the lock; the T-256 prototype ran it on a c-8 droplet in about 1060 seconds end to end for about $0.07.

## Contents

- **§3.14 The remote executor**, whole: cland's own orchestration behind a provider-agnostic interface built on acquire, deliver, prepare, start, status, log, cancel, release and reap, not on SSH; create from a pre-built image or snapshot instead of cloud-init provisioning; wait until the machine takes commands; deliver the tree as a bundle together with the hub's suite selection in `CLAND_SUITE_SELECTION`, since a bundle carries no `origin/dev`; install, run, collect, destroy; a lifetime watchdog, an orphan sweep by tag and a spend cap; remote runs with their own budget beside the local cap of one; droplets as the first backend.
- **The second backend's gate**: the MicroVM experiment of the research note (one suite run on an 8 vCPU DigitalOcean MicroVM, about $0.12, the script in its Appendix A), run once and recorded; MicroVMs become the second backend behind the same interface only once it passes, and Fly Machines come third.
- **The token** (§4, Secrets): `DIGITALOCEAN_TOKEN` lives in the human's shell environment; the hub reads it at use and never stores it.

Not in this epic: the MicroVM and Fly backends themselves; macOS runners (T-256's non-goals); the verify line and the queue view in the sessions panel ("Sessions: stopped sessions, verifiers' items, the queue line").

Choices where the spec is silent:

- The executor is chosen in `config.toml` under `[verify]`: `executor = "local"` (the default) or `"droplet"`, `remote_budget` (4), `region` with fallbacks (the regions where the account is offered `c-8`: lon1, nyc1 and sfo2 in the prototype), `size` (`c-8`), `run_timeout_minutes` (75), `lifetime_minutes` (110) and `daily_spend_usd` (5). With a remote executor the queue admits a run to a free remote slot; the local slot takes it only when the remote budget is full or the run asks for `--local`.
- The executor is also a per-run choice: `cland verify --executor local|droplet` (and the same field on the session's verify request) overrides the project default for that run; local and remote stay switchable and never a hard binding, the human picks remote when a release is urgent and local when there is no hurry (the human's addendum of 2026-10-12, spec §3.14). The scheduler, the result cache and the reporting are the same on both paths; the fallback to local past the cap or without a token is announced with a warn-level event, never silent.
- A missing token, a refused create or a spent daily cap sends the run to the local queue with a warn-level event naming the cause; nothing retries a create in a loop.
- `prepare` builds a snapshot keyed by the Node version, the Neovim pin, the `package-lock.json` hash and the base commit, with the packages, `node_modules` and a mirror of the repository baked in; a run delivers a bundle of the candidate against that base; a new key prepares a new snapshot and deletes the old one.
- `acquire` writes a durable lease (provider, resource id, name, tag, address, key, creation time) before it returns, so a restarted hub reattaches through the lease or destroys the machine. Each lease gets a detached watchdog on the hub host that deletes the machine at `lifetime_minutes` whatever the hub does; the sweep runs at hub start and every ten minutes and deletes every tagged machine without a live lease.
- The hub makes an SSH key per lease, gives it to the droplet at create and deletes it with the droplet. The token goes to the provider's API calls only, never to the machine.
- The run starts detached as an ordinary user and leaves an exit code and a done marker; `status` and `log(offset)` poll over SSH for droplets; a lost connection never kills the run.
- The result keeps today's contract (the receipt, the artifact, the tree-hash cache of T-233, the verdict evidence) and adds the executor, the platform (OS, architecture, Node and Neovim versions), the machine's lifetime and its cost. The gate accepts a Linux result as suite evidence; the macOS-only cases run in the release's final local run ("Release v0.1.2 from the item").
- `cland executor status`, `prepare` and `reap` are for the human and the Coordinator: the leases, the snapshot and its key, the day's spend, and a sweep on demand.
- The MicroVM experiment creates billable resources, so the human runs it, or names in an answer to the Coordinator's ask the session that runs it; its summary goes on this epic as an artifact. If it passes, the Coordinator files the MicroVM backend in Follow-ups for a later release; if it fails, the result stays on this epic.

## Tracer-bullet order

1. **The interface with the local executor.** The executor interface with today's suite worker behind it as the local executor, and results that name the executor and the platform. Demo: `cland verify` on a task branch runs as before, and its result names `local` and the machine's platform.
2. **A prepared droplet image.** `prepare` builds the snapshot from its key, `acquire` creates a droplet from it under a durable lease, and `reap` deletes tagged droplets without a live lease. Demo: `cland executor prepare` makes the snapshot, `cland executor status` lists it, and `cland executor reap` deletes a stray droplet made by hand with the tag.
3. **A remote run end to end.** Delivery of the bundle with `CLAND_SUITE_SELECTION`, a detached start as an ordinary user, status and log by offset, collection and release, with the result posted as a local run posts it. Demo: with `executor = "droplet"`, `cland verify` on a task branch posts a green result naming the droplet, its lifetime and its cost, and the droplet is gone.
4. **Safety.** The per-lease watchdog, the sweep at hub start and on its timer, the run timeout, the daily spend cap and the fallback to local with a warn-level event. Demo: the hub is stopped mid-run, the watchdog deletes the droplet at its lifetime, and the next hub start reaps what is left.
5. **The remote budget.** Remote runs admitted up to `remote_budget` in parallel beside the local slot, with the queue showing where each runs. Demo: three task branches verify at once on three droplets, and `cland verify queue` names each run's executor.
6. **The second backend's gate.** The MicroVM experiment run once, with its summary attached here and the decision it settles. Demo: the artifact shows pass or fail on the experiment's four conditions, and a pass has filed the MicroVM backend in Follow-ups.

## Definition of done

QA runs the demo below on `dev`, playing the human's part through the `cland` CLI, and records a clear verdict on this epic with each checkbox verified by its id; the epic then closes. The human does not run this demo (D16 and D19 of v0.1 §4).

In a scratch project with a copy of `dev` and a hub started with the token in its environment, QA sets `[verify] executor = "droplet"`, runs `cland executor prepare`, then `cland verify` on two branches at once, and reads two green results naming their droplets, lifetimes and costs while `cland verify queue` shows both remote. QA stops the hub during a third run and reads the watchdog's deletion and the next start's sweep in the journal; `cland executor status` and the provider's tag listing are empty afterwards. With no token, `cland verify` runs locally with a warn-level event naming the variable. QA searches the journal, the hub log, the artifacts and the item files for the token's value without printing it, and finds nothing. The experiment's artifact is on this epic. The demo costs under a dollar of droplet time.

- [ ] The executor interface (acquire, deliver, prepare, start, status, log, cancel, release, reap) has the local machine and droplets behind it, and nothing in it assumes SSH.
- [ ] A remote run creates from a prepared snapshot, delivers the bundle with `CLAND_SUITE_SELECTION`, runs as an ordinary user, and posts its result as a local run does, naming the executor, the platform, the lifetime and the cost.
- [ ] A durable lease, a per-lease watchdog, the sweep by tag, the run timeout and the daily spend cap leave no machine billing after a hub crash or a hung run.
- [ ] Remote runs have their own budget beside the local cap of one; without a token or past the cap, runs fall back to local with a warn-level event.
- [ ] The token is read from the environment at use and appears in no file, record or log cland writes, and never on the machine.
- [ ] The MicroVM experiment's result is recorded on this epic, and the second backend follows it as decided.
- [ ] `hub/README.md`, the Implementer and QA clauses and the `merge` and `qa` skills describe the executors, their configuration and their cost.

## Dogfooding

When this epic closes, the Coordinator sets `executor = "droplet"` for the project: the rest of the build's suites, the Implementers' `cland verify` runs and the evidence for QA's demos, run on droplets in parallel, and the local machine is left to the human and the sessions.

## Constraints

- **Standing rules.** Every artifact, item, commit and doc in English. Sub-agents never use the hub: the cland tools belong to the session that started them. Only `cland release` pushes to GitHub: commit on the task branch `t/<id>-<slug>` in its worktree, push it to `origin`, the local territory, and reach `dev` only through `cland merge` and its verdict gate. Suites run through `cland verify`. Tests go through the hub's frame protocol first (a real hub, a real spoke, the CLI against a temporary project; `hub/test/harness.ts`) and the fake harnesses in `hub/test/fakes/` second, with the Neovim UI headless from the protocol's other side; no new seams inside the hub. The DigitalOcean token is never stored. Accounts are never rotated.
- **Tests.** The droplet backend is tested against a fake DigitalOcean API (an HTTP server beside the fake harnesses in `hub/test/fakes/`) and a fake machine that runs the delivered tree in a temporary directory; real droplet runs are the Implementer's and QA's checks, never part of `npm test`.
- **ADRs.** 0004 (Agents work on a local git territory): the bundle comes from the territory, and nothing on the machine pushes anywhere. 0003 (The hub is a per-project daemon): the hub owns the queue and the leases, while the watchdog runs apart from it on purpose.
- **Risks.** A stray c-8 costs about $6 a day, so the watchdog must not depend on the hub; billing is per second with a 60-second minimum; `c-8` is offered in a few regions only; two tests were load-sensitive on the droplet's slower vCPUs, which "Suite spend and Linux portability" fixes first.
- **Order.** Fourth in the hub lane, after "Status, fields and instrumentation"; "Accounts and limits" waits for it.

## Links

- Spec: `docs/spec/v0.1.2.md` on `dev`, §3.14 The remote executor; §4 (Order, Secrets).
- Tickets: T-256 (decided, closed into this epic); T-232 (`cland verify`), T-233 (the result cache), T-215 (shards); T-218 (research, A-1142).
- Branches: `prototype/remote-executor` (`docs/research/remote-executor.md`: "What an executor interface needs"; `hub/prototype/remote-executor/`), `research/do-microvms` (`docs/research/do-microvms.md`, the experiment in section 7 and Appendix A).
- ADRs: `docs/adr/0004-agents-work-on-a-local-git-territory.md`, `docs/adr/0003-hub-is-a-per-project-daemon-from-the-bcas-core.md`.
- GLOSSARY: Territory.

## D25: the droplet driver is the first backend (2026-10-13)

Under the human's decision D25 (`docs/spec/v0.1.md` §4), Linux proof and diagnostic runs already use a c-8 DigitalOcean droplet through T-282's scratch driver. That driver is adapted from `prototype/remote-executor` and runs as an ordinary user with process accounting. It carries the `cland` tag, a watchdog and destroy on every exit path. It waits for the droplet to be active with a public IP under a bounded deadline, and it never prints the token.

This epic builds on that driver as its first backend rather than starting from the prototype alone. The limits stay as D25 sets them: at most one cland droplet alive at a time, a lifetime of at most 30 minutes, $2 a day, and create, destroy and cost posted on the item. Lessons from the four T-282 runs on 2026-10-13 (A-1846, A-1874, A-1890) belong in this epic's design:
- `doctl create --wait` returned before the droplet was active.
- A typecheck failure reached a droplet because no local gate ran first.
- The four creates cost about $0.17.

**Open question from E-268 (2026-10-13).** A c-8 runs the hub phase alone in about 1420 s, where the Mac runs the whole suite in about 870 s. The 45-minute c-8 cap from the D25 amendment fits today. Remote executors need either a larger droplet, such as c-16, or the suite split across two droplets per run.

## D27: limits and the droplet size (2026-10-13)

The stand-in decided under D24 (`docs/spec/v0.1.md` §4, D27):

- **D25 still governs the hand driver.** D25's limits govern T-282's hand driver until this epic's hub-owned executor enforces budgets itself. Those limits are one droplet at a time, 30 or 45 minutes, and $2 a day.
- **Config defaults.** This epic ships `remote_budget`, the lifetime, the run timeout and a daily cap as config the hub enforces. The docs keep the defaults in Choices: 4, 110 min, 75 min and $5 a day.
- **This project during the build.** `.cland/config.toml` sets budget 2, lifetime 60 min, run timeout 50 min and $3 a day. The human may raise these later.
- **Enforcement.** The hub refuses a create beyond the budget or the daily cap, and sweeps every droplet past its lifetime. The `cland` tag is mandatory.
- **The DoD demo.** It may run 2 or 3 droplets at once, for at most 15 minutes, once, under the $3 cap. It posts the create, destroy and cost on this epic. The Coordinator tells the stand-in before it starts.
- **Droplet size.** c-8 stays the default for acceptance runs. The executor takes the size per run from config. The demo may include one c-16 run to answer the speed question with numbers: the hub phase time and the cost per run, recorded on this epic for the retrospective. Phases are not split across droplets in this release, which closes the E-268 open question above.

## Plan

```yaml
stages:
  - name: the interface and droplet leases
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-342
      - - T-343
  - name: the prepared snapshot
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-344
  - name: a remote run
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-345
  - name: remote safety
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-346
  - name: the remote budget, the clauses and the second backend's gate
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-347
      - - T-348
      - - T-349
```

## Comments

### human · 2026-10-12T11:38:44.526Z

Addendum recorded (2026-10-12, the human through cland-impl): local and remote execution stay switchable, a per-run choice with a per-project default; the scheduler, result cache and reporting are shared; no silent fallback. In docs/spec/v0.1.2.md §3.14 and this epic's Contents.

### coord · 2026-10-13T20:54:23.135Z

Decision (stand-in, D24, 2026-10-13 ~20:33Z, lane flow): unlinked from E-270. All of E-270's code is merged (T-328 to T-334, stages closed); only its QA demo remains, and it runs on a frozen dev. This epic's first stage starts after the 21:05Z hub restart in parallel with that demo. Its merges onto dev wait for E-270's QA verdict, so the verdict sits on the dev tip.

### coord · 2026-10-13T20:54:23.357Z

Stand-in answers under D24 (2026-10-13 ~21:00Z) on the ticket drafts:
- Q3: read the 15-min demo bound as each demo droplet's lifetime, enforced by the hub (lifetime = "15m" in QA's scratch project). The parallel and hub-stop runs use nvim-only diffs. One c-16 run gets its own 25-min lifetime to record the hub-phase time. Demo total under $0.50.
- Q4: the spend ledger is host-wide at ~/.cland/executor/spend.json, cland's first per-user state. executor status prints its path and today's total (T-346 C8).
- Q5: tags are cland plus cland-p-<hash>. Any cland droplet past lifetime + 10 min is reaped by whoever sweeps.
- Q6: the hand driver retires when T-346 merges.
- Q7: Implementers' real checks in T-343 to T-345 follow D25 by hand: smallest size for lifecycle checks, posted on the item, counted in $2/day.
- Q11: the MicroVM bound is today's c-8 full suite + 10% ≈ 1375 s (T-349).
- Q12: when T-349's stage begins, the Coordinator asks the stand-in, who by default runs it from the human's shell.
Coordinator decisions, approved: config under [verification] with duration strings; --executor local|droplet (the spec's "cloud" becomes "droplet"); manual re-prepare; a dirty candidate goes local with a warn; the runner user; caffeinate on macOS (T-343 C9).
Hub restarts during this epic come from the stand-in's login shell, so DIGITALOCEAN_TOKEN is present.

### coord · 2026-10-14T03:25:01.279Z

Decision (stand-in, D24/D27, 2026-10-14 ~03:28Z):
- T-347's C6 real check may run two c-8 droplets at once, plus the builder, under remote_budget 2, lifetime 15m, run_timeout 5m and the $3/day cap. The ceiling is about $0.13, with every create, destroy and cost posted on T-347.
- This is the one multi-droplet event D27 allows. It starts after the stand-in's MicroVM rerun (T-349) ends and the tag listings are clean.
- Substitution: C6 replaces the parallel part of this epic's DoD demo. QA's demo runs only the hub-stop/watchdog step and the c-16 speed run. qa/briefs/T-271.md will say so.

### coord · 2026-10-14T03:36:37.902Z

T-349 MicroVM experiment result (A-2217, stand-in from the human's shell, two runs on 2026-10-14): FAIL as run, under the research note's rule that a partial result counts as a fail.
- (a) Failed. Run 1 died on the script's PS_PERSONALITY=bsd, which T-280 forbids. In run 2, 45 tests failed: 44 on spawn ssh-keygen ENOENT (no openssh-client) and 1 on EMFILE (nofile 1024).
- (b) Process limits pass.
- (c) Speed passes on the phases that ran: the hub phase took 785 s against about 1420 s on c-8, steal 0%.
- (d) Checkpoint clone and pause pass.
Both failures in (a) are environment gaps an executor would set itself, not MicroVM properties.
Per T-349 C5, nothing is filed now, and the result stays here. A third run with openssh-client and a raised nofile (about $0.25) is the human's call for v0.1.3. The artifact's cost line shows negative values (run 1 ≈ $-0.57), so a stamp or clock error needs correcting; the real spend is under $0.30. Cleanup was verified empty, and the token scan was clean.

### human · 2026-10-14T03:37:16.561Z

A-2217 corrected (stand-in): the cost line mixed local and UTC clocks; from the stamps the MicroVM runs were run 1 03:06–03:15Z (base 190 s, run VM 324 s) ≈ $0.05 and run 2 03:16–03:34Z (base 168 s, run VM 890 s) ≈ $0.10, total ≈ $0.15 for both runs. The verdict, numbers and listings in A-2217 are unchanged.

### coord · 2026-10-14T03:43:39.602Z

D27 amendment (stand-in under D24, 2026-10-14): the single c-16 speed run in QA's demo may use lifetime 35m with run_timeout 25m, about $0.29 at worst; the demo stays under $0.50. Reading of DoD C1: 7 of 9 operations go through the Executor interface, and prepare and reap keep backend signatures behind cland executor. A Tech debt item will unify them. QA brief: qa/briefs/T-271.md.
