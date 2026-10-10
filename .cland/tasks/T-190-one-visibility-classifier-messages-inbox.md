---
id: T-190
kind: task
title: "One visibility classifier: messages, inbox events, sessions, items and artifacts placed by the default table, [visibility] overrides; thread, top bar and palette move onto it"
state: open
status: review
criterion_seq: 4
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-115
blocked_by: []
topic: topic-92
branch: t/T-190-one-visibility-classifier-messages-inbox
created: 2026-10-10T16:25:05.955Z
updated: 2026-10-10T16:56:43.493Z
---

## Parent

T-115, slice 1 of 6. Read the epic's Contents, its choice where the spec is silent ([visibility] keyed by surface and kind, each value a layer) and its Constraints.

## What to build

A module that places messages, inbox events, sessions, items and artifacts in a layer by the default table, overridable by `[visibility]`; the thread, the top bar and the palette move onto it.

## Acceptance criteria

- [x] C1. The behaviour above works end to end through the v0 seams: the hub frame protocol, the fake harnesses and headless Neovim where the UI is touched.
  - done: impl-190 · 2026-10-10T16:55:23.615Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
- [x] C2. Demo: a project's `[visibility]` raises long idles to now, and the top bar counts them.
  - done: impl-190 · 2026-10-10T16:40:37.670Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-1 · 2026-10-10T16:52:58.987Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
- [x] C3. Docs (hub/README.md, nvim/README.md or docs/) describe what changed; any role clause change lists the exact .cland/roles.toml lines in the handover.
  - done: impl-190 · 2026-10-10T16:40:37.787Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-1 · 2026-10-10T16:52:59.081Z
  - verified: rev-12 [reviewer] · run rev-12-20261010-190-2 · 2026-10-10T16:56:43.493Z
- [ ] C4. `npm run typecheck && npm test` pass (or `npm run test:nvim` for a Neovim-only slice).

## Comments

### impl-190 · 2026-10-10T16:26:50.169Z

Implementation seams are the epic's agreed ones: real daemon frames/MCP, fake harness idle signals, then headless Neovim on the stub hub. Classifier will live in the hub: project config and authoritative needsYou are hub-owned; additive layer fields on outgoing frames let every Lua surface consume one decision without duplicating policy.

### impl-190 · 2026-10-10T16:48:55.775Z

Self-review fixes: task events publish the classifier's complete item-layer map so a current-release change updates cached palette rows without reloading; real daemon and headless regressions pass. Artifact creator role is captured at final authorized publication and retained across role changes/restart; shared verdict predicate removes duplication. T-134 message verdict exception preserved per Coordinator and annotated T-171. Focused hub visibility 5/5, headless current-release 1/1 and typecheck pass. Full suite pending.

### rev-12 · 2026-10-10T16:52:59.186Z

verdict: review
result: not clear
by: rev-12 [reviewer]
run: rev-12-20261010-190-1
commit: 98be6204465c684b990bc9d0014b49ead556b02f

Medium — hub/src/hub/visibility.ts:174: session.state classification omits authoritative process status. Stop/exit publishes a background session.process, then state unknown, which falls back to idle/watch (now with sessions.idle="now"). nvim/lua/cland/state.lua:395 overwrites the cached terminal process layer, leaving it undimmed and potentially counted as now until refresh. §3.5 requires stopped sessions background. Include terminal status in state-event classification, preserve the Aide exception, and cover stop/exit live updates through fake harness/headless UI.

Standards: no material findings. Other requested classification/override consumers, task-layer refresh and artifact-role capture are supported. Authorized T-134/T-169/T-171 steering remains intact. C2/C3 verified separately; C1 failed. Independent typecheck/diff check passed, and direct read-only classifier probes confirmed the conflicting terminal projections. C4 remains unverified pending full suite; writing E2E tests were inspected rather than independently rerun.

Review A-672: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-672-t-190-review-at-98be620-terminal-session-layers-regress.md.

Criteria: C1 failed (Terminal session.state frames omit process status and overwrite stopped/exited background layers with idle/watch or now, breaking live palette dimming and session counts.).

### impl-190 · 2026-10-10T16:54:50.220Z

Review rev-12-20261010-190-1 reproduced with real fake-harness stop/exit and headless palette/session-count regressions: a following unknown state event lost terminal process facts and became now under sessions.idle="now". Classifier state projection now uses authoritative cached status and launch role; Aide terminal exception retained. Targeted verification underway; full-suite result for 98be620 remains pending and will not establish the new head.

### rev-12 · 2026-10-10T16:56:43.493Z

verdict: review
result: clear
by: rev-12 [reviewer]
run: rev-12-20261010-190-2
commit: 23707720396c1c969d7eb4ca184d1f85e3439bfe

No remaining high or medium findings. A-672 is fixed: session.state projections use cached process status/role by sessionId, preserving stopped/exited Implementer background placement and the stopped-Aide exception. Process publication refreshes those facts across role changes/resume. Daemon/fake-harness and headless regressions cover stop/exit/Aide layers, cached palette dimming and session counts. Separate Standards and Spec delta reviews found no material issues; prior full-item checks remain applicable.

C1–C3 verified. Independent typecheck, diff check and read-only terminal-classifier probes passed at 2370772. A-673 reports daemon 3/3 and headless 3/3 targeted tests green; writing E2E tests were inspected rather than independently rerun in reviewer sandbox. C4 remains unverified pending the full suite on this head.

Review A-675: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-675-t-190-re-review-at-2370772-terminal-session-fix-clear.md.

Criteria: C1 verified, C2 verified, C3 verified.
