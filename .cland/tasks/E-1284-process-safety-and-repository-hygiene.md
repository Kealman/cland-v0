---
id: E-1284
kind: epic
title: Process safety and repository hygiene
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:52:51.686Z
updated: 2026-10-25T09:53:56.959Z
---

## Summary

cland never signals a stranger's process, stops promptly during droplet reservation waits, keeps the repository's unreachable Git objects bounded without unsafe pruning, and caps local MCP input before parsing. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: process identity, stop and hygiene
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-543
        - T-1154
      - - T-1217
      - - T-1208
```
