---
id: T-770
kind: task
title: "`cland verify` exits 1 on a 15 s hub-socket timeout even though the hub accepted the run, inviting a duplicate submission"
state: open
status: backlog
size: S
labels:
  - bug
  - hub
  - cli
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T03:49:21.322Z
updated: 2026-10-18T03:49:21.322Z
---

## Summary

Reported by impl-765 on 2026-10-18 at 03:49Z. `cland verify --executor droplet …` exited 1 with "the hub did not answer on …/hub.sock within 15000 ms". The hub had in fact accepted the run: suite 20ab679c ran and passed (A-4942), and task view records it. A session that trusts the exit code would resubmit and queue a duplicate. The same 15 s timeout hit impl-752's dry-run on 2026-10-17 at 22:03Z, while the hub was busy (T-758, T-768).

## What to build

When the request was written but no reply came, the verify CLI says so: "submission sent; no reply within N s; check `cland verify queue` before resubmitting". It exits with a distinct code, not the generic failure. Use an idempotency key so a retried submission for the same session, head and mode returns the existing run, not a new one.

## Acceptance criteria

- [ ] C1. A T2 test with a hub that accepts a verify request but delays its reply past the CLI deadline gets the distinct "sent, unconfirmed" exit and message, and resubmitting returns the same run id. The test fails before the fix.
