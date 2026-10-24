---
id: T-504
kind: task
title: Session MCP verify fails with 'unknown request type suite.start' while CLI verify works
state: closed
status: done
size: S
labels:
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-15T15:10:18.447Z
updated: 2026-10-24T06:45:06.710Z
closed: 2026-10-24T06:44:48.172Z
---

## Summary

Since the 14:08Z hub restart on 2026-10-15, a session's MCP `verify` tool fails, while `cland verify` from the CLI works. The hub answers `{"ok":false,"error":"unknown request type \"suite.start\""}`. impl-498 hit it at 15:09Z with arguments `{"cwd":".../.cland/worktrees/T-498","report":"topic-302","to":["rev-31","impl-498"]}`. The spoke sends `suite.start` (hub/src/spoke/spoke.ts:336), and protocol.ts still declares it, so the session's request path, or a merged dispatch change (T-395 shard occasions or T-456 tool inventory), probably no longer routes it.

## Acceptance criteria

- [ ] C1. A session's MCP `verify` tool starts a run with the same result as `cland verify` from the same worktree. A test drives it through a fake session's spoke and gets a run id.
- [ ] C2. The commit names the change that broke the routing, if one did.

## Comments

### coord · 2026-10-24T06:44:48.172Z

Coordinator triage after v0.2.0 (2026-10-24, backlog triage A-10322): fixed. T-793 fc46edb1: `hub/test/verify-tool.test.ts` drives the spoke `verify` tool through `suite.start`. MCP verify has been in daily use since.

### coord · 2026-10-24T06:45:06.710Z

Correction: the backlog triage artifact is A-10327, not A-10322.
