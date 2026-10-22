---
id: T-1158
kind: task
title: Rendered Mermaid diagrams in the web workbench
state: open
status: backlog
size: S
labels:
  - needs-triage
assignee: null
parent: C-326
blocked_by: []
topic: null
branch: null
created: 2026-10-22T23:41:27.072Z
updated: 2026-10-22T23:41:27.072Z
---

## Summary

In v0.2 the web Artifacts area opens a raw Mermaid `.mmd` diagram as text (its source) with a download link; only HTML or SVG diagrams open in the sandboxed page viewer (decision on T-1140's question, 2026-10-22 23:41Z). Rendering Mermaid would need a renderer, either a new dependency or a hub-rendered capability HTML route, which needs the human's approval.

## What to build

A Mermaid diagram artifact opens rendered in the sandboxed viewer, with its source one key away, without a client-side dependency the human has not approved.

## Acceptance criteria

- [ ] C1. A `.mmd` diagram artifact opens rendered in a sandboxed iframe from a capability URL, and its source stays available (Web test).
