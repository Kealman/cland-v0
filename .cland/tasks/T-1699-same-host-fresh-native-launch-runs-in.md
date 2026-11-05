---
id: T-1699
kind: task
title: Same-host fresh native launch runs in the old generation scope (latent; aligns with T-1696 cross-host scoping)
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
created: 2026-11-05T19:51:55.612Z
updated: 2026-11-05T19:51:55.612Z
---

## Summary

T-1696 scopes adapter transport, forward, watch and in-flight state by native generation for cross-host relaunch (T-1614). A same-host fresh native launch, meaning resume after a successful stop that starts a new native process, still runs inside the adapter's old scope. That is latent today: every adapter awaits a successful stop of the old generation before the fresh launch, so nothing can collide (impl-1696's analysis, 2026-11-05). It would become live if any adapter ever started a fresh generation before the old one is confirmed stopped.

## What to build

Extract each adapter's post-positive-stop native-launch entry, and route a genuinely fresh same-host launch through a new generation scope, consistent with cross-host relaunch. Ordinary found or re-exec resume keeps its alias, and stop and launch behaviour is unchanged.

## Acceptance criteria

- [ ] C1. A same-host fresh native launch runs in its own generation scope, and the old generation's late cleanup cannot touch it (test).
- [ ] C2. The existing adapter, resume and stop tests pass with no test edited.
