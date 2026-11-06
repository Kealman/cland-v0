---
id: T-1730
kind: task
title: A host's version handoff installs the whole runtime tree, so an upgraded host keeps its CLI, spoke and Claude Code mod
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-1533
blocked_by:
  - T-1723
topic: null
branch: null
created: 2026-11-06T20:59:24.215Z
updated: 2026-11-06T20:59:24.215Z
---

## Summary

T-1723 delivers cland's whole runtime tree to a host at ready, under `<home>/.cland-host/code/<version>` as an atomic version symlink to an immutable generation. The later version handoff (`agentVersionHandoff`, E-1532) still installs only the host agent's closure into `code/<version>`, and `verifyAgentPackage` refuses version symlinks. So a host made ready at V1 and handed V2 ends up with a closure-only V2: the layout's CLI, spoke and `hub/mod/cland` are missing. Claude Code and spoke sessions then fail on that host after the hub upgrade. T-1723's source reviewer found it, outside that item's additive ready-delivery scope.

## What to build

- One code-tree shape per version on a host. The version handoff installs the same whole runtime tree as ready delivery, through `deliverRuntime` or its generation and pointer mechanism, instead of a closure-only package.
- `verifyAgentPackage` and the supervisor's version selection accept the version symlink and verify through it.
- Old generations stay for running readers, as in T-1723.

## Acceptance criteria

- [ ] C1. A fake host made ready with the whole runtime at V1 and then handed V2 has `hub/bin/cland.ts`, `hub/bin/cland-spoke.ts` and `hub/mod/cland` under `code/V2`, each matching the V2 manifest digest (test, red before the fix).
- [ ] C2. After that handoff, the agent restarts on V2, and a Claude Code session on the host launches with its mod bridge connected (test).
- [ ] C3. A V1 reader running during the handoff keeps its generation until it exits (test).
- [ ] C4. The existing version-handoff cases in `host-agent-restart` and `host-agent-closure` pass, migrated only where they assumed a closure-only tree, with each migration named in a comment (test).
