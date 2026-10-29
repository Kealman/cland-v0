---
id: T-341
kind: task
title: Claude Code relaunch keeps the tool schemas cached at first launch
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1190
branch: t/T-341-claude-code-relaunch-keeps-the-tool
created: 2026-10-13T19:49:24.214Z
updated: 2026-10-29T16:00:38.052Z
---

## Summary

A Claude Code role session relaunched on its own conversation (`cland session resume <name> --relaunch`, which uses `--resume`) keeps the MCP tool schemas Claude Code cached at its first launch. New tool fields, such as task.create's `size` and `regression_of` from T-331, reach only sessions launched fresh (`--fresh`) and Codex sessions.

## Evidence

- On 2026-10-13, after T-331 merged (c5a7a89c) and the hub restarted on b4a7018 (pid 6411), the Coordinator ran `cland session resume coord --relaunch` at 19:48:34Z. Its spoke (`hub/bin/cland-spoke.ts`) started at 19:48:35Z.
- `hub/src/spoke/task-tools.ts` declares `size` and `regression_of` on task.create, and the description reads "A task needs a size: XS, S, M, L or XL".
- In the relaunched Claude Code session, ToolSearch still returns the old task.create schema, with no size and no regression_of and the old description.
- The role clause the hub sends on reconnect is current; only the tool schemas are stale.
- The Codex sessions rev-23, rev-26, qa-27, impl-332 and impl-340 were relaunched the same way and are not known to be affected.

## Related

This belongs with T-143's finding that role tools are fixed at launch. The relaunch does not refresh them for Claude Code.

## Workaround

Use the CLI (`cland task create … --size`), or relaunch with `--fresh` when a tool's schema changed.
