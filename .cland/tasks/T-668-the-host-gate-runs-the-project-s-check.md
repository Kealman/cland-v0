---
id: T-668
kind: task
title: The host gate runs the project's check, and only cland's own suite is sharded
state: open
status: planned
size: S
labels:
  - v0.1.4
  - verification
assignee: null
parent: E-614
blocked_by:
  - T-667
topic: null
branch: null
created: 2026-10-16T16:35:25.248Z
updated: 2026-10-16T16:36:04.170Z
---

## Summary

Before a droplet is made, the host gate runs the recorded `check` and names it in its result, and it is skipped with a line when `check` is unset (E-614 C1, the host gate). Stage, epic and release closes are sharded only for a candidate carrying cland's own runner. Another project's close runs its `test` once.

## What to build

- **The host gate** (`#hostGate` in `hub/src/hub/suites.ts`). It runs the job's recorded `check` (ticket T-666) and logs `Host gate: <line>`. On failure it reports `host check failed (exit <n>); no droplet created`, replacing `host typecheck failed`. An unset `check` logs `Host gate: check not set` and goes on to acquisition. Update the tests and docs that match the old text, and grep `hub/`, `nvim/` and `docs/` for `host typecheck failed`.
- **Shards** (`#planShards`). A candidate without cland's runner (ticket T-667's predicate) is never sharded. Its close run records `sharding skipped: project commands are not sharded` through the existing `onShardingSkipped` path and the `verification-sharding-skipped` log event, then runs once on one droplet. The stage-cover rules (`stageCovers`) treat that skip as they treat any recorded skip today.

**Keeping cland's own suite intact.** This repository's `check` is `npm run typecheck`, so its host gate runs the same command. Only the failure message's word changes, from "typecheck" to "check". Its candidates carry the runner, so sharding, shard reservation, coverage merging and stage covers stay as they are. The stage close after this ticket uses the usual sharded droplet cover, which proves that.

## Acceptance criteria

- [ ] C1. A fake-droplet run whose `check` fails on the host reports `host check failed (exit 2); no droplet created`, and the fake API saw no create (`executor-run.test.ts`, the host-failure case updated).
- [ ] C2. A fake-droplet run with `check` unset logs `Host gate: check not set` and runs on the machine.
- [ ] C3. An integrated `verify all --occasion stage` of a project without cland's runner on the fake droplet skips sharding with `project commands are not sharded` and runs on one machine (`suite-stage-cover.test.ts` or `suite-close.test.ts`).
- [ ] C4. A cland-shaped close run is still split into its shards, and the existing `suite-close.test.ts` and `suite-stage-cover.test.ts` cases pass unchanged.
