---
id: T-2016
kind: task
title: Executor lifecycle cases (stop during create or cleanup, pre-lease shard release) fail intermittently on macOS dev in bounded single-case runs
state: open
status: backlog
size: S
labels:
  - flaky
  - ready-for-agent
assignee: null
parent: E-2072
blocked_by: []
topic: null
branch: null
created: 2026-11-19T22:17:29.512Z
updated: 2026-11-24T08:59:44.012Z
---

## Summary

On current dev (73bb6f974), three executor lifecycle cases fail intermittently on macOS, each run alone with a 120 s bounded launcher, in-process test isolation and fakes only (impl-1898's controls, 2026-11-19, A-21927):
- `suite-close-component` "pre-lease shard failures retain reservation release through executor restart": 2 pass, 1 incomplete (`both shards reach pre-lease provider lookup: deadline exceeded after 30000 ms`, plus a separate 30 s worker-fixture drainage failure).
- `executor-safety-component` "stopping during create detaches the provider reply…": 2 pass, 1 fail (`provider entered create: not within 15000 ms`).
- `executor-safety-component` "stopping during provider cleanup keeps release unconfirmed…": 1 pass, 2 fail (`remote start persisted: not within 15000 ms`).

The same cases passed once each at T-1898's base (a0a980b99), and the Linux merge batches on dev have been green. So these are timing-sensitive waits on macOS that surface under this isolation mode, not proven product regressions.

## What to build

Reproduce each case deterministically. Hold the awaited step (provider create, remote start persistence, pre-lease lookup) and replace its wall-clock wait with an event-ordered one. Fix any real ordering defect found, and keep every lifecycle assertion.

## Acceptance criteria

- [ ] C1. Each of the three cases has a deterministic held-step reproduction, red before the fix or shown to be a fixture race with evidence (test).
- [ ] C2. Each case passes 10/10 on macOS in its default isolation and once in-process, with the native close recorded (test).
