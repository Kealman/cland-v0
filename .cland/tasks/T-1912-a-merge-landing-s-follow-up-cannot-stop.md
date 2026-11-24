---
id: T-1912
kind: task
title: A merge landing's follow-up cannot stop the item's Codex Implementer ("process identity cannot be verified"), so every landing needs a manual cland merge repair
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-2076
blocked_by: []
topic: null
branch: null
created: 2026-11-16T14:04:44.964Z
updated: 2026-11-24T09:00:22.350Z
---

## Summary

On 2026-11-16 the landing follow-up failed with `stop sessions: could not stop "impl-<n>": its process identity cannot be verified; it is still watched` for T-1877, T-1878 and T-1905, all Codex Implementers on the local host. Each time, `session.stop` from the Coordinator a minute later succeeded at once, and `cland merge T-n` then finished the follow-up (worktree removal). Once the follow-up's stop failed because `ps failed or timed out`; the other times `ps` answered in milliseconds. The landing itself is unaffected, but each case leaves a worktree and a watched session behind until someone repairs it.

## What to build

Find why the follow-up's identity check fails where a direct `session.stop` moments later passes: a stale captured identity, a race with the Implementer's own exit, or a `ps` call with too short a bound. Make the follow-up stop succeed in that case, or retry it once before reporting a failure.

## Acceptance criteria

- [ ] C1. A landing whose Implementer is still running stops it and removes the worktree without a manual `cland merge` repair, in a fake-process test that reproduces the identity mismatch (test, red before the fix).
- [ ] C2. A genuinely unverifiable process (identity changed) is still refused and reported, as today (test).
