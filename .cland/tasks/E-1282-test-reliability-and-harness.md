---
id: E-1282
kind: epic
title: Test reliability and harness
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:52:46.898Z
updated: 2026-10-25T11:30:44.171Z
---

## Summary

No flake or harness defect from 2026-10-20 to 2026-10-24 stays open: load-sensitive component tests, fixture leaks, the frame recorder, the harness frame readers and the rule 15 sealing gaps. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: load-sensitive tests and sealing
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1028
        - T-1036
      - - T-1259
      - - T-1041
      - - T-1233
        - T-1237
        - T-1285
      - - T-1299
  - name: runner and frame tooling
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-450
        - T-1250
      - - T-1024
```
