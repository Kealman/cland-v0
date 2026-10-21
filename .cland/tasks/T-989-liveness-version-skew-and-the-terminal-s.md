---
id: T-989
kind: task
title: Liveness, version skew and the terminal's door
state: open
status: review
size: S
criterion_seq: 6
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by:
  - T-980
  - T-983
topic: topic-795
branch: t/T-989-liveness-version-skew-and-the-terminal-s
created: 2026-10-20T16:50:00.836Z
updated: 2026-10-21T10:42:53.667Z
---

## Summary

The web edge pings its sockets and reports version skew. It also puts the terminal's reservations into code: binary frames are refused, each frame kind has its own size limit, the welcome carries the feature list and the bundle's build stamp, and every adapter declares its `terminal` capability.

## What to build

The web edge pings every 30 seconds, and the existing sweep closes a socket silent for 60 seconds. A binary frame closes the socket with a dedicated close code until streams exist. Each frame kind has its own size limit; JSON frames keep 1 MiB. The welcome carries the bundle's build stamp, so a page that loaded an older bundle can reload. A hello refused for its protocol tells the page to restart the hub. Every adapter declares `terminal: 'none'`, and clients can read it.

## Acceptance criteria

- [x] C1. The web edge pings every 30 seconds, and a socket silent for 60 seconds is closed (fake-clock test).
  - done: impl-989 · 2026-10-21T10:39:18.757Z
- [x] C2. A binary frame on the web edge closes the socket with a dedicated close code (test).
  - done: impl-989 · 2026-10-21T10:39:18.807Z
- [x] C3. Each frame kind has its own size limit, JSON frames keep 1 MiB, and an oversize frame of a kind is refused (test).
  - done: impl-989 · 2026-10-21T10:39:18.864Z
- [x] C4. The welcome carries the feature list and the bundle's build stamp, and a hello refused for its protocol carries the instruction to restart the hub (test).
  - done: impl-989 · 2026-10-21T10:39:18.914Z
- [x] C5. Every adapter declares its `terminal` capability, `none` today, readable by a client (test).
  - done: impl-989 · 2026-10-21T10:39:18.984Z
- [x] C6. `hub/README.md` documents the eight reservations as built.
  - done: impl-989 · 2026-10-21T10:39:19.348Z
  - verified: rev-23 [reviewer] · run rev-20261021-989-source · 2026-10-21T10:42:53.667Z · commit d71acb93ae77d196915fc6d513fab1acca134c33

## Comments

### impl-989 · 2026-10-21T10:39:18.724Z

Implemented C1–C6 with TDD at web transport and isolated browser seams. Local Darwin arm64 targeted evidence on current pre-review tree: web-auth.test.ts 28/28; connection-snapshot.test.ts 11/11; web-bundle.test.ts 1/1; isolated Headless Shell connection.test.ts 4/4 (3 sequential subtests, includes stale proxy reload guard); typecheck and static lint passed, test lint report-only with 0 refusals. No queued suite receipt yet; source review precedes mode-free verification. README records the eight terminal reservations and identifies T-986's parallel queue/resume scope explicitly. QA policy is after-stage.

### rev-23 · 2026-10-21T10:42:53.667Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261021-989-source
commit: d71acb93ae77d196915fc6d513fab1acca134c33
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Full source clear; Standards0/Spec0 findings. A-8295 records 28-file audit at base3da31f0fb6c7d9f8cc2d4d49c82b34debc646308: raw traffic/pong liveness with30/60s fake-clock receipts, binary4003 and exact UTF8 JSON1MiB/oversize1009, per-welcome served digest plus Vite meta and protocol-runtime hashing, web-only version restart action and browser reload guard, all adapters terminal:none exposed in session.list. Exact local legacy no-feature welcome/spoke paths preserved. Browser tests retain reconnect/secret checks, arm navigation before restart and separately assert final rendered state. C6 docs verified; T-986 queue/resume ownership explicitly qualified. C1–C5 remain execution-dependent. A-8292 targeted Mac summaries are not a queued full/Web/load-gate receipt. Proceed normal mode-free configured verification at this unchanged head; final evidence must retain actual Web/browser coverage and phase limits. If Web unavailable, route disposition to lead/Coordinator; no unavailable-as-pass or unauthorized executor override. No Reviewer runtime/GUI.

Criteria: C6 verified.
