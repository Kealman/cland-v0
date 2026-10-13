---
id: T-191
kind: task
title: "Layers on the inbox and the sessions: now and watch shown, background in
  the Agents log only, more (N) folds, archive by action"
state: closed
status: done
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: impl-191
parent: E-115
blocked_by:
  - T-190
topic: topic-120
branch: t/T-191-layers-on-the-inbox-and-the-sessions-now
created: 2026-10-10T16:25:06.253Z
updated: 2026-10-11T08:18:01.203Z
closed: 2026-10-11T08:18:01.362Z
---

## Parent

T-115, slice 2 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

The inbox shows now and watch, with background only in the Agents log; "more (N)" folds and unfold keys; archive reached only by an action.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-191 · 2026-10-11T06:35:19.483Z
  - verified: rev-14 [reviewer] · run rev-20261011-191-1 · 2026-10-11T06:38:17.274Z
- [x] C2. Demo: a clear verdict sits under watch, and a session's bookkeeping never reaches the inbox.
  - done: impl-191 · 2026-10-11T06:35:19.642Z
  - verified: rev-14 [reviewer] · run rev-20261011-191-1 · 2026-10-11T06:38:17.274Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-191 · 2026-10-11T06:35:19.803Z
  - verified: rev-14 [reviewer] · run rev-20261011-191-1 · 2026-10-11T06:38:17.274Z
- [x] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).
  - done: impl-191 · 2026-10-11T08:17:02.998Z
  - verified: rev-14 [reviewer] · run rev-20261011-191-2 · 2026-10-11T08:17:36.061Z

## Comments

### impl-191 · 2026-10-11T06:27:26.617Z

Claimed. Implementing in the item worktree from dev 688f28c. Tests will use the epic's agreed headless Neovim/stub-frame seam: inbox now/watch placement, background exclusion, session folds and explicit archive access.

### impl-191 · 2026-10-11T06:34:12.915Z

Implemented hub-layer display in Neovim: Inbox Now/Watch with background excluded; sessions Now/Watch with a more (N) background fold; A explicitly toggles Archive in each surface (shared between inbox panel/full width). New headless tests cover default/overridden layers, archive separation, fold keys, live-frame movement and cursor preservation. Targeted inbox action tests (16), layer tests (4), session movement and PANELS-009 passed; typecheck passed. No hub or role-clause code changed.

### rev-14 · 2026-10-11T06:38:17.274Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-191-1
commit: 2c7624bbd04d1c2c494f7e424b8cc00f48dce45c

No findings on Standards or Spec. Shared hub layers drive inbox Now/Watch and session groups; inbox background remains Agents-only, session background uses more (N), and explicit A archive is independent of folding. Existing row actions and visible-row identity tracking are retained. New headless frame cases and adjusted action/QA cases cover the behavior; docs updated and no role clause change. C1/C2/C3 verified; C4 pending complete current-head typecheck/Neovim suite. Evidence A-1098 /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1098-t-191-inbox-session-layer-review-clear-at-2c7624b-c4-pending.md.

Criteria: C1 verified, C2 verified, C3 verified.

### impl-191 · 2026-10-11T08:17:03.128Z

Final validation at unchanged pushed head 2c7624bbd04d1c2c494f7e424b8cc00f48dce45c: cland suite nvim run 04d5da92-8bba-4eb3-bc74-63a92ae9c3c9 exited 0. Typecheck passed, Neovim 257/257 passed with zero failures, cancellations, skips or todos. C4 marked done. Durable log A-1128: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1128-suite-04d5da92-8bba-4eb3-bc74-63a92ae9c3c9-nvim-at-2c7624b.log. C1–C3 review clear/verified; final C4 verification requested from rev-14.

### rev-14 · 2026-10-11T08:17:36.061Z

verdict: review
result: clear
by: rev-14 [reviewer]
run: rev-20261011-191-2
commit: 2c7624bbd04d1c2c494f7e424b8cc00f48dce45c

Standards and Spec: no new findings; same-head A-1098 source clearance remains applicable. No outstanding high or medium findings.
C4 verified from complete A-1128: hub/Neovim typecheck followed by npm run test:nvim, 257/257 passed; exit 0, zero failure/cancellation/skip/todo. No exceptions. This establishes the explicit Neovim-only criterion alternative. C1–C3 retain rev-20261011-191-1 verification at this exact head.
HEAD/origin match the pinned SHA; worktree is clean. Evidence A-1129: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1129-t-191-final-c4-verification-clear-at-2c7624b-257-neovim-tests.md.

Criteria: C4 verified.

### coord · 2026-10-11T08:18:01.203Z

Merged f8e2dcf3ac643a9ee3dfe0a9e242907912b4ce2c onto dev.
