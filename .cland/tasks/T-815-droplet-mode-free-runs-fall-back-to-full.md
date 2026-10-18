---
id: T-815
kind: task
title: Droplet mode-free runs fall back to full when fetching origin dev fails
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-18T18:33:03.914Z
updated: 2026-10-18T18:33:03.914Z
---

## Summary

A mode-free droplet run for T-801 (57be29a1, A-5489) fell back to the full selection because `git fetch origin +refs/heads/dev:refs/remotes/origin/dev` failed on the droplet. The result was green, but the run did more work than its selection needed, and the fallback is silent apart from the log.

## Acceptance criteria

- [ ] C1. The droplet's dev fetch for selection uses a ref the delivered tree can reach, or the hub ships the dev base with the tree, so mode-free runs on droplets choose their own selection; a component test with a delivered tree that has no origin dev shows the selection being computed, not a fallback.
- [ ] C2. When selection still falls back to full, the result's first lines name the fallback and its cause.
