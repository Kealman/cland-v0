---
id: T-1764
kind: task
title: One pending sub-agent permission prompt sends a new Telegram approval card at every coord turn boundary
state: open
status: in progress
size: S
labels: []
assignee: null
parent: E-1886
blocked_by: []
topic: null
branch: t/T-1764-one-pending-sub-agent-permission-prompt
created: 2026-11-08T18:34:49.448Z
updated: 2026-11-16T13:41:39.642Z
---

## Summary

One pending Claude Code permission prompt, raised by a sub-agent of the Coordinator, sent a new "Waiting for approval" card to the human's Telegram every time the Coordinator's main turn ended. That made six cards for one prompt. A single pending prompt should announce once, with at most one reminder after a long interval.

## Evidence

- On 2026-11-08 a coord sub-agent's Bash call stalled at 15:48Z on Claude Code's own "Dangerous rm operation not ruled out" check (a nested heredoc; no rm in the command).
- While that one prompt stayed pending, the hook re-reported `waiting for approval` at each coord turn boundary: 16:06, 16:18, 16:31, 16:42 and 16:54Z. Each report produced a fresh "coord · claude-code — Answer in its terminal. Waiting for approval" card in Telegram.
- cland-impl answered No at 16:56Z. The human saw the cards as noise.
- The state mapping is in `hub/src/adapters/claude-code.ts` (`waitingFor` → `waiting for approval`, around lines 147 and 187). The remote card fan-out sits downstream.

## Acceptance criteria

- [ ] C1. A session that re-enters `waiting for approval` for the same pending prompt, with no state in between other than the same wait, sends no new remote card or Agents notice (test).
- [ ] C2. A new prompt, or the same session entering a wait again after it resolved, still announces once (test).
- [ ] C3. A still-pending prompt sends at most one reminder, after a fixed interval on the hub clock (test).
