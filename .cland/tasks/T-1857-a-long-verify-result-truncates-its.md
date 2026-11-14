---
id: T-1857
kind: task
title: A long verify result truncates its executor, lifetime and cost line in delivery and history
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-14T16:41:38.895Z
updated: 2026-11-14T16:41:38.895Z
---

## Summary

The result delivery for T-1830's mode-free droplet verify cbe2ae48 (2026-11-14, Linux, ams3) was cut off mid-line at "Executor droplet · c-8 ams3 · cland-v0-". The same truncated text is stored in the durable topic history record, so the droplet's lifetime and cost never reached the item lead or the reviewer. The run's log A-19403 (7.2 MB) carries Linux, browser and head provenance but no executor, lifetime or cost line in its tail. Other results today (for example 3b726bb3, A-19395) printed "lifetime … · cost $…" in full. Found aside by T-1830's implementer.

## What to build

Find where a suite result's text is capped: the delivery size bound, the topic history record, or the log's final summary block. Make the billing line (executor, machine, lifetime, cost, workers) and the machine-health line always survive, for example by placing them before any truncatable section, or by truncating the long deciding-files and fallback lists first. The hub's billing receipt for the run stays readable from the spend ledger regardless.

## Acceptance criteria

- [ ] C1. A droplet result whose deciding-files and fallback text exceed the delivery bound still delivers and stores its full executor, lifetime and cost line, and its log ends with that line (test).
- [ ] C2. Where the run's spend ledger entry exists, `cland verify` shows the lifetime and cost for the run id even when the delivered text was truncated (test).
