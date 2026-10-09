---
id: T-106
kind: task
title: "Spoke tools are callable before the hub's welcome and fail with \"not connected yet\": queue or wait for readiness"
state: open
labels:
  - hub
  - ready-for-agent
assignee: null
parent: T-19
blocked_by: []
topic: null
branch: null
created: 2026-10-09T20:55:16.129Z
updated: 2026-10-09T21:09:15.202Z
---

## Parent

Part of T-19. Found by impl-105 on T-105 on 2026-10-09 at 20:49Z. rev-65 recommended it as its own item in rev-65-105-1 (A-195).

## What happened

A session's MCP tools, such as `rename`, can be called before the hub has sent the spoke's welcome. They then return `{ok:false, error:'the hub is not connected yet (connecting)'}`. T-105's flaky test ignored that result. An agent that calls a tool in its first moments gets the same failure and must retry by hand. rev-65 notes that a sibling presence test makes the same readiness assumption about another client.

## What to build

- While the spoke is connecting, tool calls wait for readiness up to a bounded deadline, then run, or fail with a clear message if the deadline passes. They do not fail at once.
- Check the other tests that call spoke tools right after launch, including the presence test rev-65 named, for the same unstated readiness assumption.

## Acceptance criteria

- [ ] A tool called during connecting succeeds once the welcome arrives, which a deferred test proves; one past the deadline fails with a clear message.
- [ ] The presence test and its siblings wait for readiness explicitly.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size S. Implementer: Codex.
