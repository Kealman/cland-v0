---
id: T-271
kind: epic
title: Remote executors
state: open
labels:
  - epic
  - v0.1.2
  - ready-for-agent
assignee: null
parent: T-228
blocked_by:
  - T-270
topic: null
branch: null
created: 2026-10-12T11:35:13.919Z
updated: 2026-10-12T11:38:44.526Z
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

## Comments

### human · 2026-10-12T11:38:44.526Z

Addendum recorded (2026-10-12, the human through cland-impl): local and remote execution stay switchable, a per-run choice with a per-project default; the scheduler, result cache and reporting are shared; no silent fallback. In docs/spec/v0.1.2.md §3.14 and this epic's Contents.
