---
id: T-1958
kind: task
title: 232 released leases with no spend entry log executor-lease-spend-missing on every compaction pass (about 760,000 lines a day), and the lease-index migration leaves no log line
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: E-1883
blocked_by: []
regression_of: T-1950
topic: null
branch: null
created: 2026-11-18T06:13:57.102Z
updated: 2026-11-18T06:20:37.787Z
---

## Summary

After restart #83 (2026-11-18, dev 303b482b8), T-1950's lease index (`.cland/run/executor/lease-index.json`, version 1) keeps 232 of 4,221 leases: released leases that have no spend entry, so they never settle. Every compaction pass logs `executor-lease-spend-missing` for all 232: 7,424 lines in the first 14 minutes, about 760,000 a day, into a hub.log that is already 763 MB. The one-off migration also leaves no log line, so an operator cannot tell from the log that the index was built.

## What to build

A released lease without a spend entry reaches a terminal state of its own: a recorded unknown spend (rule 17: never a zero) whose receipt says no ledger entry existed, after which it leaves the hot index. The missing-spend diagnostic is logged once per lease, never once per pass. The migration logs one structured line with the counts it read, indexed and settled.

## Acceptance criteria

- [ ] C1. With a fake leases root holding released leases that lack spend entries, repeated compaction passes log the missing-spend diagnostic once per lease, record an unknown spend with its receipt, and leave the hot index (test counts log lines and index entries over N passes).
- [ ] C2. The lease-index migration emits one structured log line with its read, indexed and settled counts, and a rerun on an existing index emits none (test).
- [ ] C3. Every reader of a lease's spend state (doctor, status, the spend ledger, the CLI) shows unknown for these leases and never zero; the reader list follows rule 41 (test).
