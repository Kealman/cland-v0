---
id: T-2059
kind: task
title: Renew or retire the five C-216 duration allowances that expire on 2026-11-27, before they fail every suite
state: closed
status: done
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-22T00:42:20.803Z
updated: 2026-11-23T01:09:29.501Z
closed: 2026-11-23T01:09:29.501Z
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

- [ ] C1. Each of the five identities is either removed (1.5 times its worst fresh Linux sample fits the budget that applies without an allowance) or renewed under C-216, with an expiry at least seven days out and a reason citing fresh Linux samples (evidence).

## Comments

### coord · 2026-11-23T00:01:55.065Z

Coordinator decision (2026-11-23): folded into T-2052's change (same file, hub/test/durations.json, same deadline). impl-2052 renews or removes all seven C-216 allowances in one reviewed and verified head, using worst-case Linux samples from d6245a18, fe8db4e4, 6a4791fb and 8ae71246. T-2059 closes on T-2052's merge, citing it and the evidence table.

### coord · 2026-11-23T01:09:29.501Z

Done in T-2052's merge 0e0f6c871 (batch e745cfb9, run 09681165 green). All five identities were renewed under C-216, added 2026-11-23, expiring 2026-11-30, at 1.5 times their worst fresh Linux sample: fake-claude dropped 6.939 s, orphan 7.381 s, host-allow-list 9.566 s, prune 8.367 s, stage-cover 46.784 s. None was removed, because 1.5 times each worst sample exceeds the 5 s fallback budget, and prune has no baseline. Evidence: docs/evidence/T-2052-duration-renewal.md and A-22632. Samples come from d6245a18, fe8db4e4, 6a4791fb, ae9e60c1 and 8ae71246.
