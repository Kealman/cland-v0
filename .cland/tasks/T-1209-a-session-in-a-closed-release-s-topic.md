---
id: T-1209
kind: task
title: A session in a closed release's topic cannot send to coordinator
state: open
status: backlog
size: S
labels:
  - qa-found
  - needs-triage
assignee: null
parent: C-325
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:59:07.947Z
updated: 2026-10-24T06:59:07.947Z
---

## Summary

After R-377 closed, qa-676 could not send its post-release report from topic-923 (the release's topic): every `send` was refused for closed-item routing, including `to: coordinator` by literal name. The verdict itself recorded fine. Seen 2026-10-24 ~06:09Z, run qa-post-release-2026-10-24-1, evidence A-10320.

## Acceptance criteria

- [ ] C1. A send addressed to `coordinator` (role or literal name) from the topic of a closed item is delivered, shown by a hub test that closes a release and then sends from its topic (test).
- [ ] C2. A send addressed to `lead T-n` for a closed item still falls back to the Coordinator instead of being refused, matching the documented `lead` resolution (test).
