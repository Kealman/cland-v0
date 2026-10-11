---
id: T-236
kind: task
title: "T-111 M7 with real models: the Coordinator follows through on an Aide's decision, run in a scratch project"
state: open
status: backlog
labels:
  - v0.1.1
  - ready-for-agent
assignee: null
parent: T-231
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:48:35.701Z
updated: 2026-10-11T17:48:36.549Z
---

## What to build

Run the check deferred from T-111 (M7, decision D19) with real models: in a scratch project, an Aide on real Claude Code records a decision on behalf of the human, and the Coordinator, also on real Claude Code, follows through on it. That means acting on the decision and not merely acknowledging it, as T-111's brief M7 describes. Record the run, its transcript excerpts and the verdict as a QA artifact. This needs no product change unless the run finds one; file any finding as `qa-found`.

## Acceptance criteria

- [ ] The run uses real Claude Code sessions for both the Aide and the Coordinator in a scratch project, never the root project's sessions.
- [ ] The Coordinator acts on the Aide's decision as M7 expects, shown by the journal and the resulting tracker or session changes.
- [ ] A QA artifact records the setup, evidence and verdict.
