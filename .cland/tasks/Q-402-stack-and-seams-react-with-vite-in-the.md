---
id: Q-402
kind: question
title: "Stack and seams: React with Vite in the workspace, serving from the hub, Playwright against the hub with fake harnesses"
state: open
labels:
  - wayfinder:research
assignee: cland-design
parent: M-399
blocked_by: []
topic: null
branch: null
created: 2026-10-14T13:03:49.697Z
updated: 2026-10-14T13:03:59.670Z
---

## Question

The stack and the test seams of the web client (spec v0.2 §3.7): React with Vite in a web/ workspace of this npm monorepo on Node 24, TypeScript strict, no UI library, CSS on the canvas tokens; the WebSocket library for the hub (ws or Node's own) and its cost in the hub's process; serving web/dist from the hub with a one-time token link and a cookie; Playwright headless Chromium against the real hub with fake harnesses as the second test seam after the frame protocol: how long a web phase takes, how it shards (T-267 context: the suite's spend), what fixtures it needs; a minimal PWA manifest and what browser notifications need; what Codex and Claude Code agents write most reliably in this stack. Deliver docs/research/web-stack.md on research/web-stack with a measured probe (a hello page served from a scratch hub, one Playwright test, its wall time) and the resolution comment here.
