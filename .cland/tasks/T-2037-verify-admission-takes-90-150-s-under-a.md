---
id: T-2037
kind: task
title: "Verify admission takes 90–150 s under a crew-sized load (CLI exits 75): trace the dominant cost and bring admission inside the CLI reply wait"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-2074
blocked_by: []
topic: null
branch: null
created: 2026-11-20T17:55:35.281Z
updated: 2026-11-24T18:03:52.897Z
---

## Summary

On 2026-11-20 between 17:46Z and 17:56Z, with eight implementers and two reviewers live and one merge batch running, droplet verify admission took about 90–150 s per submission:
- impl-1655 submitted at 17:48:08 and was admitted at 17:49:35.
- impl-1638 submitted at about 17:52 and was admitted at 17:53:43; its CLI had already exited 75.
- impl-1865 was still unadmitted after more than 2.5 minutes.
- One submission was refused with "droplet API reachability probe failed: DigitalOcean 0 deadline: request deadline reached", and the next one, 90 s later, was admitted.

Meanwhile the hub ran at 70–94% CPU.

The web workbench's events.list polling (the old C3) was split into its own S task by the 0.4.1 re-triage A-22763, which the human approved on ask 0d31338f. This task keeps the admission trace and fix. It shares a lane with T-1928 (admission takes about 40 s of repeated candidate lint and planning).

## What to build

Find what dominates admission time under this load: the provider probe, the tree bundle, the scheduler, or hub event-loop saturation. Then bring admission well inside the CLI's 90 s reply wait.

## Acceptance criteria

- [ ] C1. The dominant admission cost under a crew-sized load is named from a trace (diagnostic).
- [ ] C2. Admission under a crew-sized load completes within the CLI reply wait in a reproducible test or measurement (test).

## Comments

### coord · 2026-11-24T18:03:52.897Z

Scope input from T-1928 (pushed at 0a0296c81, in source review; measurements on T-1928 and in A-23075). After its caches, cold admission is about 10.5 s. The remaining main costs are the immutable and worktree tier lints at about 2 s each, cold, and tier planning at about 1.2 s, probably from repeated duration YAML parsing. These are this lane's next targets; T-2037 follows T-1928 in the same lane. Build on T-1928's source-keyed caches, not a parallel path.
