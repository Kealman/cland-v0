---
id: E-1197
kind: epic
title: Hub correctness and speed
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:45:44.119Z
updated: 2026-10-24T10:52:52.407Z
---

## Summary

Small hub correctness and speed fixes left after v0.2: permission codes, CLI frames, tracker hydration, the managed literal-rm hook, [web] reload refusal and artifact cleanup.

## Goal

Small hub correctness and speed fixes left after v0.2: permission codes, CLI frames, tracker hydration, the managed literal-rm hook, [web] reload refusal and artifact cleanup.

## Why

Backlog items confirmed still real by the triage (A-10327). Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: permissions, CLI and tracker reads
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-337
        - T-998
      - - T-339
        - T-1188
      - - T-421
        - T-538
        - T-539
      - - T-1220
      - - T-1226
      - - T-1231
  - name: init hooks, reload and artifacts
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1181
        - T-1146
      - - T-1187
        - T-515
      - - T-1043
```
