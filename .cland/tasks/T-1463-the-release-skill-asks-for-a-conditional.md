---
id: T-1463
kind: task
title: The release skill asks for a conditional release approval in daytime
state: open
status: review
size: XS
criterion_seq: 1
labels:
  - ready-for-agent
assignee: null
parent: R-1465
blocked_by: []
topic: topic-1230
branch: t/T-1463-the-release-skill-asks-for-a-conditional
created: 2026-10-30T05:44:58.508Z
updated: 2026-10-30T10:19:44.594Z
---

## Summary

The v0.3.0 release waited 6.8 h overnight for approval (retro A-14149). The release skill gains a recorded conditional approval: the Coordinator asks in daytime "release vX once the release epic is clear and the covers are green", and releases on those conditions. Retro v0.3.0 change 3.

## Acceptance criteria

- [x] C1. The release skill describes recording and checking a conditional approval, with the conditions named in the ask.
  - done: impl-1463 · 2026-10-30T10:19:34.268Z

## Comments

### impl-1463 · 2026-10-30T10:18:16.411Z

Scope/consumer audit: release/SKILL.md owns the approval procedure and its two Coordinator summaries. Search of shipped skills, docs/agents, hub/README.md and hub/test found no conditional-approval procedure to migrate. CLI/runtime release gates and wire/storage shapes stay unchanged; no shared contract change. Release skill has no upstream metadata.changes or CHANGES file. C1 will get a red-first static skill regression in skills-invocation.test.ts; QA policy is none.
