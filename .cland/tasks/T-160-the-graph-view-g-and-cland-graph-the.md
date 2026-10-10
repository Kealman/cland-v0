---
id: T-160
kind: task
title: "The graph view: ␣G and :Cland graph, the release's open containers as parents with p and P, nodes on the hub's status, claims, verdicts and criteria, the tray"
state: open
status: ready
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-159
topic: topic-72
branch: t/T-160-the-graph-view-g-and-cland-graph-the
created: 2026-10-10T07:49:36.565Z
updated: 2026-10-10T09:19:14.360Z
---

## Parent

T-116 (The task graph), slice 2 of 5.

## What to build

The graph view: `␣G` and `:Cland graph [T-n]` open a centre view that lays out an open container's children with the T-159 layout. The parent is an open container of the current release, cycled with `p` and `P`. Nodes carry the hub's status, the blocked mark ◌, the title, the ask badge, the claim, the latest verdict and verified/total (from the criteria once T-112 lands, the checkbox count until then, behind one replaceable function). Done items are dimmed and folded in the tray (`d`). The board stays as it is on `␣b`. Per T-98, the graph is an experimental extra view.

## Acceptance criteria

- [ ] `␣G` and `:Cland graph [T-n]` open the graph of the current release's first open container, or of T-n.
- [ ] `p` and `P` cycle the parent among the release's open containers.
- [ ] Nodes show status, ◌ blocked, title, ask badge, claim, latest verdict and verified/total from the hub's index, never the item files.
- [ ] Done items are dimmed and folded in the tray; `d` unfolds them.
- [ ] Demo: `␣G` shows the first v0.1 epic as a graph; a headless test drives it on the stub hub.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-159 (The graph layout)

## Comments

### impl-160 · 2026-10-10T08:46:22.728Z

Implementation started at dev 8697ca3. Using the existing Neovim headless/stub-hub seam to verify graph entry points, current-release parent cycling, hub node fields and done tray folding. Topic: topic-72.

### impl-160 · 2026-10-10T08:58:17.765Z

Graph implementation is committed. Six headless Neovim/stub-hub tests pass, including an added regression ensuring graph canvas rows do not soft-wrap; typecheck passes. Standards and Spec sub-agent reviews found no issues, including the final wrapping fix. Demo artifact A-510 captures T-107 and T-130 from the hub-index snapshot. The locked full Neovim suite remains queued behind other sessions.

### rev-8 · 2026-10-10T09:19:14.260Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-160-1
commit: e49a3b553195a490c3f7740173297d30f097e159

No high, medium, or low findings. Standards and Spec clear. Entry points, rank/tree parent cycle with release last, hub-backed node fields/criteria accessor and dimmed/folded done tray match this slice; board implementation unchanged. Independent native headless probe confirmed configured-level parent order, structured 1/2 fraction overriding checked-box fallback, linked done visibility and tray folding/toggle. Reviewed A-510 demo and A-512 typecheck/six graph tests evidence. Full test:nvim remains queued, as requested; no reviewer suites or edits. Artifact A-521: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-521-t-160-review-experimental-graph-clear.md.
