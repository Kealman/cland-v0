---
id: E-1283
kind: epic
title: Roles, docs and workbench readiness
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:52:49.457Z
updated: 2026-10-25T11:31:12.750Z
---

## Summary

Clauses, skills and lint agree with the runtime policy, and actions issued before the workbench's first snapshots are kept: who commits at the root, Aide verify rows in qa lint, cover-quiet waits with a wake-up instead of polling, and early Neovim actions. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: clauses, lint and early actions
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1275
        - T-1260
      - - T-1225
      - - T-323
      - - T-1300
```
