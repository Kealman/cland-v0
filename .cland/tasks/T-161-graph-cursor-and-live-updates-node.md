---
id: T-161
kind: task
title: "Graph cursor and live updates: node motions with edges highlighted, the winbar, Enter, gi, gt and gs, sideways scroll, redraw only on a visible change"
state: closed
status: done
labels:
  - v0.1
  - ready-for-agent
assignee: null
parent: T-116
blocked_by:
  - T-160
topic: topic-78
branch: t/T-161-graph-cursor-and-live-updates-node
created: 2026-10-10T07:49:36.665Z
updated: 2026-10-10T11:06:03.438Z
---

## Parent

T-116 (The task graph), slice 3 of 5.

## What to build

The node cursor and live updates. A cursor moves node to node with `h`, `l`, `j`, `k`, `^` and `$`, with its edges highlighted. The winbar spells the node out. Enter opens the item; `gi`, `gt` and `gs` act on the node as they do elsewhere. The window scrolls sideways to keep the cursor in view. A hub update redraws only on a visible change and keeps the cursor on its node; `␣␣` returns to the same node after opening an item.

## Acceptance criteria

- [ ] The motions move node to node; edges of the cursor's node are highlighted; the winbar names it.
- [ ] Enter, `gi`, `gt` and `gs` act on the node.
- [ ] Sideways scrolling keeps the cursor visible.
- [ ] A claim landing on a node redraws it in place with the cursor kept; an update with no visible change redraws nothing; headless tests cover both.
- [ ] `npm run typecheck && npm run test:nvim` pass.

## Blocked by

- T-160 (The graph view)

## Comments

### impl-161 · 2026-10-10T10:49:47.342Z

Implementation started. Reviewing prototype cursor behavior and current graph geometry; tests will poll rendered state across node actions and hub updates, including unchanged-buffer checks.

### impl-161 · 2026-10-10T10:57:59.626Z

Implemented node motions (both orientations and tray), per-parent selection, incident-edge focus namespace, full node winbar, Enter and gi/gt/gs context, return navigation and sideways visibility. Graph buffer writes now compare emitted text/highlights; unchanged metadata/body refreshes leave the buffer and focus marks untouched. Ten rendered-state graph tests and npm run typecheck pass. Locked npm run test:nvim is running.

### rev-8 · 2026-10-10T11:05:08.137Z

verdict: review
result: clear
by: rev-8 [reviewer]
run: rev-8-20261010-161-1
commit: 4d26fdc4233a75779c0596c3151609204b2d594e

No findings. Standards and Spec clear against the ticket, §3.15 and prototype cursor reference. Node motions, incident-edge focus, winbar, Enter/gi/gt/gs, sideways visibility and per-parent return selection match the requested behavior. Visible canvas changes redraw; invisible updates retain buffer changedtick and focus marks. Tests poll rendered state/completed responses rather than assume timer ordering.

Native in-memory module probes passed motions without writes, claim-induced row reflow with selected node retained, no-op tick/focus preservation, sideways visibility, graph node context and Unicode/percent winbar. A-571 reports 10 graph tests/typecheck passing; full test:nvim pending in reviewed evidence. No reviewer edits or suites.

A-573: /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-573-t-161-graph-cursor-and-live-updates-review-clear.md

### impl-161 · 2026-10-10T11:05:46.521Z

Completed and pushed to origin: 4d26fdc4233a75779c0596c3151609204b2d594e (with implementation commit beb71d858ef4e61cf45a3740631774f5496fa7d8). npm run typecheck passes; locked npm run test:nvim passes all 220 tests, zero failures/skips, on Node v24.21.0; git diff --check passes and worktree is clean. Implementation/internal review: A-571; formal review clear by rev-8 at this head: A-573; final suite log A-574 at /Users/evgeniyivanov/Projects/cland/v0/.cland/artifacts/A-574-t-161-locked-neovim-suite-220-passed.log. Changes center on nvim/lua/cland/graph.lua, with motions, winbar, registry/help integrations and ten graph tests.

### coord · 2026-10-10T11:06:03.438Z

Merged f31783f8c430ba84b1ba2c6e0246681d072c8991 onto dev.
