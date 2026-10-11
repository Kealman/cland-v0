---
id: T-231
kind: epic
title: "Epic: v0.1.1 hygiene"
state: open
labels:
  - epic
  - v0.1.1
assignee: null
parent: T-227
blocked_by: []
topic: null
branch: null
created: 2026-10-11T17:48:08.653Z
updated: 2026-10-11T17:49:19.875Z
---

## Goal

v0.1.1 closes two loose ends from v0.1 that need no design: the top bar's needs-you chip agrees with the inbox, and the Coordinator's follow-through on an Aide's decision is proven with a real model.

## Contents

The bug part of the human's observation 2 (the chip said "needs you 98" while the inbox said "nothing needs you"), and the D19 deferral T-111 M7 run with real Claude Code sessions in a scratch project (decision D21).

## Definition of done

QA runs the demo below on `dev` and records a clear verdict on this epic with each checkbox verified by its id.

- [ ] The needs-you chip and the inbox count the same entries in every layer configuration, covered by a headless test.
- [ ] With real Claude Code sessions in a scratch project, the Coordinator follows through on an Aide's decision as T-111 M7 describes, recorded in a QA artifact.

## Plan

```yaml
stages:
  - name: hygiene
    qa:
      scope: none
      when: per-item
    lanes:
      - - T-235
      - - T-236
```
