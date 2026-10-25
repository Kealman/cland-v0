---
id: E-1281
kind: epic
title: Merge queue, covers and publish report the truth
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:52:44.721Z
updated: 2026-10-25T09:53:49.912Z
---

## Summary

Plan stages, cover receipts and periodic runs report the truth: a published task counts as merged, hub-owned runs are attributed to the hub, the culprit search skips regressions dev already fixed, artifact reservations don't race, and scripts-only package.json changes don't demand an install. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: honest stage and run records
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1276
      - - T-1218
        - T-521
      - - T-1244
      - - T-1251
  - name: covers across restarts
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1029
```
