---
id: E-1196
kind: epic
title: Test hygiene, guards and QA tooling
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:45:44.006Z
updated: 2026-10-24T12:28:06.981Z
---

## Summary

Parallel lanes stop colliding in docs/agents/tests.md, Web and Neovim tests are sealed and race-free under load, and QA briefs are checked against the build before a run.

## Goal

Parallel lanes stop colliding in docs/agents/tests.md, Web and Neovim tests are sealed and race-free under load, and QA briefs are checked against the build before a run.

## Why

123 of 166 v0.2 landings touched docs/agents/tests.md; three Web load races (T-1157, T-1182, T-1183). Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: split the tests doc
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1199
        - T-1070
      - - T-1210
  - name: sealed and race-free fixtures
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1083
        - T-1200
      - - T-1012
        - T-1030
        - T-1149
      - - T-1108
        - T-360
        - T-1204
      - - T-1214
      - - T-1239
  - name: QA tooling and docs drift
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1201
        - T-1205
      - - T-1206
      - - T-436
```
