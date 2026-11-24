---
id: T-2020
kind: task
title: Hub feature advertisement in welcome, so setup refuses paid offers against a hub that doesn't enforce expected terms
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2075
blocked_by: []
topic: null
branch: null
created: 2026-11-20T00:30:37.837Z
updated: 2026-11-24T09:00:20.432Z
---

## Summary

T-1858 makes host.prepare and login.add validate the paid terms the human agreed to, and gives pool config writes a compare-and-set. A newer setup talking to an older running hub, for example during a restart, can't tell whether the hub enforces these fields, because the hub advertises only `PROTOCOL_VERSION` and no per-feature capabilities. Older hubs ignore the fields, so setup's client re-read is the only protection in that window (T-1858 scope decision, 2026-11-20).

## What to build

The hub lists the features it enforces in `welcome`, for example `paidTermsAdmission`. Setup refuses a paid offer against a hub that doesn't list it, naming the reason and suggesting a hub restart. Clients that don't read the field are unaffected.

## Acceptance criteria

- [ ] C1. `welcome` lists the enforced features, and the list is covered by the wire compatibility fixtures (test).
- [ ] C2. Setup refuses a paid host or login offer against a hub whose `welcome` doesn't list paid-terms admission, and starts nothing (test).
