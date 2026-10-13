---
id: T-347
kind: task
title: "The remote budget: remote runs are admitted up to remote_budget in parallel beside the local slot of one, the local slot takes a droplet run only when the remote budget is full, and cland verify queue names each run's executor"
state: open
status: backlog
size: M
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-346
topic: null
branch: null
created: 2026-10-13T20:53:46.081Z
updated: 2026-10-13T20:53:48.292Z
---

## Summary

The scheduler gets two kinds of slot: the local slot of one, behind the compatibility leases as today, and up to `remote_budget` droplet slots. One ordered queue feeds both. A droplet run takes a free remote slot. The local slot takes it only when the remote budget is full, with a warn-level notice, or when the run asks for `--executor local`. `cland verify queue` shows the local holder, every remote run with its droplet, and each waiter's executor.

## Parent

E-271: Remote executors, tracer bullet 5 of 6. Spec: `docs/spec/v0.1.2.md` §3.14: remote runs have their own budget beside the local cap of one. The decisions behind it:

- D27: `remote_budget` defaults to 4 in the docs and is set to 2 for this project during the build. The hub refuses a create beyond the budget.
- The epic's choice: with a remote executor the queue admits a run to a free remote slot; the local slot takes it only when the remote budget is full or the run asks for `--local`.

Prior work: T-215 kept the local budget at one (`verification-budget-capped`). T-218 (A-1142): the queue, not the suite, blocks the crew.

## What to build

**Config.** `[verification] remote_budget`, a positive integer, `4` by default, in `hub/src/init/config.ts`. It is passed to `Suites` beside `budget`. `budget` keeps its cap of one and its `verification-budget-capped` note.

**Admission.** `Suites.#tick` in `hub/src/hub/suites.ts` counts active jobs per executor.

- The order stays as today, from `#ordered`: integrated `dev` runs first, then human hand-run waiters, then item rank, then enqueue order.
- The tick walks the ordered queue and admits:
  - a droplet run while active droplet runs number fewer than `remote_budget`, with no compatibility check;
  - a local run, or a human hand run, only into the local slot when it is free, behind `compatibilityOccupied` as today;
  - a droplet run into a free local slot when the remote budget is full.
- When a droplet run goes to the local slot, the job's executor becomes `local`, and ticket T-346's fallback records it: a warn notice `verify <id>: remote budget <n>/<n> full; running locally`, and `verification-executor-fallback` with the cause `remote budget full`.
- A waiter that cannot be admitted does not block the waiters behind it that can. Example: a local run waiting on a hand holder does not hold back a droplet run behind it.
- The per-session rule stays: one active suite per session.
- Launch is not serialized. Several acquires may be in flight at once, each under its own lease and watchdog. Ticket T-346's spend cap is checked for each.

**The queue.** `VerificationQueue` in `hub/src/protocol.ts` grows without breaking its readers. `holder` stays the local holder, which the Neovim verify line reads (`nvim/lua/cland/verification.lua`, unchanged).

- New field `remote: VerificationHolder[]`. Each entry has `executor: 'droplet'`, `machine` (name, size, region), `since`, `runMs` and `etaMs`.
- Waiters gain `executor`, the one they asked for.
- The ETA uses each executor's own median from recent runs (`estimate` in `Suites.snapshot` gains an executor filter). A droplet run's median includes its acquire time.
- Admitted droplet runs no longer push back the local waiters' ETA.

`cland verify queue` (`hub/src/cli/suite.ts`) prints three kinds of line:

- `local: <holder or none>`;
- `remote <active>/<budget>: <session> · <item> · droplet <name> <size> <region> · since <t> · ETA <d>`, one per remote run;
- the waiters, each with its executor.

`--json` carries the same fields.

**Journal.** `verification-timing` already carries `executor` (ticket T-342). Add `remoteActive` and `remoteBudget` to `verification-admitted` (a new record) when a droplet run is admitted.

**Docs.** `hub/README.md`: the admission paragraph, which currently says that `[verification].budget` defaults to 1, gains `remote_budget`, the slot rule, the fallback to the local slot, and the new queue lines. `docs/agents/tests.md`: the queue output.

**Demo** (the epic's words, within D27's 2 or 3 droplets). Three task branches verify at once on three droplets, and `cland verify queue` names each run's executor.

**Out of scope.** The sessions panel's queue line and the queue view in Neovim (epic "Sessions: stopped sessions, verifiers' items, the queue line"). Any change to the cache or the report.

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on a temporary project. Several fixture worktrees with their own sessions submit at once, in the style of `hub/test/suite.test.ts`. They run against the fake API and the fake machine, and fake runs wait on files, not sleeps. No `npm test` case reaches DigitalOcean.
- No new seams inside the hub. Classify new test files in `hub/test/shards.json`. Read the logs after the `flushLogs` barrier (T-291).
- A real check runs in a scratch project hub on the branch, with `remote_budget = 2`, `lifetime = "15m"` and two branches whose diffs select `nvim-only` (a few minutes each). Post create, destroy and cost on this item.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. With `remote_budget = 3`, three sessions submit `cland verify --executor droplet` at once. Three fake droplets run in parallel, and while they run, a fourth session's local run and a human hand run take the local slot in turn.
- [ ] C2. With `remote_budget = 2` and the local slot free, a third droplet run goes to the local slot. It gets one warn notice with the cause `remote budget full` and a `verification-executor-fallback` record. With the local slot busy too, it waits and is admitted to the first slot that frees.
- [ ] C3. `cland verify queue` and `--json` show the local holder, both remote runs with droplet name, size and region, and each waiter's requested executor. Every existing queue assertion in `hub/test/suite.test.ts` still passes.
- [ ] C4. A local waiter held by a hand holder does not block a droplet waiter behind it. A droplet waiter refused for the cap falls back and does not block the queue.
- [ ] C5. The fake API never sees more than `remote_budget` live droplets from one hub, and every acquire passes the shared spend cap.
- [ ] C6. Real check, posted on this item: two nvim-only branches verify at once on two droplets in a scratch project, with both results, `cland verify queue` captured during the runs, and the costs.
- [ ] C7. `hub/README.md` and `docs/agents/tests.md` describe `remote_budget`, the slot rule and the queue lines.
