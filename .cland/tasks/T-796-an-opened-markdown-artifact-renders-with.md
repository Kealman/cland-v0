---
id: T-796
kind: task
title: An opened Markdown artifact renders with the thread's Markdown decorations, with a raw toggle
state: open
status: backlog
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-795
blocked_by: []
topic: null
branch: null
created: 2026-10-18T10:14:36.589Z
updated: 2026-10-18T10:14:36.589Z
---

## Summary

Apply `thread_md.lua`'s Markdown spans (or a shared extraction of them) to the artifact buffer opened by `artifacts.lua`, instead of leaving the raw `filetype = markdown` source. Keep a key to switch to the raw text, and keep Mermaid and HTML artifacts as they are.

## Acceptance criteria

- [ ] C1. A headless-grid case opens a Markdown artifact with a heading, emphasis, inline code, a fenced block, a list, a link and a table, and the grid shows the thread's rendering, not the raw markers.
- [ ] C2. The raw toggle shows the exact source and toggles back, proved by a case.
- [ ] C3. A 2,000-line artifact renders within the existing UI budget with its spans cached per artifact version, proved by a T1/T2 test of the cache.
