---
id: T-1190
kind: task
title: Duration allowances expire overnight with no warning and fail every shard plan
state: open
status: review
size: S
criterion_seq: 2
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: topic-925
branch: t/T-1190-duration-allowances-expire-overnight
created: 2026-10-24T00:03:56.390Z
updated: 2026-10-24T06:52:21.474Z
---

## Summary

At 00:00Z on 2026-10-24 the duration allowance for `hub/test/cli-identity.test.ts::a launched session cannot borrow another identity…` expired. From then on every T3 shard plan failed with `ShardManifestError: expired duration allowance`: periodic dev T3 run 3bb25b4e at 7bdf8367, A-10287. Twenty-four more E-880 allowances were due to expire by 2026-10-26. The Coordinator renewed all 25 to 2026-11-23 under D72 (6673d75e). Expiry is a calendar event, but nothing warns before it: a whole release cover can turn red overnight with no code change.

## What to build

Warn ahead of expiry instead of failing at shard planning. For example:
- the periodic dev T3 report and the hub's heartbeat list allowances expiring within 48 hours, with their owner;
- `cland durations renew --owner <id> --until <date>` applies a reviewed renewal within the owner's span limit.

Planning still refuses an expired entry, but the refusal names every expired key and the renewal command.

## Acceptance criteria

- [x] C1. An allowance expiring within 48 hours appears in the periodic dev run report and the Coordinator's heartbeat, naming the test and owner (test).
  - done: impl-1190 · 2026-10-24T06:52:04.562Z
- [x] C2. A shard-planning refusal for expired allowances lists every expired key, not only the first (test).
  - done: impl-1190 · 2026-10-24T06:52:05.168Z

## Comments

### impl-1190 · 2026-10-24T06:50:56.795Z

Implementation uses one reusable midnight-UTC expiry listing in suite-durations.ts. Shard planning aggregates expired keys. The hub reads the current project manifest at Coordinator heartbeat and periodic dev-T3 report time, warning for every allowance at <=48h and already expired entries. Added failing-then-green tests at packageShards, native heartbeat injection with FakeClock, and published periodic result. Optional renew CLI omitted; seconds/reasons and durations.json unchanged. hub/README.md documents flow; docs/agents/tests.md left untouched for T-1199.
