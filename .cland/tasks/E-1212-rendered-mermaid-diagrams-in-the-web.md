---
id: E-1212
kind: epic
title: Rendered Mermaid diagrams in the web workbench
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: topic-959
branch: null
created: 2026-10-24T08:51:28.710Z
updated: 2026-10-24T10:18:47.654Z
---

## Goal

A Mermaid `.mmd` diagram artifact opens rendered in the web Artifacts area, with its source one key away. The human approved a new client-side dependency, `mermaid`, for this (option a on T-1158, General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## Definition of done

- [ ] C1. A `.mmd` artifact opens rendered in the sandboxed viewer and its source stays available, shown in a Web test.

## Plan

```yaml
stages:
  - name: mermaid rendering
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1158
```
