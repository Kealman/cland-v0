---
id: T-1214
kind: task
title: Parallel CLI changes conflict on the single usage text in hub/src/cli/usage.ts
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1196
blocked_by: []
topic: topic-975
branch: t/T-1214-parallel-cli-changes-conflict-on-the
created: 2026-10-24T09:01:40.293Z
updated: 2026-10-24T11:50:59.036Z
---

## Summary

On 2026-10-24 five branches added help lines to `hub/src/cli/usage.ts` (T-1188, T-1198, T-1018, T-542, T-1144), and three of them conflicted there: T-1198 with T-1188, T-1144 with dev, T-1203 with T-1144. Each conflict costs a dev merge, a delta review and a fresh verify (~15 min). The usage text is one long template where adjacent commands' lines touch each other. Git union merge is unsafe for code.

## Acceptance criteria

- [ ] C1. Each command's usage lines live in their own entry (one module or one table row per command), so two branches that change the help of different commands merge without a conflict, shown with a scratch Git repository (test).
- [ ] C2. `cland --help` output and every existing help/usage test are unchanged byte for byte by the refactor (test).
