---
id: T-1221
kind: task
title: 'Landing crew preset: replace "Just me and one agent" with the smallest real crew'
state: open
status: in progress
size: XS
labels:
  - ready-for-agent
  - site
assignee: null
parent: E-778
blocked_by: []
topic: null
branch: t/T-1221-landing-crew-preset-replace-just-me-and
created: 2026-10-24T09:38:51.795Z
updated: 2026-10-24T09:39:57.904Z
---

## Summary

The human deferred Q-782 (a crew without a Coordinator) to a release after the public launch (General, 2026-10-24 09:38Z). The landing's crew presets in `site/src/pages/index.astro` still offer "Just me and one agent": one Implementer and no Coordinator. As Q-782 said, the preset becomes the smallest real crew instead: a Coordinator and one Implementer.

## Acceptance criteria

- [ ] C1. The landing's solo preset shows a Coordinator and one Implementer, with wording that claims nothing a v0.2 crew can't do, and no page under `site/` describes a crew without a Coordinator (grep in the ready report).
- [ ] C2. The site builds (`npm run build` in `site/`), and the change reaches cland.app only through `cland publish`, after the Coordinator's ask to the human.
