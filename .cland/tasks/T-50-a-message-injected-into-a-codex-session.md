---
id: T-50
kind: task
title: A message injected into a Codex session in the last second of its turn is marked injected but never acted on
state: open
labels:
  - slice-1
  - ready-for-agent
assignee: impl-48
parent: T-19
blocked_by: []
topic: topic-9
branch: t/T-50-steer-lost-at-turn-end
created: 2026-10-09T07:04:04.157Z
updated: 2026-10-09T08:27:25.720Z
---

## Parent

Part of T-19. Seen once by impl-48 while building T-48 (2026-10-09, a real Codex 0.160.0 session launched by its own hub): a message steered into the session's clause turn about a second before that turn ended was recorded by the hub as `injected`, and the session never acted on it.

## What is known

- The hub's delivery stages are queued, delivered, injected; `injected` means the harness confirmed the inject (hub/README.md, the Codex adapter: `turn/start` or steer into the running turn).
- Not reproduced. The suspicion: a steer accepted by the app-server at the very end of a turn is dropped with the turn, while the hub counts the acceptance as injected.

## What to do

- Reproduce against the fake app-server first (a steer accepted while the turn is completing), then once against the real Codex if the fake does not show it.
- If real: the adapter must not report `injected` for a steer the turn did not consume (re-deliver as a new turn when the turn ends without it), or the hub must re-queue the message when the session goes idle with an unconsumed inject.

## Acceptance criteria

- [ ] A test shows a message delivered in the last moment of a turn is acted on in the next turn, or stays `delivered` (never `injected`) until it is
- [ ] `hub/README.md` says what `injected` guarantees for Codex
- [ ] `npm run typecheck && npm test` pass
