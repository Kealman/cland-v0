---
id: T-997
kind: task
title: Folds remembered per client, and no explanatory prose
state: open
status: review
size: S
criterion_seq: 4
labels:
  - ready-for-agent
assignee: null
parent: E-415
blocked_by:
  - T-996
topic: topic-809
branch: t/T-997-folds-remembered-per-client-and-no
created: 2026-10-20T16:51:41.075Z
updated: 2026-10-21T14:28:10.829Z
---

## Summary

Every group and block folds with a chevron and the keyboard, and the browser remembers the folded state per client without the hub. A check keeps explanatory prose out of the interface.

## What to build

One fold component with a chevron and keys from the key map, its state stored under the area's versioned key. Nothing goes to the hub, and `ui.json` stays Neovim's. The reference component in `AGENTS.md` uses it. Headers carry a name and a count, and a browser check fails on a visible sentence outside the tooltips and the `?` panel (the check is mechanical: a visible text node outside `title` attributes, tooltips and the `?` panel that ends with a full stop or holds more than six words fails).

## Acceptance criteria

- [x] C1. A group folded with its chevron and with the keyboard stays folded across a reload (browser test).
  - done: impl-997 · 2026-10-21T14:26:44.500Z
- [x] C2. Folding sends no frame to the hub (browser test counts outgoing frames).
  - done: impl-997 · 2026-10-21T14:26:44.522Z
- [x] C3. A mechanical browser check (a visible text node outside `title` attributes, tooltips and the `?` panel that ends with a full stop or holds more than six words) fails on a fixture that adds an explanatory sentence to a header and passes on the shell.
  - done: impl-997 · 2026-10-21T14:26:44.543Z
- [x] C4. The reference component named in `AGENTS.md` uses the fold component.
  - done: impl-997 · 2026-10-21T14:26:44.568Z
  - verified: rev-26 [reviewer] · run rev-20261021-997-source-1 · 2026-10-21T14:28:10.829Z · commit 1c0ecf2a0a87376bbae8ef8ff27304b1ff34fcc4

## Comments

### impl-997 · 2026-10-21T14:16:25.766Z

Implementation started. Seams: Headless Shell DOM/storage/outgoing WS frames for C1–C3, shared key resolver T1 for physical fold keys. Item requires browser-only fold persistence; no hub folding state.

### rev-26 · 2026-10-21T14:28:10.829Z

verdict: review
result: clear
by: rev-26 [reviewer]
run: rev-20261021-997-source-1
commit: 1c0ecf2a0a87376bbae8ef8ff27304b1ff34fcc4
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Source clear; A-8466 records Standards and Spec review of the full 13-file diff from be94e3ac, tree 167ae8e8. Reference Shell uses reusable Fold for lists/details/drawer; state stays in browser-local versioned area records with denied-storage fallback and matching-pane synchronization. Shared physical-code dispatch preserves field/modal scope; mechanical visible-prose guard includes failing plants and documented exclusions. No source findings. C4 established by source; C1/C2/C3 remain unverified pending configured same-head browser evidence. A-8461 targeted results are uncommitted development-tree evidence, explicitly not exact-head receipts per lead 5ab2bd2e. No reviewer execution. Mode-free verification may proceed at this exact head; after-stage QA remains separate.

Criteria: C4 verified.
