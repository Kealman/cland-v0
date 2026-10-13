---
id: T-342
kind: task
title: "The executor interface: cland verify runs through an executor with today's suite worker behind it as the local executor, and every result names its executor and platform"
state: open
status: planned
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by: []
topic: null
branch: null
created: 2026-10-13T20:53:45.416Z
updated: 2026-10-13T20:54:00.219Z
---

## Summary

This ticket adds cland's own executor interface in `hub/src/executor/`, built on acquire, deliver, prepare, start, status, log, cancel, release and reap. Today's detached suite worker moves behind it as the `local` executor, and its behaviour stays as it is. Every result, the verify card and the journal then name the executor and the platform: OS, architecture, and the Node and Neovim versions.

## Parent

E-271: Remote executors, tracer bullet 1 of 6. Spec: `docs/spec/v0.1.2.md` §3.14 ("The executor", "Local and remote stay switchable"). Research: `docs/research/remote-executor.md` on `prototype/remote-executor`, "What an executor interface needs", and `docs/research/do-microvms.md` on `research/do-microvms`, §4.4 (no SSH in the interface, a `paused` state). Tickets: T-232 (`cland verify`), T-233 (the result cache), T-215 (shards). ADR 0003: the hub owns the queue and the leases.

## What to build

**The interface.** A new module, `hub/src/executor/executor.ts`, holds only types and the operation contract:

- `ExecutorKind = 'local' | 'droplet'`.
- `RunRef`: what one run needs from the hub's `SuiteJob` (id, cwd, head, tree, mode, selection, the paths of the log, the receipt and the gate).
- `Lease`: a durable JSON record (`kind`, `run`, `created`, `deadline`, and a backend-owned `resource` payload the interface never reads).
- `RunStatus = { state: 'pending' | 'running' | 'done' | 'lost' | 'paused'; code?: number; cause?: string }`. `paused` is there for the MicroVM backend, as research §4.4 asks.
- `Platform = { os: string; arch: string; release: string; node: string; nvim: string }`.
- `Released = { lifetimeMs: number | null; costUsd: number | null }`.
- `Executor` with nine operations:
  - `acquire(run, deadline)` returns a lease.
  - `prepare(key)`.
  - `deliver(lease, run)`.
  - `start(lease, run)`: idempotent and fire-and-forget; the run outlives the hub.
  - `status(lease)`.
  - `log(lease, offset)` returns `{ text, next }`.
  - `cancel(lease, signal)`.
  - `release(lease)` returns `Released`.
  - `reap(olderThanMs?)`.

Nothing in the module names SSH, a host, an address or a key. A backend keeps those inside its own `resource` payload.

**The local executor.** A new module, `hub/src/executor/local.ts`, takes over what `Suites.#launch` and `Suites.#inspect` in `hub/src/hub/suites.ts` do today. Each operation maps onto existing code:

- `acquire`: the one local slot behind the compatibility leases (`compatibilityOccupied` and `compatibilityHolder` in `hub/src/suite-lock.ts`).
- `deliver` and `prepare`: nothing. The worktree is the tree.
- `start`: spawns `hub/src/hub/suite-worker.ts` detached on `job.json`, as today.
- `status`: reads the `result.json` receipt and the worker's PID and start identity (`pidAlive`, `processStartedAsync`).
- `log`: reads `suite.log` from an offset.
- `cancel`: signals the worker's group.
- `release`: the crash cleanup over the worker group that `#inspect` runs today (`endProcess`).
- `reap`: the restart reconciliation.

`suite-worker.ts` keeps its contract unchanged: the gate, the compatibility leases, `checkHead`, `CLAND_SUITE_SELECTION` and the receipt. Factor its command list into an exported `suiteCommands(job)`: ticket T-345 runs the same commands on a droplet. `Suites` keeps everything that is shared by every executor (the human's addendum, spec §3.14): the queue and its order, the per-session single active run, the tree-hash cache, the timings, the verify card and the report. `Suites` calls the executor and no longer spawns or inspects processes itself.

**The record.** `SuiteJob` gains `executor: ExecutorKind`, `platform?: Platform` and `machine?: { name?: string; size?: string; region?: string; lifetimeMs: number | null; costUsd: number | null }`. Ticket T-345 fills `machine` for droplets. A record written before this ticket has no `executor` and reads as `local`. `VerifyResult` (the card, and `task.view`'s `verify`) gains `executor`. `SuiteStatus` in `hub/src/protocol.ts` gains `executor` and `platform`.

**The platform.** The local worker measures the platform before typecheck and writes it into the receipt as `{ code, cause, finished, platform }`. It also writes the log line `platform darwin arm64 25.0.0 · Node v24.21.0 · Neovim v0.12.5`.

- OS, architecture and release come from `os.platform()`, `os.arch()` and `os.release()`.
- Node is `node --version`, run with the worker's environment in the job's cwd: the Node that `npm` will run, not the hub's `process.execPath`.
- Neovim is the pin in the candidate's `nvim/NVIM_VERSION`; the harness runs exactly the pinned build (`nvim/test/harness.ts`). When the file is absent, as in fixture packages, it is `none`.

**The report.** `Dispatcher.#reportSuite` in `hub/src/hub/dispatch.ts` adds one line after the branch and head line: `Executor local · darwin arm64 · Node v24.21.0 · Neovim v0.12.5`. The bounded fallback texts keep that line. The `suite-result` and `verification-timing` journal records gain `executor` and `platform`. A cached result names the original run's executor and platform. The cache key stays the tree and the mode (T-233), so a result from any executor serves a later request on either.

**Docs.**

- `hub/README.md`: the `cland verify` paragraph gains the executor and platform line. A short "Executors" paragraph lists the nine operations and says that `local` is the default and the only executor so far.
- `docs/agents/tests.md`: the result's new line.
- `GLOSSARY.md`: an **Executor** entry: where a verification run executes, behind one interface. The queue, the cache and the report are the same on every executor.

**Demo** (the epic's words). `cland verify` on a task branch runs as before. Its result names `local` and the machine's platform.

**Out of scope.** Any droplet code (tickets T-343 to 05). The `executor` config key and `--executor` (ticket T-345). Any change to admission or the budget (ticket T-347). The queue's display.

**Constraints.**

- This is a behaviour-preserving refactor of the local path. Existing assertions, deadlines and fixtures in `hub/test/suite.test.ts`, `hub/test/suite-runner.test.ts`, `hub/test/verifier-routing.test.ts` and the merge and stage-QA tests stay as they are. Add assertions only.
- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project (`hub/test/harness.ts`; the fixture of `hub/test/suite.test.ts`). The fake harnesses in `hub/test/fakes/` come second.
- No new seams inside the hub. Put new helpers in the test file or a new helper module, never in `hub/test/harness.ts`. Classify any new test file in `hub/test/shards.json`; otherwise `cland verify` refuses it.
- A test that reads `hub.log` or `journal.jsonl` after an action first waits on the `hub.status` `flushLogs` barrier (T-291).
- Suites run through `cland verify`, only after a clear source review and at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`. `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. `hub/src/executor/executor.ts` declares the nine operations, the `paused` state and the types above. A test reads the module's source and finds none of `ssh`, `scp`, `host`, `address` or `key` among its identifiers.
- [ ] C2. Every existing case in `hub/test/suite.test.ts`, `suite-runner.test.ts` and `verifier-routing.test.ts` passes. No assertion, deadline or fixture is changed; the diff in those files only adds assertions.
- [ ] C3. A real-hub test runs `cland verify` on a fixture project. The posted result has the line `Executor local · <os> <arch> · Node <v> · Neovim none`. `cland task view --json` shows `verify.executor` as `local`. After the `flushLogs` barrier, the journal's `suite-result` and `verification-timing` records carry `executor` and `platform`.
- [ ] C4. A cache hit names the original run's executor and platform. A job record without `executor`, restored from `hub.db`, reads as `local` and reports as before.
- [ ] C5. A run admitted before `cland hub stop` finishes and is reported exactly once after the next start, through the local executor's `status`. Its record carries `executor` and `platform`.
- [ ] C6. `hub/README.md`, `docs/agents/tests.md` and the GLOSSARY's Executor entry describe the interface and the result line.
