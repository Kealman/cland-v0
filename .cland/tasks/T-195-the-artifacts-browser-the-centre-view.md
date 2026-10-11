---
id: T-195
kind: task
title: "The Artifacts browser: the centre view with mine, this topic, kept, by role and archived, editing in place, attaching with s"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by:
  - T-193
  - T-194
topic: null
branch: null
created: 2026-10-10T16:25:07.170Z
updated: 2026-10-11T06:27:08.933Z
---

## Parent

T-115, slice 6 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The centre view with its sections and keys, editing in place, attaching to the composer with `s`.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: the human creates a folder "v0.2 notes" in the browser, adds two files, and attaches it to a message with `s`.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
