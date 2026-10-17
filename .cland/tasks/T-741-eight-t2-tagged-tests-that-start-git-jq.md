---
id: T-741
kind: task
title: "Eight T2-tagged tests that start git, jq or a check runner: move them to injected readers or retag T3"
state: open
status: backlog
size: M
labels:
  - v0.1.4
  - verification
  - hub
  - ready-for-agent
assignee: null
parent: E-676
blocked_by:
  - T-735
  - T-719
topic: null
branch: null
created: 2026-10-17T15:18:07.293Z
updated: 2026-10-17T15:18:07.293Z
---

## Summary

T-735's census (A-4576) shows eight files tagged T2 that start a non-cland child process, so they qualify only for T3: lead-permissions (git/nativeExec), release-item (git), skills-tracker (jq), suite-check (npm check/typecheck runner), suite-dry-run (git), suite-queue-policy (git), territory-cli (git) and verify-all (git). Once T-684 makes the lint refuse, each would block. T-719 adds projectHub's injected Git and process-table answers.

## What to build

For each file, either replace the child with T-719's injected reader or an in-process equivalent (keeping every assertion, with one retained T3 process proof only where the child itself is the behaviour), or retag it T3 with a `// T3: <behaviour>` header. The lint then reports no T2 file below its qualifying tier.

## Acceptance criteria

- [ ] C1. All eight files are T2 with no non-cland child process, or T3 with a lifecycle header, and `npm run test:lint` reports none of them below its qualifying tier.
- [ ] C2. An audit maps every moved assertion, and each touched file passes 5/5 on the Mac and once in the task's droplet verify.
