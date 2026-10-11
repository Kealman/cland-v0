---
id: T-235
kind: task
title: The needs-you chip and the inbox count the same entries in every layer configuration
state: closed
status: done
criterion_seq: 3
labels:
  - v0.1.1
  - ready-for-agent
assignee: impl-235
parent: T-231
blocked_by: []
topic: topic-149
branch: t/T-235-the-needs-you-chip-and-the-inbox-count
created: 2026-10-11T17:48:35.582Z
updated: 2026-10-11T20:36:05.178Z
---

## What happened

During the v0.1 build (human's observation 2, 2026-10-10) the top bar chip said "needs you 98" while the inbox said "nothing needs you". T-169 and T-171 since changed what needsYou counts, but no test proves that the chip and the inbox agree in every layer configuration, including overrides and pins/mutes from T-192.

## What to build

Make the chip and the inbox read one count from the hub, and prove it.

## Acceptance criteria

- [x] C1. The chip and the inbox show the same needs-you count for asks, approvals and waiting topics, with notifications present, project overrides raising notifications to now, and topics muted or pinned.
  - done: impl-235 · 2026-10-11T19:33:39.913Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-235-1 · 2026-10-11T19:35:14.690Z · commit 999e79363f718a6f78cb5b1750842b5e0d6327a9
- [x] C2. A headless test reproduces the configurations and asserts that the two agree.
  - done: impl-235 · 2026-10-11T19:33:40.081Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-235-1 · 2026-10-11T19:35:14.690Z · commit 999e79363f718a6f78cb5b1750842b5e0d6327a9
- [x] C3. `npm run typecheck && npm test` (or `npm run test:nvim` for a Neovim-only change) pass.
  - done: impl-235 · 2026-10-11T20:35:37.451Z
  - verified: rev-18 [reviewer] · run rev-18-20261011-235-1 · 2026-10-11T20:35:51.176Z · commit 999e79363f718a6f78cb5b1750842b5e0d6327a9

## Comments

### impl-235 · 2026-10-11T19:24:02.777Z

Claimed from dev 0326a81 in .cland/worktrees/T-235. Checking hub classification and headless chip/header agreement for asks, approvals, waiting topics, notification overrides, and topic pin/mute transitions.

### impl-235 · 2026-10-11T19:29:27.983Z

Current implementation already shares the hub needsYou count. Added a real-daemon/headless Neovim matrix that checks hub.status/inbox.list, chip text, panel/full-width text, and rendered Now/Watch response rows. Covers notification Now overrides, required entries lowered through Watch/Background/Archive, live topic/session mutes and pins, reset and cold snapshots. Tightening fixture startup and UI toggle synchronization before final verification.

### impl-235 · 2026-10-11T19:33:13.759Z

The real headless matrix found a reproducible layer-only invalidation bug: with inbox.ask=watch and needsYou=0, muting General moves the hub snapshot ask to Background but Neovim keeps the Watch row indefinitely. InboxBoard's publication signature included raw asks/approvals/waiting; it could suppress an event when classification changed without a count change, while the client retained its per-connection inbox cache. Fix: classify those rows before publication/signature and compute needsYou from the same placed rows. Hub changed, so final verification will use cland suite all.

### rev-18 · 2026-10-11T19:35:14.690Z

verdict: review
result: clear
by: rev-18 [reviewer]
run: rev-18-20261011-235-1
commit: 999e79363f718a6f78cb5b1750842b5e0d6327a9

No high or medium findings. InboxBoard now includes response placement in publication equality and computes needsYou from the same classified rows; notification overrides cannot inflate the response count. The real headless matrix checks both shared UI counts and rendered response layers across overrides, pins/mutes, reset and cold snapshots, including unchanged-zero-count invalidation. C1/C2 verified; C3 awaits the exact-head full suite. Standards/Spec evidence: A-1360 (/Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-1360-t-235-review-at-999e793-c1-c2-clear-c3-pending.md).

Criteria: C1 verified, C2 verified.

### coord · 2026-10-11T20:36:05.178Z

Merged 35cd9228780e2f45e59d3d32ae16bdc85ba9a263 onto dev.
