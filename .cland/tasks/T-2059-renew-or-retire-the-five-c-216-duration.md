---
id: T-2059
kind: task
title: Renew or retire the five C-216 duration allowances that expire on 2026-11-27, before they fail every suite
state: open
status: planned
size: XS
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-22T00:42:20.803Z
updated: 2026-11-22T00:42:32.574Z
---

## Summary

The heartbeat of 2026-11-22 00:42Z lists five duration allowances owned by C-216 that expire on 2026-11-27 at 00:00 UTC. An expired allowance fails every suite:
- `hub/test/fake-claude-cleanup.test.ts::fake Claude final census detects dropped cleanup`;
- `hub/test/fake-claude-cleanup.test.ts::orphan sweep joins a fake Claude session after its fixture worker is killed`;
- `hub/test/host-allow-list.test.ts::immediate merge revokes every host lease before landing the task`;
- `hub/test/prune-process-lifecycle.test.ts::hub crash after durable writer release is reconciled by restart before territory admission`;
- `hub/test/suite-stage-cover.test.ts::after-stage gates close on sharded Linux, retain history and advance without a Mac full cover`.

## What to build

For each identity, take the worst passing Linux sample from fresh receipts. For example, today's green batches 0213007e and 5dd0468c, the dev cover 6a4791fb, or a new verify. If it fits its tier budget, remove the allowance. Otherwise, renew it under C-216 at 1.5 times the worst sample, with a seven-day expiry and a reason citing the samples. Do this on or after 2026-11-23, so the new expiry passes 2026-11-30. Run every test file that pins the durations config before committing (rule 33). Land before 2026-11-26, together with T-2052's renewal if convenient.

## Acceptance criteria

- [ ] C1. Each of the five identities is either removed (sample within budget) or renewed with an expiry at least seven days out and a reason citing fresh Linux samples (evidence).
