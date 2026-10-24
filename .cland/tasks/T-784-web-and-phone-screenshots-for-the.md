---
id: T-784
kind: task
title: Web and phone screenshots for the landing
state: open
status: review
size: XS
criterion_seq: 2
labels:
  - ready-for-human
assignee: null
parent: E-778
blocked_by:
  - E-415
  - E-419
topic: topic-1005
branch: t/T-784-web-and-phone-screenshots-for-the
created: 2026-10-18T06:04:23.909Z
updated: 2026-10-24T20:56:27.326Z
---

## Summary

The landing's workbench section shows two placeholders, each with a description of what the screenshot should show (in `site/src/pages/index.astro`): SCREENSHOT 3, the web workbench at 2400×1500, and SCREENSHOT 4, the phone at 1170×2532. The human makes them once the web workbench and the phone ship.

## Acceptance criteria

- [x] C1. The web workbench screenshot replaces placeholder 3 on the landing
  - done: impl-784 · 2026-10-24T20:55:42.146Z
- [x] C2. The phone screenshot replaces placeholder 4 on the landing
  - done: impl-784 · 2026-10-24T20:55:42.323Z

## Comments

### impl-784 · 2026-10-24T20:52:31.998Z

Implementing the two existing filename-driven screenshot slots. Synthetic scratch-only project and real in-process hub via webFixture/projectHub; pinned isolated Headless Shell. No application/wire/keybinding changes or test-marked criteria. Capture documentation will explicitly describe mobile viewport emulation, without claiming real-device installation evidence.

### impl-784 · 2026-10-24T20:56:14.349Z

Source ready at d2d70350, committed/pushed task branch; fetched/merged origin/dev before review (already current). C1/C2 done. Screenshot artifacts A-11413 / A-11414; provenance and local validations A-11417. Review requested from role reviewer in topic-1005. No app/runtime/test contract changes; no test-marked criteria, and qaPolicy none after-stage. Awaiting clear source verdict before mode-free verify.
