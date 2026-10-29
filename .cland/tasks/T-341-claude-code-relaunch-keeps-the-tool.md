---
id: T-341
kind: task
title: Claude Code relaunch keeps the tool schemas cached at first launch
state: closed
status: done
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1444
blocked_by: []
topic: topic-1190
branch: null
created: 2026-10-13T19:49:24.214Z
updated: 2026-10-29T21:51:49.886Z
closed: 2026-10-29T16:02:23.160Z
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

## Comments

### impl-341 · 2026-10-29T16:01:41.785Z

Diagnosis at initial dev 6a24facf: hub/src/adapters/claude-code.ts #sessionFlags rewrites mcp.json before both launch and --resume; hub/src/spoke/spoke.ts tools/list returns current TOOLS. Existing fake at hub/test/fakes/claude-code/fake-claude.ts connects an MCP client but does not model native persisted ToolSearch/schema caching; a failing fake-cache test would assume the reported bug. Installed native CLI symlink names 2.1.311 (not executed). Official MCP docs document dynamic refresh (https://code.claude.com/docs/en/mcp#dynamic-tool-updates); upstream changelog includes cache invalidation and deferred-tool fixes, but none establishes this exact relaunch behaviour. Native reproduction is required before selecting a fix or claiming fixed elsewhere. Requested Coordinator decision on a sealed native-CLI loopback probe; no actual harness, account, token or platform used. Item currently has no criteria; proposed same-conversation schema update, identity/role/claim preservation and compatibility controls.

### impl-341 · 2026-10-29T16:02:14.673Z

Disposition per Coordinator decision 68a1e2ab (2026-10-29): not reproducible on current dev from the available safe evidence; reopen with a fresh native stale-schema receipt. This is not a verified upstream fix. At dev 6a24facf, the Claude adapter regenerates private MCP config on --resume (hub/src/adapters/claude-code.ts #sessionFlags); spoke tools/list returns current TOOLS (hub/src/spoke/spoke.ts). Installed CLI link names 2.1.311. Official upstream docs describe dynamic tool refresh (https://code.claude.com/docs/en/mcp#dynamic-tool-updates) and changelog records schema-cache/deferred-tool fixes (https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md). Existing fake does not represent the native persisted ToolSearch cache. No native probe, source change, test run, typecheck or verification run was performed; the Coordinator declined the native probe because loopback API configuration does not prevent other external traffic. Supporting artifact A-13741: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-13741-t-341-reproduction-boundary-and-current-evidence.md. Coordinator will close with the recorded reason under E-1444 C1. Per the corrected per-item assignment, this session will not start T-1350.

### coord · 2026-10-29T16:02:23.160Z

Closed without a change: not reproducible on current dev. impl-341's findings (A-13741): dev regenerates the private MCP config on `--resume`, and the spoke's `tools/list` returns the current tools. The installed Claude Code CLI is 2.1.311, and upstream documents dynamic tool refresh and cache fixes. A native-CLI probe was declined because the real binary may reach outside services, and only the Coordinator runs on Claude Code now. Reopen with a fresh receipt of a stale tool schema after relaunch.
