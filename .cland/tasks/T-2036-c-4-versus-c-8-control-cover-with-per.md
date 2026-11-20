---
id: T-2036
kind: task
title: c-4 versus c-8 control cover with per-second load metrics (split from T-1897 C2; after T-1897 lands and the hub restarts)
state: open
status: planned
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1888
blocked_by:
  - T-1897
topic: null
branch: null
created: 2026-11-20T17:40:44.218Z
updated: 2026-11-20T17:40:53.706Z
---

## Summary

The paired c-8 and c-4 control measurement that sizes the droplet (the human's 2026-10-17 decision), split from T-1897 C2 on 2026-11-20. It needs T-1897's per-second sampler to be in the running hub first: the hub uploads run.ts, run.sh and health.ts from its own tree, not the candidate's (rule 19). So it runs after T-1897 lands and the hub restarts.

Kind: measurement. Part of E-1888 (approved in triage A-19813, ask 8e3dd5ab); carries T-1897's original C2.

## Acceptance criteria

- [ ] C1. One c-4 workers-2 cover at a tree with a green c-8 cover is compared with it for wall time, reds and cost in an artifact (evidence).
