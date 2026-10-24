---
id: T-1251
kind: task
title: The merge queue demands a root npm install for a scripts-only package.json change
state: open
status: backlog
size: XS
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T14:17:14.259Z
updated: 2026-10-24T14:17:14.259Z
---

## Summary

`dependencyInstall` in hub/src/dependency-install.ts flags any changed `package.json` or `package-lock.json` as "dependencies out of date … (required)". T-1204 (1d284bca) changes only the root `scripts.test:static` line, yet `cland merge queue` printed the required-install warning on 2026-10-24 14:16Z. A scripts-only change needs no install, and the false "required" wording pushes the Coordinator toward an `npm install` while shared readers run.

## Acceptance criteria

- [ ] C1. A candidate whose package.json differs from dev only outside `dependencies`, `devDependencies`, `optionalDependencies`, `peerDependencies`, `overrides` and `workspaces`, with no lockfile change, gets no dependency-install warning in the queue, the merge result or the Agents topic.
- [ ] C2. A change to any of those fields, or to a lockfile, still gets the warning, covered by a T1 test.
