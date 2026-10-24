---
id: E-1193
kind: epic
title: Merge queue and landing safety
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:45:43.386Z
updated: 2026-10-24T06:46:48.079Z
---

## Summary

The merge queue covers what it lands and never drops a ready member by mistake: batches run T0 and, when they touch web/, the Web tier; the false 'task branch changed' drop is gone; dependency merges and worktrees resolve the right node_modules; a candidate touching an epic under demo warns.

## Goal

The merge queue covers what it lands and never drops a ready member by mistake: batches run T0 and, when they touch web/, the Web tier; the false 'task branch changed' drop is gone; dependency merges and worktrees resolve the right node_modules; a candidate touching an epic under demo warns.

## Why

T-1018, then N5, each caused a red dev in v0.2; T-1184 cost a batch cover. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: batch coverage and the false drop
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1018
        - T-1202
      - - T-1184
      - - T-542
  - name: demo-freshness warning
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1207
```
