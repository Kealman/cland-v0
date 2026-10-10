---
id: T-163
kind: task
title: "The graph legible at size: node widths for 120 to 200 columns, o sideways, the GRAPH-001 successor on the hub's fields, the README"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-161
topic: topic-79
branch: t/T-163-the-graph-legible-at-size-node-widths
created: 2026-10-10T07:49:36.868Z
updated: 2026-10-10T11:39:41.684Z
---

## Parent

T-116 (The task graph), slice 5 of 5.

## What to build

Legible at size. Node widths that fit 120 to 200 columns. Vertical layout by default, with `o` turning it sideways (decided in T-98). The `GRAPH-001` QA case is rebuilt on the hub's fields. `nvim/README.md` describes the graph and its keys. Crossing-edge legibility at a real epic's density is fog for the next version (spec §3.15): document what remains rather than solving it here.

## Acceptance criteria

- [ ] T-19's graph (22 items, 36 edges) is legible at 120, 160 and 200 columns, with screenshots or canvas dumps as artifacts.
- [ ] `o` toggles the sideways orientation; vertical is the default.
- [ ] A headless QA case succeeding `GRAPH-001` passes on dev against the hub's fields.
- [ ] `nvim/README.md` describes the graph, its keys and its known limits.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-161 (Graph cursor and live updates)

## Comments

### impl-163 · 2026-10-10T11:07:14.790Z

Sizing audit: current compose counts dummy vertices as full labels, then clamps at 20 columns; wide layers still overflow and +/− controls/↳ continuations from spec §3.15 are absent. Restoring window fitting and continuation bands from the prototype, keeping routing/focus metadata intact. GRAPH-001 will use the frozen T-19 topology with native hub fields and a separate status sampler; evidence will cover 120/160/200 columns.

### impl-163 · 2026-10-10T11:13:58.922Z

Implementation committed as fc2cbfa. Typecheck, 13 pure Lua graph-layout cases, 10 graph integration tests and GRAPH-001 pass; the locked test:nvim suite and two-axis local review are running. Canvas evidence is artifact A-575, durable path /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-575-t-163-t-19-graph-canvas-dumps-at-120-160-and-200-columns.md (120/160/200 columns, sessions panel/full width, sideways and native status sampler). Crossing clarity remains an explicit v0.2 limit.

### rev-8 · 2026-10-10T11:17:59.049Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-163-1
commit: 3e07379b6a0e6576df5df99eac9f919c0b47a9fc

No findings. Standards and Spec clear against the ticket, §3.15 and prototype. Sizing/continuations preserve node identity, original diagnostics and incident-edge ownership; labels fit display cells and clipped text ends in ellipses. GRAPH-001 uses explicit native status/claim/verdict/criterion fields, including contradictory workflow evidence. A-575 supplies required width canvases; README records the crossing limits.

Native in-memory T-19 probes passed six available widths (85/120/125/160/165/200): all 22 linked labels fit, all 32 drawn endpoint pairs preserved, incident ownership valid, and selected node retained through sizing/orientation changes. Implementation reports targeted checks/typecheck passing; full test:nvim pending in reviewed evidence. No reviewer edits or suites.

A-577: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-577-t-163-graph-sizing-and-native-field-qa-review-clear.md

### impl-163 · 2026-10-10T11:39:41.387Z

Handoff: 3e07379b6a0e6576df5df99eac9f919c0b47a9fc committed and pushed to origin; working tree clean. Graph labels fit 120/160/200 columns through numbered continuation bands; +/− sizing, … clipping and wrapped diagnostics preserve node/edge ownership and cursor selection. Vertical remains default; o turns sideways. GRAPH-001 successor uses frozen T-19 topology with native hub fields and a separate workflow sampler, polls rendered state, and checks six widths, orientation, motions, actions, live updates and board coexistence. README documents keys and v0.2 crossing limits. Node v24.21.0: npm run typecheck passed; locked npm run test:nvim passed 222/222, no skips (217.74s run after 1292.35s lock wait). rev-8 review clear at this head, run rev-8-20261010-163-1 (A-577). Canvas evidence A-575: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-575-t-163-t-19-graph-canvas-dumps-at-120-160-and-200-columns.md. Full suite evidence A-586: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-586-t-163-locked-neovim-suite-222-tests-pass.log.
