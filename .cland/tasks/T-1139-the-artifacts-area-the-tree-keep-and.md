---
id: T-1139
kind: task
title: "The Artifacts area: the tree, keep and archive"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-418
blocked_by:
  - T-1130
topic: topic-876
branch: t/T-1139-the-artifacts-area-the-tree-keep-and
created: 2026-10-22T15:16:16.169Z
updated: 2026-10-22T23:17:29.716Z
---

## Summary

The Artifacts area shows the tree of v0.1 §3.6 with its sections, unfolds folder artifacts into their files, and keeps (`k`) and archives (`d`) as Neovim does.

## Parent

E-418 (§3.2; v0.1 §3.6; tracer step 6).

## What to build

- **Sections**, each a fold remembered in this browser with its count: Mine (the human's and the Aides' artifacts, folders first), Kept, By role (Coordinator, Implementers, Reviewers, QA and Other, folded as background) and Archived (folded; `A` unfolds it). This topic joins in the notes slice, after E-417.
- **A row:** the kind, the id, the title, the creator, the status mark and "kept".
- **Keys:** `j`, ↓ and ↑ move (`k` keeps, as in Neovim); Enter on a folder unfolds it into its files, listed by the hub on request; `k` toggles keep; `d` archives (for the human's and the Aides' artifacts archive is a layer, not a deletion). Opening files is the next slice.

Creating, moving, promoting, deleting and editing in place stay in Neovim and the CLI in 0.2.0. Changes arrive live from `artifact` frames. Neovim's `artifact_browser.lua` defines the sections and the keys.

## Acceptance criteria

- [x] C1. With artifacts by the human, an Aide, each crew role and one archived, each lands in its section of Mine, Kept, By role and Archived, with By role and Archived folded (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.336Z
- [x] C2. `k` on an agent's artifact moves it to Kept and `k` again unkeeps it, as the hub's artifact list reads (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.426Z
- [x] C3. `d` archives an artifact into Archived, and Enter on a folder artifact lists its files (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.679Z
- [x] C4. A folded section stays folded after a reload, and ↑ moves the cursor up while `k` keeps (Web test).
  - done: impl-1139 · 2026-10-22T23:16:53.783Z
- [x] C5. `web/README.md` gains an Artifacts section with the sections and the keys (docs).
  - done: impl-1139 · 2026-10-22T23:16:53.875Z

## Comments

### impl-1139 · 2026-10-22T23:16:10.379Z

Implemented the Artifacts pane with Mine/Kept/By role/Archived folds, provenance/status rows, visible-row navigation, keep/archive commands and lazy folder files. Extended the existing bounded inventory with More artifacts; live replacements win over pending pages and reconnect invalidates old page replies. TDD reds were observed before each slice. Targeted local macOS Web tests pass (4 tests, worst 1.034 s); callback T1 passes (9 tests). T0 and existing slot/help regression checks in progress. QA policy is after-stage, so no per-item QA request.
