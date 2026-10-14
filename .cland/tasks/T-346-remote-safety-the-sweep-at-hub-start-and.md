---
id: T-346
kind: task
title: "Remote safety: the sweep at hub start and every ten minutes, the run timeout, a daily spend cap on a ledger shared by every hub on the host, and the fallback to local with a warn-level event"
state: open
status: in progress
size: L
criterion_seq: 10
labels:
  - v0.1.2
  - hub
  - ready-for-agent
assignee: null
parent: E-271
blocked_by:
  - T-345
topic: topic-230
branch: t/T-346-remote-safety-the-sweep-at-hub-start-and
created: 2026-10-13T20:53:45.976Z
updated: 2026-10-14T02:04:30.917Z
---

## Summary

This ticket makes a forgotten machine impossible to keep billing, and makes every refusal visible. It adds:

- the sweep at hub start and on a ten-minute timer;
- re-arming of dead watchdogs;
- a configured run timeout;
- a daily spend cap, enforced before every create against one ledger that all hubs on the host share.

A missing token, a refused create, a spent cap, a missing snapshot or a dirty worktree each send the run to the local queue. The hub announces that with a warn-level event naming the cause, and never retries a create in a loop.

## Parent

E-271: Remote executors, tracer bullet 4 of 6. Spec: `docs/spec/v0.1.2.md` §3.14: a lifetime watchdog, an orphan sweep by tag and a spend cap; no silent fallback. The decisions behind it:

- D27: the hub ships the lifetime, the run timeout and a daily cap as config it enforces. The documented defaults are 110 min, 75 min and $5 a day. This project's build values are 60 min, 50 min and $3 a day. The hub refuses a create beyond the cap and sweeps every droplet past its lifetime.
- D25: the hand driver keeps its own limits until this ticket lands.

Prior work: T-282's `c8-run.py` (A-1917), which reserved before create, counted the UTC day and a rolling 24 hours, and blocked new admission while a cleanup was unconfirmed. Its shared ledger A-1906 taught a lesson: one ledger for every owner on the machine, not one per copy.

## What to build

**The sweep.** Ticket T-343's `reap` plus lease reconciliation runs at hub start and then every 10 minutes, on an unref'd timer (tests shorten it through `CLAND_TEST_EXECUTOR_SWEEP_MS`). Reconciliation does three things:

- It journals `executor-watchdog-fired` from each new `watchdog.json`.
- It re-arms the dead watchdog of a live lease for the remaining time (`executor-watchdog-rearmed`).
- It retries every `releasing` lease.

Each pass journals `executor-sweep`, with counts of leases, reaped droplets, reaped keys and failures. A provider error is logged and retried on the next pass, never in a tight loop.

**The run timeout.** `[verification] run_timeout` is a duration, `"75m"` by default.

- `run.sh` wraps the commands in `timeout <run_timeout>`.
- The hub also ends a remote run older than `run_timeout` plus 2 minutes: it cancels, collects and releases, and reports the cause `run timeout <run_timeout>`.
- Config validation refuses a `lifetime` shorter than `run_timeout` plus 10 minutes (acquire, delivery and collection), naming both values.

**The daily cap.** `[verification] daily_spend_usd`, `5` by default.

- The ledger is machine-wide: `~/.cland/executor/spend.json`, or `$CLAND_EXECUTOR_STATE/spend.json` for tests. Every hub on the host shares it under an exclusive lock: the project hub, scratch QA hubs and Implementers' scratch hubs.
- Each acquire, the prepare builder included, reserves `lifetime × price_hourly` before the create call. It refuses when the UTC day's spent plus reserved plus this reservation would exceed the running hub's cap.
- Release replaces the reservation with the actual cost. An unconfirmed release keeps its reservation.
- Entries carry the project, the lease, the run, the size, the reservation, the cost and the times, and never the token.
- `cland executor status` shows the day's spent, reserved and cap.
- The ledger is an estimate from the size's price and the lifetime, not an invoice (DigitalOcean bills per second, with a 60-second minimum).

**Refusals and the fallback.** Each of the following causes sends a droplet run to the local queue, with `executor: local` on the job:

- `DIGITALOCEAN_TOKEN` is absent;
- the API refuses the create, or a 4xx or 5xx answer comes back;
- no configured region offers the size;
- there is no prepared snapshot;
- the daily cap is spent;
- the worktree is dirty (a bundle carries commits only).

Two records announce it:

- A hub notice in the run's topic, to the run's recipients: `verify <id>: droplet unavailable (<cause>); running locally`. `warningSeverity` in `hub/src/hub/visibility.ts` projects it as `severity: 'warn'` on the messages and inbox surfaces, as a not-clear verdict is.
- A journal record `verification-executor-fallback` with `{ id, item, requested, effective, cause }`.

One create attempt per run; nothing retries in a loop. A `--executor droplet` request falls back the same way. The notice is the "reports as such" of spec §3.14.

**The token check.** One end-to-end test runs prepare, a remote run, a fallback, a cancel and a watchdog firing against the fakes. It then searches for the sentinel in these places and finds nothing:

- under `.cland/`: the journal, `hub.log`, `run/`, the artifacts and the item files;
- in the fake machine directories;
- in the fake API's request bodies;
- in the spend ledger;
- in the `ps` command lines of the hub's children.

**The crash path** (the epic's demo, against the fakes). A remote run is in flight with `lifetime = "20s"`, and the hub is stopped. The watchdog deletes the droplet at its lifetime. The next start journals `executor-watchdog-fired` and `executor-sweep`, and reports the run once with `remote machine lifetime expired`. `cland executor status` and the fake's tag listing are empty.

**The hand driver.** Once this ticket is on `dev`, D27 hands the D25 limits over to the hub's enforced config. `hub/README.md` says so: Linux proof runs go through `cland verify --executor droplet`, and T-282's hand driver is retired. Its droplets carry only the `cland` tag and are swept only past the lifetime.

**Docs.** `hub/README.md`, "Remote executors: droplets": the sweep, the watchdog's re-arming, `run_timeout`, `daily_spend_usd` and the shared ledger, the fallback causes and their warn notice, and the config table with the defaults (110m, 75m, $5) and D27's build values for this project (60m, 50m, $3).

**Demo** (the epic's words). The hub is stopped mid-run, the watchdog deletes the droplet at its lifetime, and the next hub start reaps what is left.

**Out of scope.** The remote budget and parallel admission (ticket T-347). The clauses and skills (ticket T-348). Setting this project's config values: the Coordinator commits them on `dev` (see NOTES).

**Constraints.**

- Tests go through the frame protocol first: a real hub, a real spoke and the CLI on temporary projects. Two fixture projects share one `CLAND_EXECUTOR_STATE` to prove the shared cap. Tests run against the fake API and the fake machine. No `npm test` case reaches DigitalOcean.
- No new seams inside the hub: only environment and `CLAND_TEST_*` overrides, as `CLAND_TEST_EVENT_WINDOW_MS` is. Classify new test files in `hub/test/shards.json`. Read the logs after the `flushLogs` barrier (T-291).
- A real check runs in a scratch project hub on the branch, with that project's `lifetime = "15m"` and `daily_spend_usd = 3`, one droplet, and create, destroy and cost posted on this item.
- Suites run through `cland verify`, after a clear source review, at the exact reviewed head (D25).
- Commit on the task branch and push it to `origin`; `dev` is reached only through `cland merge`. Everything is in English.

## Acceptance criteria

- [ ] C1. The sweep runs at hub start and on its timer. It reaps a stray tagged droplet, journals `executor-watchdog-fired` from a receipt, re-arms the killed watchdog of a live lease, and retries a `releasing` lease until confirmed. Each pass journals `executor-sweep`.
  - failed: rev-26 [reviewer] · 2026-10-14T02:04:30.917Z · note Automatic sweep can delete foreign live droplets using the shorter hub lifetime, or concurrent new droplets/keys using ownership snapshots captured before provider listing.
- [x] C2. A remote run past `run_timeout` is ended, reported once with `run timeout <value>`, and its droplet released. A `lifetime` shorter than `run_timeout` plus 10 minutes is refused at config load, naming both.
  - done: impl-346 · 2026-10-14T02:02:51.042Z
- [x] C3. With `daily_spend_usd` set just above one reservation, a second droplet run on a second fixture project sharing the ledger falls back to local with the cause `daily spend cap $<cap> reached`. Its fake API received no create. After the first run is released, the ledger holds its actual cost, not the reservation.
  - done: impl-346 · 2026-10-14T02:02:51.977Z
- [x] C4. Without `DIGITALOCEAN_TOKEN`, `cland verify --executor droplet` runs locally. Its topic gets one notice with `severity: 'warn'` naming `DIGITALOCEAN_TOKEN`, and the journal gets `verification-executor-fallback`. A create the fake refuses with 422, a missing snapshot and a dirty worktree each fall back with their own cause, after exactly one create attempt or none.
  - done: impl-346 · 2026-10-14T02:02:54.164Z
- [x] C5. The crash path above passes against the fakes: the hub is stopped mid-run, the watchdog deletes the droplet, the next start journals the firing and the sweep, the run is reported once, and status and the tag listing are empty.
  - done: impl-346 · 2026-10-14T02:02:55.141Z
- [x] C6. The end-to-end sentinel search finds the token nowhere.
  - done: impl-346 · 2026-10-14T02:02:56.731Z
- [ ] C7. Real check, posted on this item with create, destroy and cost. In a scratch project with `lifetime = "15m"`, the hub is stopped during a remote run. The watchdog's deletion and the next start's sweep are in that project's journal, and the provider's `cland` tag listing is empty.
- [x] C8. `cland executor status` prints the shared ledger's path and today's total against the cap. `hub/README.md` documents the ledger as cland's first per-user state (D27 follow-up, stand-in under D24, 2026-10-13).
  - done: impl-346 · 2026-10-14T02:02:57.754Z
- [x] C9. `hub/README.md` describes the sweep, the run timeout, the cap and its shared ledger, the fallback, the defaults and this project's D27 values, and the hand driver's retirement.
  - done: impl-346 · 2026-10-14T02:02:58.640Z
- [x] C10. SSH keys are named with the project-hash prefix used by the droplet tag (cland-p-<hash>), and the automatic orphan-key reap deletes only keys with this project's hash prefix. A legacy cland-<name>- key is reaped only when no live lease of any hub on the host names it and it is older than lifetime plus 10 minutes. A test runs two hubs with the same project name and shows neither reaps the other's in-flight key (found by impl-346, 2026-10-14; regression of T-343).
  - done: impl-346 · 2026-10-14T02:02:59.439Z

## Comments

### impl-346 · 2026-10-14T01:49:32.435Z

Real C7 preflight at 2026-10-14 01:46Z: provider cland tag listing empty; no snapshots. Scratch hub config lifetime=15m, run_timeout=5m, daily_spend_usd=3; smallest available s-1vcpu-1gb ($0.00893/hour), lon1, same size for prepare/run. Builder create: 608872238 (cland-t346-real-3f2934ba), created 01:47:41.150Z, deadline 02:02:41.150Z, watchdog alive. Shared ledger reservation $0.0022325. D25 manual supervision remains active. This is setup for the crash proof, not suite evidence; no n8n resource touched.

### impl-346 · 2026-10-14T01:51:31.809Z

Real prepare completed: builder 608872238 deleted and release confirmed at 2026-10-14 01:50:29Z. Lifetime 164786ms, estimated cost $0.00040876083, reservation replaced with cost in ~/.cland/executor/spend.json. Prepared snapshot 249682656 (cland-t346-real-a2d92b3bd07e, lon1, 25GB minimum disk). Provider cland tag listing empty and leases empty. Holding the snapshot for C7's stopped-hub run after source review; final cleanup will delete this owned snapshot.

### impl-346 · 2026-10-14T02:03:00.047Z

Implementation done at pushed af17a3b8f7b16d77ab27241cfcced5d18835a4af; source review routed to rev-26. C1–C6/C8–C10 marked done; C7 remains pending real stopped-hub crash proof after source-clear. Focused evidence: safety file 15/15 (before C10), C10 shared-account same-name/two-hub in-flight and conservative legacy test 1/1, lifecycle after C10 12/12, prepare 11/11, corrected dirty fallback CLI/queue/warn check 1/1. Both typechecks and shard lint pass. A-2174 is the durable implementation/setup note. C7 builder 608872238 is already released; snapshot 249682656 is owned and held only until the real crash proof, then deleted. No full suite has run before source review. T-371 shared-fix instruction acknowledged; no merged commit is supplied yet.

### rev-26 · 2026-10-14T02:04:30.917Z

verdict: review
result: not clear
by: rev-26 [reviewer]
run: rev-20261014-346-source-1
commit: af17a3b8f7b16d77ab27241cfcced5d18835a4af
scope: full

High — hub/src/executor/droplet/droplet.ts:289: Global age deletion uses this hub's lifetime before checking foreign live ownership, so a 15m scratch hub can delete a valid 110m project's active droplet after 25m.
High — hub/src/executor/droplet/droplet.ts:282: Local ownership is captured before provider listing; an acquire during that await appears orphaned and is deleted. The same ordering affects keys at lines 304–305. Refresh ownership after provider listing before deletion or serialize safely, with deterministic interleaving regressions.
Standards: no independent high/medium finding. Spec: two high findings. C7 real proof and full verification remain pending; wait for corrected exact-head source clear. Evidence A-2178: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-2178-t-346-source-review-not-clear-at-af17a3b8-automatic-sweep-can-reap-live-resource.md.

Criteria: C1 failed (Automatic sweep can delete foreign live droplets using the shorter hub lifetime, or concurrent new droplets/keys using ownership snapshots captured before provider listing.).
