---
id: E-1195
kind: epic
title: Duration budget and test selection
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:45:43.660Z
updated: 2026-10-24T06:46:51.497Z
---

## Summary

Duration budgets stop surprising the crew: expiring allowances warn 48 h ahead, a task's own verify measures new T3/T4 identities and prints an allowance stanza, the 20,000-line proof fits its budget, and shared read-path changes select their T4 load files.

## Goal

Duration budgets stop surprising the crew: expiring allowances warn 48 h ahead, a task's own verify measures new T3/T4 identities and prints an allowance stanza, the 20,000-line proof fits its budget, and shared read-path changes select their T4 load files.

## Why

Allowance expiry broke T3 at midnight 2026-10-24; T-1165 and T-1179 cost cover pairs on new identities. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: allowances and selection
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1190
        - T-1198
        - T-1026
      - - T-1203
```
