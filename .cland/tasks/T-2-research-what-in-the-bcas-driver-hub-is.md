---
id: T-2
kind: question
title: "Research: what in the BCAS driver hub is reusable for cland"
state: closed
labels:
  - wayfinder:research
assignee: null
parent: T-1
blocked_by: []
topic: null
branch: null
created: 2026-10-07T14:51:20Z
updated: 2026-10-08T13:17:15.587Z
github:
  repo: Kealman/cland-v0
  number: 2
  url: https://github.com/Kealman/cland-v0/issues/2
---

## Question

Which parts of the BCAS driver hub (`/Users/evgeniyivanov/Projects/BratvaInc/bcas/tooling/driver-hub`) can cland reuse nearly as-is, which ideas should be kept but re-implemented, and which parts are BCAS-specific and must be dropped? Cover the hub service, the per-session spoke, the Claude Code and Codex integrations, the Discord layer, the coordination model, and the known pain points.

## Comments

### Kealman · 2026-10-07T14:55:59Z

<!-- github-comment: 6040639460 -->

## Resolution

Surveyed read-only on 2026-10-07. Full findings with file paths: `docs/research/bcas-hub.md` on branch `research/bcas-hub` (https://github.com/Kealman/cland-v0/tree/research/bcas-hub).

**Bottom line.** The hub is one Node 24 service: a WebSocket server, a `node:sqlite` store and a Discord bot. Every agent session runs a local spoke, an MCP stdio server holding one WebSocket to the hub. Claude Code sessions receive messages through the research-preview channels feature; Codex sessions through a supervisor that drives the Codex App Server over a Unix socket. Terminal output is never captured. The hub tracks no idle / busy / waiting state, only liveness, a self-set status line, model and quota. Discord sits behind a `HumanSide` port but leaks into the core.

**Reuse nearly as-is:** the spoke (`send`, `who`, `status`, `history`), the hub-client reconnect and same-session takeover, the versioned hello / welcome / result / deliver protocol, the Codex App Server supervisor (durable inbox, `turn/start` wake-up, socket MCP proxy, headless attach), per-addressee store-and-forward, address grammar, hygiene (rate limits, loop breaker), additive SQLite migrations, the `HumanSide` port with its in-memory fake, and the tests that drive the real spoke and hub.

**Keep the idea, re-implement:** asks with options rendered in the IDE; a roles registry with an exclusive coordinator and handover; machine slots as generic leases; session state (idle, busy, awaiting approval), which BCAS lacks and which Claude Code hooks and App Server notifications could supply; the permission relay BCAS skipped; a local automation ingress; model and quota through supported interfaces.

**Drop:** the Discord layer and everything shaped by it, the evidence CLI, boards and dashboards, SRE and slot semantics bound to the dev stand, the committed shared secret, deployment specifics, and protocol written as long prose prompts.

**Pain points to design against:** research-preview dependency for Claude Code channels; no end-to-end delivery acknowledgement; sub-agents sharing the parent's spoke identity; identity files racing; restart amnesia for mutes and counters; tool schemas frozen at launch; doc drift (144 KB protocol prose).
