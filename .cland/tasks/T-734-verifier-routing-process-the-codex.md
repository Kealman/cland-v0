---
id: T-734
kind: task
title: "verifier-routing-process: the Codex relaunch case runs 5.2–5.35 s on Linux, over the 5 s per-test budget"
state: open
status: in progress
size: XS
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-677
blocked_by: []
topic: null
branch: t/T-734-verifier-routing-process-the-codex
created: 2026-10-17T11:18:11.052Z
updated: 2026-10-17T11:22:22.593Z
---

## Summary

T-701's `verifier-routing-process.test.ts::Codex relaunch injects an early accepted clause and frees the queued QA request without a nudge` passes but runs 5.219–5.351 s on droplet runs (A-4467, A-4470), over the 5 s per-test budget. Budgets are report-only this week (D53), then hard, so it needs a speed-up or an owned allowance before then.

## What to build

Find what costs the time (a real wait, a relaunch delay, process churn) and remove it with the hub Clock or an event, keeping the assertions. If one second of the cost is irreducible process work, add an allowance owned by E-677 with a 7-day expiry and a reason.

## Acceptance criteria

- [ ] C1. The case runs under 5 s on the Mac 5/5 and in the task's droplet verify, or carries an owned 7-day allowance whose reason names the irreducible step.
