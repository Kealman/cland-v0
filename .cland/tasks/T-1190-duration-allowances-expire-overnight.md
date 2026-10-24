---
id: T-1190
kind: task
title: Duration allowances expire overnight with no warning and fail every shard plan
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1195
blocked_by: []
topic: null
branch: null
created: 2026-10-24T00:03:56.390Z
updated: 2026-10-24T06:46:52.049Z
---

## Summary

At 00:00Z on 2026-10-24 the duration allowance for `hub/test/cli-identity.test.ts::a launched session cannot borrow another identity…` expired. From then on every T3 shard plan failed with `ShardManifestError: expired duration allowance`: periodic dev T3 run 3bb25b4e at 7bdf8367, A-10287. Twenty-four more E-880 allowances were due to expire by 2026-10-26. The Coordinator renewed all 25 to 2026-11-23 under D72 (6673d75e). Expiry is a calendar event, but nothing warns before it: a whole release cover can turn red overnight with no code change.

## What to build

Warn ahead of expiry instead of failing at shard planning. For example:
- the periodic dev T3 report and the hub's heartbeat list allowances expiring within 48 hours, with their owner;
- `cland durations renew --owner <id> --until <date>` applies a reviewed renewal within the owner's span limit.

Planning still refuses an expired entry, but the refusal names every expired key and the renewal command.

## Acceptance criteria

- [ ] C1. An allowance expiring within 48 hours appears in the periodic dev run report and the Coordinator's heartbeat, naming the test and owner (test).
- [ ] C2. A shard-planning refusal for expired allowances lists every expired key, not only the first (test).
