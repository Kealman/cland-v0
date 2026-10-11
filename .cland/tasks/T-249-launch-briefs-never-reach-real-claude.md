---
id: T-249
kind: task
title: "Launch briefs never reach real Claude Code sessions: launch_brief_ready stays 0 after the first turn, so only the role clause arrives"
state: open
status: in progress
labels:
  - qa-found
  - ready-for-agent
  - v0.1.1
assignee: impl-249
parent: T-229
blocked_by: []
topic: topic-151
branch: t/T-249-launch-briefs-never-reach-real-claude
created: 2026-10-11T20:10:39.716Z
updated: 2026-10-11T20:17:46.561Z
---

## What happened

Found by T-236 (impl-236, 2026-10-11 ~20:09Z) on dev 803a61b, Claude Code 2.1.296, claude-sonnet-5-5, scratch project /private/tmp/cland-T-236-m7-20261011.

A real Coordinator and a real Aide were launched with briefs: Coordinator brief 3e5aed8c-84b3-4fed-9d69-a7ed3e8a8b77, Aide brief 4b03b85b-97fb-4204-93f1-0b1fc6ed9ec7. Both launches succeeded and both first turns finished, yet the briefs stayed queued (`launch_brief_ready=0`) and were never injected. Only the role clauses arrived. Both sessions were idle by 20:09:02Z. A direct `topic.send` from the scratch human was injected normally.

Why it went unseen: the root project's crew is briefed with `send` after launch, not with launch briefs, and the fake harnesses mark the brief ready themselves. So the real-harness path is untested. The launcher's brief field, T-150 Aide briefs and lead launches all depend on it.

## What to build

Find why the brief-ready signal never fires for a real Claude Code session (the first-turn or hook boundary of the claude-code adapter), and fix it so the brief is injected exactly once after the role clause.

## Acceptance criteria

- [ ] With real Claude Code, a launch brief is delivered exactly once after the role clause, as a manual scratch check recorded in an artifact. A protocol test pins the adapter boundary the fix relies on, using the fake harness made to behave like the real one.
- [ ] Codex and OpenCode launch briefs are re-checked the same way.
- [ ] `npm run typecheck && npm test` pass.

## Comments

### impl-249 · 2026-10-11T20:17:46.561Z

Red reproduced at the harness process boundary: node --test --test-name-pattern='explicit role' hub/test/session-launch.test.ts fails after 15s with 'brief reaches the native harness'. The fake background child now removes ambient CLAND_* so it must rely on settings/MCP config like the real supervised Claude process. Claude config lacked CLAND_LAUNCH_TOKEN; Codex explicitly forwards it and OpenCode puts it in MCP env. Testing the minimal Claude MCP env fix.
