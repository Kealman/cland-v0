---
id: T-169
kind: task
title: "The needs-you chip and inbox header show the hub's needsYou only: Neovim computes nothing (T-165 follow-up, 112 from notifications)"
state: open
status: planned
rank: 1300
labels:
  - v0.1
  - ready-for-agent
  - bug
assignee: null
parent: T-110
blocked_by: []
topic: null
branch: null
created: 2026-10-10T10:12:46.650Z
updated: 2026-10-10T10:12:56.895Z
---

## Parent

T-110 (Threads that read). A follow-up to T-165 (merged fdadb7b) that the human reported on the live build on 2026-10-10, after an editor restart.

## What to build

The chip still reads "needs you 112", and the inbox header "112 need you", while the hub says `needsYou` 0. `cland inbox --json` shows asks 0, approvals 0, waiting 0 and notifications 427.

The cause is `state.needs_you()` (nvim/lua/cland/state.lua:315). It adds every `death` and every `not clear` verdict among all notifications. Notifications never resolve, so the count grows without bound.

The chip and the inbox header show the hub's `needsYou` and nothing else; Neovim computes nothing. Before the hub has said, the chip shows no number (or the last known value), never a local count.

## Acceptance criteria

- [ ] The chip and the inbox header read the hub's `needsYou` only (hub.status and inbox events); `state.needs_you()` adds nothing locally.
- [ ] A stub-hub test with hundreds of notifications of every kind (deaths, not-clear verdicts, clear verdicts, releases) and hub `needsYou` 0 asserts that both show 0, and that both follow the hub's value when it changes.
- [ ] THREAD-009/010 and the T-165 regressions are updated to this rule.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Notes

High priority: a trust issue for the human. Size XS.

Spec v0.1 §3.5 lists "verdict not clear" and "session died" as now-layer inbox events. If they should count, the hub's `needsYou` must count them, with a resolution rule (an acknowledged death, a later clear verdict); Neovim must not. That is a separate decision.
