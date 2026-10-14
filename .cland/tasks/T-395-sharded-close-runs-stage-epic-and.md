---
id: T-395
kind: task
title: "Sharded close runs: stage, epic and release integrated runs shard the hub phase across droplets within the $3/day cap, balanced by recorded durations, with one merged report"
state: open
status: backlog
size: L
labels:
  - v0.1.3
  - hub
  - ready-for-agent
assignee: null
parent: E-387
blocked_by:
  - T-390
  - T-347
topic: null
branch: null
created: 2026-10-14T12:28:19.467Z
updated: 2026-10-14T12:28:21.112Z
---

## Summary

A c-8 droplet runs the hub phase in about 1,257 s, 1.55 times the Mac. Split across droplets, a full run's wall time drops to the slowest shard plus about 150 s of provisioning and typecheck. By the human's decision (b) of 2026-10-14 12:20Z, only stage, epic and release runs shard, within the $3/day cap. Ordinary integrated batch runs stay on one slot. This ticket adds the occasion on the Coordinator's integrated request, the balanced split, Neovim on the lightest shard, one merged report and the cap check. It also splits `suite.test.ts` and `merge.test.ts` so that no single file is a shard's floor.

## Parent

"Test speed: structural" (R-294), tracer bullet 3; research #8 (`docs/research/test-speed.md` §3.6, §3.10 "Split `suite.test.ts` and `merge.test.ts`"). **Decided (b), 2026-10-14 12:20Z:** sharding applies only to stage, epic and release runs, within $3/day, and batch runs stay on one slot. Needs E-271's executor and T-347's remote budget. Balancing reads `hub/test/durations.json` from quick-03.

## What to build

**The occasion.** `cland verify all --occasion stage|epic|release` (and the same field on the MCP verify request). The Coordinator may set it on an integrated `dev` request; QA may set `epic` for an epic demo run on `dev`. The hub refuses it from any other role, and on any head that is not integrated `dev`, naming the rule. Only a request with an occasion shards. The occasion is recorded on the job and shown in `cland verify queue` and the result.

**The split.**

- The shard count is the free remote slots at admission, up to `[verification] shards` (default 2, this project's `remote_budget`).
- Files go largest first onto the lightest shard, using `durations.json` `files[*].seconds`. Unknown files count as the manifest's median.
- The Neovim phase goes onto the shard with the least hub time, as part of its balance. No extra droplet runs and no local load is added.
- Each shard runs on its own droplet through E-271's executor, with `CLAND_SUITE_SELECTION` naming its files. `hub/src/suite-shards.ts` and `hub/test/run-suite.ts` accept an explicit file list for a shard, keeping the free/machine resource classes inside it.

**The cap.** Before admission the hub reserves every shard's estimated cost against the day's spend ledger (`~/.cland/executor/spend.json`, the $3/day cap). If any reservation would pass the cap, or fewer than two remote slots are free, the run goes whole to one slot. It posts a warn-level notice naming the cause (`sharding skipped: daily spend cap $3 would be exceeded` / `fewer than 2 remote slots free`). It never runs partially sharded and never silently.

**One merged report.** One result per run, with these parts:

- the counts summed across shards;
- the failures with their shard;
- one `shard duration` line per shard with its machine, size, time and cost;
- the total cost;
- the overall wall time, from admission to the last shard collected.

A failed or lost shard fails the run once, naming the shard. The hub does not rerun the shard on its own. The receipt, the artifact (one log per shard plus the merged summary) and the tree-hash cache behave as for an unsharded run. A cache hit for the same tree and mode serves a later sharded request.

**The file splits.** `hub/test/suite.test.ts` (61 tests, 242 s) and `hub/test/merge.test.ts` (40 tests, 182 s) split by theme into files of at most 60 s each in the manifest, with `shards.json` and `durations.json` updated.

**Real check** (the Implementer, under D27/D28): one sharded `--occasion stage` run on a scratch project's copy of `dev` with two c-8 droplets, with create, destroy and cost posted on the item.

## Acceptance criteria

- [ ] C1. Only an integrated `dev` request with `--occasion stage|epic|release` from the Coordinator (or `epic` from QA) shards; other roles, task heads and batch runs are refused or run on one slot, proven by tests against the fake DigitalOcean API.
- [ ] C2. Files are split largest-first by `durations.json`, the Neovim phase goes to the lightest shard, and a test proves the balance on a fixture manifest.
- [ ] C3. When the shards' reservations would pass the daily cap or fewer than two remote slots are free, the run goes whole to one slot with one warn-level notice naming the cause, proven by tests.
- [ ] C4. A sharded run posts one result with summed counts, per-shard duration, machine and cost lines and the total cost; a failed shard fails the run once naming the shard.
- [ ] C5. `suite.test.ts` and `merge.test.ts` are split into files of at most 60 s each in `durations.json`, with every test kept and its assertions unchanged.
- [ ] C6. Measured, real check: a two-shard c-8 `--occasion stage` run of `dev` takes at most 10 minutes wall (about 15 on one slot), with create, destroy, each shard's time and the cost posted on the item.
- [ ] C7. The day's spend after the real check stays under $3, and the provider's `cland` tag listing is empty afterwards.
- [ ] C8. `hub/README.md` (Remote executors, Tests), `docs/agents/tests.md`, the Coordinator and QA clauses and the `merge` and `qa` skills describe `--occasion`, which runs shard, the cap fallback and the cost per run.
