---
id: T-249
kind: task
title: "Launch briefs never reach real Claude Code sessions: launch_brief_ready stays 0 after the first turn, so only the role clause arrives"
state: open
status: review
criterion_seq: 3
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
updated: 2026-10-11T20:22:42.490Z
---

## What happened

Found by T-236 (impl-236, 2026-10-11 ~20:09Z) on dev 803a61b, Claude Code 2.1.296, claude-sonnet-5-5, scratch project /private/tmp/cland-T-236-m7-20261011.

A real Coordinator and a real Aide were launched with briefs: Coordinator brief 3e5aed8c-84b3-4fed-9d69-a7ed3e8a8b77, Aide brief 4b03b85b-97fb-4204-93f1-0b1fc6ed9ec7. Both launches succeeded and both first turns finished, yet the briefs stayed queued (`launch_brief_ready=0`) and were never injected. Only the role clauses arrived. Both sessions were idle by 20:09:02Z. A direct `topic.send` from the scratch human was injected normally.

Why it went unseen: the root project's crew is briefed with `send` after launch, not with launch briefs, and the fake harnesses mark the brief ready themselves. So the real-harness path is untested. The launcher's brief field, T-150 Aide briefs and lead launches all depend on it.

## What to build

Find why the brief-ready signal never fires for a real Claude Code session (the first-turn or hook boundary of the claude-code adapter), and fix it so the brief is injected exactly once after the role clause.

## Acceptance criteria

- [x] C1. With real Claude Code, a launch brief is delivered exactly once after the role clause, as a manual scratch check recorded in an artifact. A protocol test pins the adapter boundary the fix relies on, using the fake harness made to behave like the real one.
  - done: impl-249 · 2026-10-11T20:22:17.838Z
- [x] C2. Codex and OpenCode launch briefs are re-checked the same way.
  - done: impl-249 · 2026-10-11T20:22:18.049Z
- [ ] C3. `npm run typecheck && npm test` pass.

## Comments

### impl-249 · 2026-10-11T20:17:46.561Z

Red reproduced at the harness process boundary: node --test --test-name-pattern='explicit role' hub/test/session-launch.test.ts fails after 15s with 'brief reaches the native harness'. The fake background child now removes ambient CLAND_* so it must rely on settings/MCP config like the real supervised Claude process. Claude config lacked CLAND_LAUNCH_TOKEN; Codex explicitly forwards it and OpenCode puts it in MCP env. Testing the minimal Claude MCP env fix.

### impl-249 · 2026-10-11T20:22:33.892Z

Implemented and pushed 1a8f03fd09a8b547f13eebfab547f44225dd2580 on t/T-249-launch-briefs-never-reach-real-claude. Explicit MCP env now carries CLAND_LAUNCH_TOKEN into real Claude background sessions; the fake removes ambient CLAND_* and the launch regression checks ordering and exactly once across a later turn, including early hello. Targeted session-launch (8/8) and Claude adapter (6/6) pass. Real Claude 2.1.296/Sonnet 5.5, Codex 0.162.1/gpt-6.1-sol, OpenCode 2.0.24/big-pickle all pass; native inputs show clause before one brief, one injected record and ACK, no repeat after a later turn. Evidence A-1370: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1370-t-249-pass-real-claude-codex-and-opencode-launch-briefs/README.md. All scratch processes stopped. Merged origin/dev fd57d3e before final full suite; C3 pending suite.
