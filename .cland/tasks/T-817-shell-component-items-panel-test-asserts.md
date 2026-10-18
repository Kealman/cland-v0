---
id: T-817
kind: task
title: shell-component items panel test asserts the claim and asks before their events render
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: t/T-817-shell-component-items-panel-test-asserts
created: 2026-10-18T19:11:17.011Z
updated: 2026-10-18T19:11:24.527Z
---

## Summary

`nvim/test/shell-component.test.ts:923` › "the items panel: vertical sections, hub glyphs, right-aligned claims and counted asks; filters 1–6 and f; map grouping" failed once on a droplet: run e3c4d0f0 for T-815 at c14d40f5 (A-5536, around line 55450). The assertion at line 931, "claim and two counted open asks, over the hub status", read a frame whose T-2 row had no claim or ask count yet, and the test's load-gate repetitions then passed 5/5. The test asserts on a frame before the claim and asks events are rendered.

## Acceptance criteria

- [ ] C1. The test waits on an observed frame that carries the claim and both asks, not a fixed point in the script; all original assertions are kept, with a red-to-green proof that delays the asks event.
- [ ] C2. The file passes 20 serial runs on macOS and one droplet run.
