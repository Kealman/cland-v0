---
id: T-1484
kind: task
title: Installed verify cannot parse duration identities with TypeScript pruned
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
created: 2026-10-30T11:58:34.958Z
updated: 2026-10-30T11:58:34.958Z
---

## Summary

An installed `cland` (TypeScript pruned as a dev dependency) running `cland verify` on a project that has `hub/test/durations.json` source identities reaches `sourceTestIdentities`, whose lazy `import('typescript')` resolves against the installed hub and fails. The path is runSuiteCommand, then suite-candidate lintHubShards/lintHubShardTree, then lintDurationIdentities, then sourceTestIdentities. A generic project without duration or tier manifests avoids it. Found by T-1458's packaging guard, 2026-10-30.

## What to build

The installed CLI handles that path without the compiler: either a non-TypeScript identity fallback, or a clear refusal naming the missing capability, with no stack trace. TypeScript stays a dev-only dependency.

## Acceptance criteria

- [ ] C1. An install-shaped run of `cland verify` on a project with duration identities, with `typescript` unresolvable from the installed hub, either completes identity checks without the compiler or refuses with one line naming the cause, shown by a fixture; `typescript` stays in devDependencies.
