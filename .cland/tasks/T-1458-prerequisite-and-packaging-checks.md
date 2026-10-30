---
id: T-1458
kind: task
title: "Prerequisite and packaging checks: install-shaped CLI smoke, site/ import boundary, current web/dist"
state: open
status: backlog
size: M
labels:
  - needs-triage
assignee: null
parent: C-216
blocked_by: []
topic: null
branch: null
created: 2026-10-30T05:44:57.647Z
updated: 2026-10-30T05:44:57.647Z
---

## Summary

Add an install-shaped smoke run of every CLI command's runtime imports, an import-boundary guard so site/ tests use only site/ dependencies, and a refusal to start Web probes or verifies without a current web/dist and a resolvable node_modules. Sources: T-1303 (T-1225 shipped `cland qa lint` broken for installs), T-1368, T-1423, T-1096, T-1031. Rule batch 4 C6 (A-14151).

## Acceptance criteria

- [ ] C1. Each of the three guards fails on a planted defect and passes on dev.
