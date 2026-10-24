---
id: T-1158
kind: task
title: Rendered Mermaid diagrams in the web workbench
state: open
status: review
size: M
criterion_seq: 3
labels:
  - needs-triage
assignee: null
parent: E-1212
blocked_by: []
topic: topic-947
branch: t/T-1158-rendered-mermaid-diagrams-in-the-web
created: 2026-10-22T23:41:27.072Z
updated: 2026-10-24T09:06:22.902Z
---

## Summary

In v0.2 the web Artifacts area opens a raw Mermaid `.mmd` diagram as text (its source) with a download link; only HTML or SVG diagrams open in the sandboxed page viewer (decision on T-1140's question, 2026-10-22 23:41Z). The human approved option (a), a new client-side dependency `mermaid` (General 2026-10-24 08:51Z, answer to ask 7efa7a2e).

## What to build

A Mermaid diagram artifact opens rendered in the sandboxed viewer, with its source one key away. Add `mermaid` to the web workspace at an exact pinned version, loaded only when a `.mmd` artifact opens, so the shell's first load does not grow. Render inside the sandboxed iframe with Mermaid's strict security level, so diagram text cannot run script. Theme it from `web/src/tokens.css`. A diagram that fails to parse shows Mermaid's error and the source, never a blank pane. No other new dependency.

## Acceptance criteria

- [x] C1. A `.mmd` diagram artifact opens rendered in a sandboxed iframe from a capability URL, and its source stays available one key away (Web test).
  - done: impl-1158 · 2026-10-24T09:04:35.726Z
- [x] C2. `mermaid` is a pinned dependency of the web workspace only, loaded lazily on first `.mmd` open; the shell's initial bundle size is unchanged within 1 KB, shown in a test or build check.
  - done: impl-1158 · 2026-10-24T09:04:35.957Z
- [x] C3. Diagram text cannot execute script (strict security level) and a parse error shows the error with the source, both shown in Web tests.
  - done: impl-1158 · 2026-10-24T09:04:36.313Z

## Comments

### impl-1158 · 2026-10-24T09:03:33.994Z

Implemented .mmd capability rendering via ?render=mermaid in the existing allow-scripts-only iframe. Separate classic renderer entry is built for build/watch and requested only on first .mmd opening; initial shell JS grew 231 bytes (455,323 → 455,554; limit 1,024), checked by web/check-shell-size.ts. Strict Mermaid 12.1.0, token theme, restricted rendered-page CSP, immediate physical-code s source toggle, raw download, and parse errors/source. TDD reds: missing rendered SVG; source wrapper stripped leading newline. Targeted local Darwin arm64 working-tree checks: artifacts/key-contexts/palette 26/26, capability T2 7/7, web-keymap/web-readme 4/4, and npm run check (lint/budget report mode, 0 refusals). No configured verification or QA claim yet. Audit remains 2 low on Mermaid→KaTeX: GHSA-238p-pmpm-9mq7; eligible patched KaTeX versions fall outside required ^0.16.47. Coordinator informed; no out-of-range override or new dependency added.
