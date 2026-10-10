---
id: T-205
kind: task
title: Kept artifacts rise to watch in the shared classifier
state: open
status: backlog
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by:
  - T-190
  - T-193
topic: null
branch: null
created: 2026-10-10T20:08:34.923Z
updated: 2026-10-10T20:08:34.923Z
---

## What to build

Split from T-193 on 2026-10-10. Spec §3.6 says a kept artifact rises to the watch layer. T-193 adds artifact provenance and the `kept` flag; T-190 adds the shared visibility classifier. Once both are on dev, the classifier places kept artifacts (and their artifact events) in watch and unkept ones in background, for the hub's projections and Neovim alike.

## Acceptance criteria

- [ ] A kept artifact and its creation event classify as watch; an unkept agent artifact as background; the human's and an Aide's as T-193 defines.
- [ ] Hub frame-protocol and headless tests cover keep, unkeep and restart.
- [ ] `npm run typecheck && npm test` pass.

## Notes

Size XS. Blocked by T-190 and T-193.
