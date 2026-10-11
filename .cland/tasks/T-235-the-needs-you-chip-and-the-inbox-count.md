---
id: T-235
kind: task
title: The needs-you chip and the inbox count the same entries in every layer configuration
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
created: 2026-10-11T17:48:35.582Z
updated: 2026-10-11T17:48:36.432Z
---

## What happened

During the v0.1 build (human's observation 2, 2026-10-10) the top bar chip said "needs you 98" while the inbox said "nothing needs you". T-169 and T-171 since changed what needsYou counts, but no test proves that the chip and the inbox agree in every layer configuration, including overrides and pins/mutes from T-192.

## What to build

Make the chip and the inbox read one count from the hub, and prove it.

## Acceptance criteria

- [ ] The chip and the inbox show the same needs-you count for asks, approvals and waiting topics, with notifications present, project overrides raising notifications to now, and topics muted or pinned.
- [ ] A headless test reproduces the configurations and asserts that the two agree.
- [ ] `npm run typecheck && npm test` (or `npm run test:nvim` for a Neovim-only change) pass.
