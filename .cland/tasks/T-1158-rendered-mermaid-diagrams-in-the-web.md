---
id: T-1158
kind: task
title: Rendered Mermaid diagrams in the web workbench
state: open
status: in progress
size: M
labels:
  - needs-triage
assignee: null
parent: E-1212
blocked_by: []
topic: topic-947
branch: t/T-1158-rendered-mermaid-diagrams-in-the-web
created: 2026-10-22T23:41:27.072Z
updated: 2026-10-24T08:54:42.326Z
---

## Summary

In v0.2 the web Artifacts area opens a raw Mermaid `.mmd` diagram as text (its source) with a download link; only HTML or SVG diagrams open in the sandboxed page viewer (decision on T-1140's question, 2026-10-22 23:41Z). The human approved option (a), a new client-side dependency `mermaid` (General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## What to build

A Mermaid diagram artifact opens rendered in the sandboxed viewer, with its source one key away. Add `mermaid` to the web workspace at an exact pinned version, loaded only when a `.mmd` artifact opens, so the shell's first load does not grow. Render inside the sandboxed iframe with Mermaid's strict security level, so diagram text cannot run script. Theme it from `web/src/tokens.css`. A diagram that fails to parse shows Mermaid's error and the source, never a blank pane. No other new dependency.

## Acceptance criteria

- [ ] C1. A `.mmd` diagram artifact opens rendered in a sandboxed iframe from a capability URL, and its source stays available one key away (Web test).
- [ ] C2. `mermaid` is a pinned dependency of the web workspace only, loaded lazily on first `.mmd` open; the shell's initial bundle size is unchanged within 1 KB, shown in a test or build check.
- [ ] C3. Diagram text cannot execute script (strict security level) and a parse error shows the error with the source, both shown in Web tests.
