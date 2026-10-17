---
id: T-739
kind: task
title: "ask-chain: 'a question climbs an epic and release one level per forward' failed once in a timed-out droplet run"
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - needs-triage
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: null
created: 2026-10-17T14:59:41.309Z
updated: 2026-10-17T14:59:41.309Z
---

## Summary

In T-730's run 6569987b (A-4557, line 1189), `hub/test/ask-chain.test.ts::a question climbs an epic and release one level per forward, reaching each fake harness` failed after 9.7 s. The run hit its 75 min timeout before printing a failure summary, so the assertion text is missing. The same droplet was loaded by two 120 s lock waits from T-730's own regression at the time. No other run shows this failure.

## What to build

Triage: run the case whole-file 10/10 on the Mac at dev. If it's red, find the cause. If it's green, watch the next covers, and close this as a one-off if it doesn't recur in five integrated runs.

## Acceptance criteria

- [ ] C1. Either the cause is named and fixed with the case passing 5/5 on the Mac and once in a droplet verify, or five consecutive integrated covers pass it and the ticket closes as a one-off under load.
