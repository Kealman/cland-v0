---
id: E-1192
kind: epic
title: Production dependency advisories after v0.2.0
state: open
labels: []
assignee: null
parent: R-1191
blocked_by: []
topic: null
branch: null
created: 2026-10-24T06:30:56.698Z
updated: 2026-10-24T06:31:01.789Z
---

## Summary

Production dependency advisories reported by `npm audit --omit=dev` after v0.2.0 are fixed: zod 4.5.4 pinned in `hub/package.json` (high, GHSA-mrhx-c7xc-m3w5) and ip-address 10.7.3 (moderate). The human approved the update on 2026-10-24 06:30Z.

## Goal

Production dependencies carry no known high or moderate advisory, with the suite green.

## Definition of done

- [ ] C1. `npm audit --omit=dev` reports no high or moderate advisory on dev, and a full integrated suite with the Web phase is green on Linux and macOS at that commit.

## Plan

```yaml
stages:
  - name: dependency advisories
    qa:
      scope: none
      when: after-stage
    lanes:
      - - T-1189
```
