---
id: T-193
kind: task
title: "Folder artifacts and their lifetime: folder with an entry file, human and Aide artifacts never expire, kept, artifact.keep, move and archive"
state: open
status: planned
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by: []
topic: null
branch: null
created: 2026-10-10T16:25:06.772Z
updated: 2026-10-10T16:25:14.912Z
---

## Parent

T-115, slice 4 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

`artifact.create` with a folder and an entry file; its files listed on request; the human's and Aides' artifacts exempt from the sweep; `kept`; `artifact.keep`, `artifact.move` and `artifact.archive`; agents refused on the human's artifacts.

## Acceptance criteria

- [ ] The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
- [ ] Demo: an agent's report without `kept` is swept after the retention period, and the human's folder is not.
- [ ] Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
- [ ] `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
