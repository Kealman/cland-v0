---
id: T-1899
kind: task
title: Release preflight independent of covers
state: open
status: backlog
size: S
labels:
  - retro-improvement
assignee: null
parent: E-1888
blocked_by:
  - T-1876
topic: null
branch: null
created: 2026-11-16T07:29:46.730Z
updated: 2026-11-16T07:29:48.675Z
---

## Summary

Run tools, PATH, auth, clean-root and version checks before any release cover, and list every refusal instead of the first. §7 #8 (with T-1876, T-1877 and T-1878).

Kind: product. Triage ticket H-11 of A-19813, part of E-1888 (the v0.4.0 retrospective improvements the human approved on 2026-11-16).

## Acceptance criteria

- [ ] C1. A release preflight mode reports every non-cover refusal (`gh` on the hub PATH, clean root, version files) without needing green covers (test).
- [ ] C2. The release skill runs it right after the release epic's brief (docs check).

## Dependencies

T-1876
