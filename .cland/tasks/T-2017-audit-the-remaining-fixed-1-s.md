---
id: T-2017
kind: task
title: "Audit the remaining fixed 1 s FrameClient setup waits: product bounds versus setup headroom"
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-11-20T00:16:34.111Z
updated: 2026-11-20T00:16:34.111Z
---

## Summary

T-1875 made FrameClient `request` and `waitFor` cancellable and moved card-web's inner receipts onto the shared load-scaled wait. Its caller sweep (A-21962) found more callers that still keep fixed real 1 s setup waits:
- hosts-state, executor-liveness, opencode-native, fixture-endpoints and remote-workbench;
- the Telegram tests: approvals, liveness, catchup, pairing, users and the liveness fixture;
- config-set, item-summary, suite-retention-scale and discord-artifacts.

They are compatible and unchanged, but each fixed bound is a candidate load flake.

## What to build

Audit each caller and classify every fixed bound as either a product bound, which stays, or setup headroom. Move setup headroom onto the shared load-scaled wait with fixture-owned cancellation and a named reason. Keep every assertion unchanged.

## Acceptance criteria

- [ ] C1. Every listed caller's fixed bound is classified as product or setup in a published inventory, with a reason for each (evidence).
- [ ] C2. Setup bounds use the shared load-scaled wait with teardown cancellation, and the touched files pass at a 1-minute load of at least 8 (test).
