---
id: Q-299
kind: question
title: "OpenCode-only capabilities: idempotent prompt ids, the clause as durable
  instructions, approval reply, mid-session model switch, child sessions; the
  training and sandbox risks"
state: open
labels:
  - ready-for-human
  - hub
assignee: null
parent: R-294
blocked_by: []
topic: null
branch: null
created: 2026-10-12T16:20:59.662Z
updated: 2026-10-12T16:20:59.662Z
---

## Open question

From the T-295 research, OpenCode-only capabilities cland does not use, in the research's priority order: caller-chosen prompt ids that make a send idempotent (a timed-out inject retried later cannot arrive twice; no contract change); durable per-session instructions (the role clause as system context that survives compaction and can be updated in place on handover; the route is experimental and has moved once; Codex and Claude Code can only set instructions at launch); an approval reply endpoint and switching model or agent mid-session (approval relay and setModel: contract decisions); sub-agent child sessions (their pending approvals, usage and models for T-270's instrumentation). Also recorded: the free default model `opencode/big-pickle` may use the code it sees for training; each per-session server idles at about 166 MB; OpenCode has no OS sandbox; an agent can create its own worktree and move its session out of the item's worktree without a permission check.

To decide, per capability: take it as OpenCode-only behind the shared contract, make it a contract feature all three adapters must answer, or defer; the clause-as-instructions only as a measured experiment; the training and sandbox risks as doctor warnings or launch refusals.
