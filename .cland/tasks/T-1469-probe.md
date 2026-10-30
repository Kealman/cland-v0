---
id: T-1469
kind: task
title: Claude Code poll must not turn a pushed idle into busy
state: open
status: backlog
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-1468
blocked_by: []
topic: null
branch: null
created: 2026-10-30T07:50:08.613Z
updated: 2026-10-30T07:50:17.327Z
---

## Summary

Background sessions report `busy` in `claude agents --json` while background shells, monitors or sub-agents run, so the 15 s poll override flips an idle coord to busy. Hooks are the reliable source for busy. Let the poll report idle, waiting or unknown, and liveness, but never override a pushed idle with busy.

Root cause: A-14159 (deaf-bridge RCA, 2026-10-30). Epic E-1468.

## Acceptance criteria

- [ ] C1. A Claude Code session whose last push signal is idle stays idle when `claude agents --json` reports `status: busy` for it.
- [ ] C2. A poll busy still applies to a launch that has sent no push signal yet (state `unknown`).
- [ ] C3. A test replays idle hook → poll busy 37 s later → human send and asserts outcome `delivered` and one inject frame.
