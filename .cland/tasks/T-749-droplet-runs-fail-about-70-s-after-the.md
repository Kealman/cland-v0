---
id: T-749
kind: task
title: Droplet runs fail about 70 s after the lease turns active with 'machine command failed or exceeded its time bound' and no remote output
state: open
status: backlog
size: S
labels:
  - v0.1.4
  - hub
  - executor
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-17T17:58:46.346Z
updated: 2026-10-17T17:58:46.346Z
---

## Summary

Two droplet runs today ended about 70 s after `executor-lease-active`, before any remote test output: integrated cover d55be09a (A-4419, 08:51Z) and T-744's run 8758bf4f (A-4686, 17:58Z). Both show outcome "machine command failed or exceeded its time bound", "platform unavailable", "counts unavailable". In both, the host gate finished and the next step (delivery or the first remote command) failed. Resubmits of the same heads were green. Each costs a rerun and its queue wait.

## What to build

From the journal and the executor's own logs, name which machine command fails (snapshot boot, SSH readiness, tree delivery, install) and why: a timeout too short for a cold droplet, SSH not ready, or a provider error. Then fix the bound or the readiness wait, and make the result name the failing step instead of the generic cause.

## Acceptance criteria

- [ ] C1. The failing step is named with evidence from both runs, the fix is covered by a regression on the scripted provider, and a failed machine command's result names its step.
