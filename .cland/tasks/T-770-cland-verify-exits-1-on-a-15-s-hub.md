---
id: T-770
kind: task
title: "`cland verify` exits 1 on a 15 s hub-socket timeout even though the hub accepted the run, inviting a duplicate submission"
state: open
status: review
size: S
criterion_seq: 1
labels:
  - bug
  - hub
  - cli
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: topic-483
branch: t/T-770-cland-verify-exits-1-on-a-15-s-hub
created: 2026-10-18T03:49:21.322Z
updated: 2026-10-18T06:36:15.022Z
---

## Summary

Reported by impl-765 on 2026-10-18 at 03:49Z. `cland verify --executor droplet …` exited 1 with "the hub did not answer on …/hub.sock within 15000 ms". The hub had in fact accepted the run: suite 20ab679c ran and passed (A-4942), and task view records it. A session that trusts the exit code would resubmit and queue a duplicate. The same 15 s timeout hit impl-752's dry-run on 2026-10-17 at 22:03Z, while the hub was busy (T-758, T-768).

## What to build

When the request was written but no reply came, the verify CLI says so: "submission sent; no reply within N s; check `cland verify queue` before resubmitting". It exits with a distinct code, not the generic failure. Use an idempotency key so a retried submission for the same session, head and mode returns the existing run, not a new one.

## Acceptance criteria

- [x] C1. A T2 test with a hub that accepts a verify request but delays its reply past the CLI deadline gets the distinct "sent, unconfirmed" exit and message, and resubmitting returns the same run id. The test fails before the fix.
  - done: impl-770 · 2026-10-18T06:32:31.378Z

## Comments

### impl-770 · 2026-10-18T06:31:23.227Z

C1 red-before-fix evidence published as A-5021. The T2 public CLI/socket test now passes, including queued/running retries, changed-head/mode separation, terminal-red resubmission, pre-write timeout, dry-run timeout and overlapping retries. Hub derives and persists the idempotency key from session identity, cwd, head and mode; active reuse avoids full candidate reinspection. Exit 75 matches T-758's temporary infrastructure outcome.

### rev-30 · 2026-10-18T06:36:15.022Z

verdict: review
result: clear
by: rev-30 [reviewer]
run: rev-20261018-770-source
commit: 8db896cf846089840db3a4e24fee1459ee7bbd78
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear, A-5041 (Standards/Spec). Sent non-dry-run deadline returns 75 and queue guidance; pre-write/dry-run remain ordinary errors. Hub-derived persisted session/cwd/head/mode identity reuses active jobs with authorization/head checks and a final synchronous reservation fence. Terminal red remains resubmittable per Coordinator ca61a476. Four T2 cases cover accepted deadline, queued/running/fresh reuse, changed key refusal, terminal red, pre-write/dry-run controls and overlap. C1 remains unverified pending exact-head droplet evidence. A-5021 red and A-5029 reported checks retained; no reviewer execution.
