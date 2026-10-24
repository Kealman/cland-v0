---
id: T-1261
kind: task
title: hook-bridge's real-hub stop case leaves a Timeout open in projectHub on Linux
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T20:24:45.140Z
updated: 2026-10-24T20:31:10.072Z
---

## Summary

`hub/test/scenarios/hook-bridge.test.ts:14` "a bridge exits after its real hub stops even while its parent and stdout remain alive" failed three times on Linux droplets on 2026-10-24, each time with `projectHub leaked resources … resources: ['Timeout']` (hub-resources.ts:30 via process-cleanup.ts:63):
- periodic dev T3 5564ec58 at da2d0e6f (A-11297)
- periodic dev T3 679cfcb8 at 8fd6195f (A-11364)
- stage cover 53e77774 at fdcea0b9 (A-11388, shard-2)

It passed in the culprit-search rerun 674fcc32 at da2d0e6f, in T-1255's verify all 1e7e5d01, and on macOS covers. The last green periodic run was at 89e5c304. Something started since then leaves a hub timer unref'd or uncleared at stop, intermittently.

## Acceptance criteria

- [ ] C1. The timer the in-process hub leaves after stopping is identified (its creation site) and is cleared on stop, with a red control reproducing the leak (test).
- [ ] C2. The case passes 10/10 on a Linux droplet at 2 workers (test).

## Comments

### coord · 2026-10-24T20:31:10.072Z

Local Darwin arm64 at fdcea0b9: hook-bridge.test.ts run alone 5/5 passed (coord scratch clone, one file at a time). macOS stage cover 9c0ab09c at the same SHA was green. The leak so far shows only on Linux droplets; one Linux cover resubmit 14d0d24a is running under the flaky-rerun rule.
