---
id: T-1155
kind: task
title: Hub-merged session rows read whole presence synchronously under 100-frame verifier bursts (T4 load)
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by: []
regression_of: T-1147
topic: null
branch: t/T-1155-hub-merged-session-rows-read-whole
created: 2026-10-22T21:12:18.826Z
updated: 2026-10-22T21:12:33.739Z
---

## Summary

The stage cover f62a15ea at 5cdfb704 (A-9459, Linux shard-2) failed T4 `hub/test/inbox-verifier-load.test.ts` › "100-frame verifier delivery bursts never scan retained message history" with `100 deliveries and 100 explicit views allow no synchronous whole-presence reads (302 pending reads)`. Locally on macOS it passes at de40ac3c^ and fails at de40ac3c (T-1147) and at 5cdfb704. T-1147's own fix kept the 8-delivery T2 workload under its bound, but this T4 load variant, which runs only in covers, still sees the merged-row projection read whole presence per delivery or view.

## What to build

The merged session-row projection reuses connected presence already loaded for the burst, or batches its reads, so 100 deliveries and 100 explicit views cause no synchronous whole-presence reads. `session.list` rows and snapshots stay unchanged.

## Acceptance criteria

- [ ] C1. The named T4 test passes in a targeted run at the head, with its receipt (platform and pending-read count) posted in the item topic (test).
- [ ] C2. The 8-delivery T2 workload in hub/test/inbox-workload.test.ts and T-1147's archived-rows tests pass unchanged (test).
