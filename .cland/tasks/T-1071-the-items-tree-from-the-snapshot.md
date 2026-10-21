---
id: T-1071
kind: task
title: The Items tree from the snapshot
state: open
status: in progress
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1052
topic: topic-818
branch: t/T-1071-the-items-tree-from-the-snapshot
created: 2026-10-21T17:32:16.253Z
updated: 2026-10-21T18:47:42.264Z
---

## Summary

The Items area's tree: Neovim's explorer in the browser, built from the hub snapshot and its deltas. E-416's first tracer bullet.

## Parent

E-416 (§3.2, v0.1.2 §3.8 and §3.10; tracer step 1).

## What to build

The current release at the root, with its epics by rank and the done ones after them in close order, Direct tasks (N), and the folded roots: Categories (with the top three, "N more", the open count and the idle-work mark), Unscheduled and Other releases. `A` shows the archived roots. Release, epic and task rows carry their roll-ups from the hub's item summary (T-1052), with cells up to 16 children and a proportional bar beyond, stage groups, claims, holds, verdicts with round and verified/total, the ordinal, and the rank fact only when set by hand. `j`, `k`, `l`, `h` and `za` move and fold, and `D` hides done items. The folds and `D` are kept per client. The cursor stays on its item across deltas. The tree is rebuilt from the model per delta, within 15 ms for 300 items. The prototype on `prototype/web-shell` (`web/src/explorer.ts`) is a reference, never merged.

## Acceptance criteria

- [ ] C1. A Web test on a copy of the live tracker opens the Items area at 1440x900 and reads the current release, its epics with bars and stages, Direct tasks and the three folded roots, with the row facts above (Web test).
- [ ] C2. A status change sent through the CLI moves the row's place and roll-up while the cursor stays on the same item (Web test).
- [ ] C3. `D`, `A`, the folds and the category rows behave as described and the folds persist per client across a reload (Web test).
- [ ] C4. Rebuilding the tree for 300 items after one delta stays under 15 ms, measured in the test.
- [ ] C5. `web/README.md` and `?` list the Items area's tree keys.

## Comments

### impl-1071 · 2026-10-21T18:47:42.264Z

Test-first C1: Headless Shell on a scratch project copied from .cland/tasks reached the expected red (Items tree locator absent). Initial tree now passes that targeted Web assertion on macOS arm64; no suite receipt yet. Extending the same public seams for CLI deltas, local preferences and the 300-item rebuild bound.
