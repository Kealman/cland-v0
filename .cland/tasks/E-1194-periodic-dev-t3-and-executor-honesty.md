---
id: E-1194
kind: epic
title: Periodic dev T3 and executor honesty
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:45:43.538Z
updated: 2026-10-24T10:42:27.510Z
---

## Summary

Periodic dev T3 and the executor report what really ran: a bundling or capacity failure reads as infrastructure, not a culprit; the culprit search handles Web files and boundaries; tests never write the real executor ledger; demo status agrees with exec; a cancelled local run cannot wedge admission.

## Goal

Periodic dev T3 and the executor report what really ran: a bundling or capacity failure reads as infrastructure, not a culprit; the culprit search handles Web files and boundaries; tests never write the real executor ledger; demo status agrees with exec; a cancelled local run cannot wedge admission.

## Why

Several v0.2 periodic runs were red or inconclusive for infrastructure reasons. Triage: A-10327.

## Definition of done

- [ ] C1. Every child item has landed with a clear review and a green same-head verify.
- [ ] C2. Linux and macOS stage covers are green at the epic's last landing, and QA confirms each child's behaviour through its tests and criteria at that commit.

## Plan

```yaml
stages:
  - name: honest periodic and executor reports
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1015
        - T-1144
      - - T-422
      - - T-1148
        - T-444
      - - T-1227
      - - T-1228
  - name: culprit search, demo states and local admission
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1098
        - T-976
      - - T-1086
      - - T-511
      - - T-1211
```
