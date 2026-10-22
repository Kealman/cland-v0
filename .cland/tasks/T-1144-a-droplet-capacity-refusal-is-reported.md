---
id: T-1144
kind: task
title: A droplet capacity refusal is reported as a red periodic dev T3 run, and no executor fallback applies
state: open
status: backlog
size: S
labels:
  - needs-triage
  - bug
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-22T15:30:31.381Z
updated: 2026-10-22T15:30:31.381Z
---

## Summary

From 15:21Z on 2026-10-22, DigitalOcean offered no c-8 in any of the snapshot's regions (lon1, nyc1, sfo2). Every droplet run failed before execution with `droplet size c-8 unavailable in regions lon1, nyc1, sfo2`: two T-1104 task runs (A-9200, A-9201) and the periodic dev T3 run 45af0c60 at f35f5e2b (A-9210). The hub posted that periodic run as "Periodic dev T3 red", although no test ran ("counts unavailable"), and then started a culprit search that ended "inconclusive; no failing files identified".

## What to build

A run refused by the provider before any test executes reads as unavailable, not red. The periodic notice says "not run: provider capacity", it starts no culprit search, and it does not move the last-green or last-red markers. Task runs get the same distinct outcome, so leads do not mistake it for a failure. Whether a fallback (another region or size) applies is a separate decision for the human, because it changes spend.

## Acceptance criteria

- [ ] C1. A periodic dev T3 run whose droplet acquisition is refused for capacity posts a "not run" notice naming the refusal, with no "red" wording and no culprit search (test).
- [ ] C2. A task verify refused for capacity before any test reports a distinct unavailable outcome in its result and its suite result line (test).
