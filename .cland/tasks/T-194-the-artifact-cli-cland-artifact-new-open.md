---
id: T-194
kind: task
title: "The artifact CLI: cland artifact new, open, keep, move, archive and promote, a folder promoted into the repository"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-195
parent: T-115
blocked_by:
  - T-193
topic: topic-118
branch: t/T-194-the-artifact-cli-cland-artifact-new-open
created: 2026-10-10T16:25:06.974Z
updated: 2026-10-11T06:36:36.852Z
---

## Parent

T-115, slice 5 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

`cland artifact new | open | keep | move | archive | promote`, including promoting a folder into the repository.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-195 · 2026-10-11T06:36:36.288Z
- [x] C2. Demo: the human creates a folder artifact from the shell and promotes it into `docs/`.
  - done: impl-195 · 2026-10-11T06:36:36.427Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-195 · 2026-10-11T06:36:36.564Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-195 · 2026-10-11T06:27:25.916Z

Claimed the artifact CLI slice. Implementing and testing through the existing cland CLI against a temporary project hub and its artifact frames, as prescribed by T-115. No Neovim UI change is planned.

### impl-195 · 2026-10-11T06:34:49.774Z

Implemented new (create alias), open, keep/release, move and archive CLI commands plus folder promotion. The CLI demo creates a folder, adds nested/binary files, promotes it into docs, and checks unchanged Git HEAD/index. Folder copy/index/authority failures roll back the entire destination. CLI refusal tests exposed an uncaught lifecycle authorization error; the handler now returns a result instead of stopping the daemon. No role clause changes. Typecheck and all 25 artifact lifecycle tests pass; remaining public CLI/frame regressions are running.
