---
id: T-736
kind: task
title: "claude-code-accounts: the signed-out case's 'claude-a keeps polling' wait misses its 15 s bound under load"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T13:01:36.552Z
updated: 2026-10-17T13:01:36.552Z
---

## Summary

In integrated cover 56ed615c (A-4521, droplet c-8, peak load 6.5) `claude-code-accounts.test.ts::a signed-out account has one directory notice and event while another account keeps polling` failed: "claude-a keeps polling while claude-b is signed out: not within 15000 ms". The case advances the hub FakeClock and then waits on real time for the native `claude agents` child of claude-a to log its call. It passes 10/10 alone on the Mac. The case is T-696's (bd588b34).

## What to build

Make each period's poll observable as a receipt: advance the FakeClock, then wait for the adapter's own completion of that poll (the in-flight snapshot finishing), driving the clock again if the poll is still pending, instead of a 15 s real-time `eventually` over the call log. Keep every assertion: claude-a polls each period, claude-b never starts a new child, one directory notice and one event.

## Acceptance criteria

- [ ] C1. The case passes 5/5 on the Mac and in the task's droplet verify, with its assertions unchanged, and no real-time wait in it exceeds the bound of a single native child's completion.
