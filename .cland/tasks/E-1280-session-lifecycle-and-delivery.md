---
id: E-1280
kind: epic
title: Session lifecycle and delivery
state: open
labels: []
assignee: null
parent: R-1277
blocked_by: []
topic: null
branch: null
created: 2026-10-25T09:52:42.374Z
updated: 2026-10-25T12:32:26.657Z
---

## Summary

Sessions survive restarts, re-execs and provider hiccups without a Coordinator message: a deaf session after a Claude Code re-exec is detected, long Codex threads reattach, provider-capacity failures retry, and OpenCode sees the user's Console login. Triage: A-11669 (approved by the human, ask f93ccf6a).

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: deaf sessions, long threads and logins
    qa:
      scope: affected
      when: after-stage
    lanes:
      - - T-1256
        - T-1224
      - - T-1265
      - - T-1230
        - T-1302
      - - T-1258
  - name: retry, reservations and launch values
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1249
        - T-1235
        - T-290
```
