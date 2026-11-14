---
id: T-1860
kind: task
title: "Setup and doctor: a role placed on a missing pool reads skip"
state: open
status: backlog
size: S
labels:
  - needs-triage
  - qa-found
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-11-14T20:16:16.052Z
updated: 2026-11-14T20:16:16.052Z
---

## Summary

When a role is placed on `--pool agents` but no `agents` pool is configured, setup's agent-hosts step prints `skip`, and doctor says nothing. A role like that cannot launch, so the step is really incomplete. Found while writing the E-1537 stage-3 QA brief, at `d5809f556`. The behaviour predates T-1830 and T-1831.

## What to build

When at least one role is placed on a pool that does not exist, setup's agent-hosts step prints `open`. Its detail names each such role and pool, and its fix gives the exact `cland config set hosts.agents.…` commands, or the command that moves the role back to the local pool. Doctor's hosts block prints a `warn` with the same fix. Neither one writes anything. If no role points at a missing pool, both behave exactly as they do today.

## Acceptance criteria

- [ ] C1. Without a terminal and with a role placed on a missing `agents` pool, setup's agent-hosts step prints `open`, naming the role, with the exact fix commands and no writes. With no such role, the output is unchanged (test).
- [ ] C2. Doctor's hosts block warns for a role on a missing pool and gives the same fix. It makes no provider call (test).
