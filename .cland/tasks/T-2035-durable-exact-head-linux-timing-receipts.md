---
id: T-2035
kind: task
title: Durable exact-head Linux timing receipts, and the enqueue refusal of unallowed new identities of 4 s or more (split from T-1901 C2)
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by: []
topic: null
branch: null
created: 2026-11-20T17:39:51.105Z
updated: 2026-11-20T17:40:06.949Z
---

## Summary

T-1901's allowance check (its former C2) needs the passing per-identity timings of an exact-head Linux run as a durable structured receipt. Today they exist only as `suite timing` log lines or temporary duration-reporter side files that run-suite deletes. RunStatus and worker /done carry platform and tier receipts but no timing samples. Split from T-1901 on 2026-11-20, because it needs a runner to worker to RunStatus to Suites contract and a prepared-executor capability (rule 19) before enforcement.

Kind: product. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1901's original C2.

## Acceptance criteria

- [ ] C1. A local and a droplet run each record a durable structured timing receipt (identity, seconds, outcome, platform, head, tree) that Suites exposes after the run and after a hub restart, with no log parsing (test).
- [ ] C2. A new identity measured at 4 s or more on Linux with no allowance is refused before enqueue, with the allowance stanza (test).
