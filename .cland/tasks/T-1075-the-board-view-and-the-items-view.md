---
id: T-1075
kind: task
title: The Board view and the Items view switcher
state: open
status: in progress
size: M
criterion_seq: 3
labels:
  - ready-for-agent
assignee: null
parent: E-416
blocked_by:
  - T-1071
topic: topic-832
branch: t/T-1075-the-board-view-and-the-items-view
created: 2026-10-21T17:32:16.777Z
updated: 2026-10-22T04:23:13.781Z
---

## Summary

The Board view beside the tree, and the Items header's view switcher that keeps the scope, the filter and the selection.

## Parent

E-416 (v0.1.2 §3.11 as a view; tracer step 4).

## What to build

The Items header gets the switcher (Tree, Board, Graph, Plan); Graph and Plan come in later tickets and show as disabled until then. The Board shows status sections with counts and rows with the parent prefix, the claim or verdict mark, verified/total, the blocked glyph and the next mark. At release scope, the epics show as folded rows with done/total and the breakdown, unfolding into status sections, along with the epic tabs, Direct tasks (N) and the categories' count line. The Board has no rank keys; order, `next` and `blocked` come from the hub. `nvim/lua/cland/vboard.lua` defines the behaviour.

## Acceptance criteria

- [x] C1. Switching Tree → Board → Tree on a scoped epic keeps the scope, the filter and the selected task (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.746Z
- [x] C2. At release scope the Board shows the epics as folded rows with done/total including closed children, and unfolds one into status sections (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.919Z
- [x] C3. The Board offers no rank or move action by key or mouse (Web test).
  - done: impl-1075 · 2026-10-22T04:20:03.990Z

## Comments

### impl-1075 · 2026-10-22T04:20:04.062Z

Implemented Board + header switcher at 0e191e284b7f9d1e7fa35af380636f2cf7e39cb0 (tree 4f5fb7ffa12918108a5bb344aed8f5b1fa5208b9). Shared T-1074 preference/scoped-model commits cherry-picked unchanged; scoped Tree call consumes shared scope. Test-first reds: missing Board button; scoped Tree ignored scope; epic-tab narrowing incorrectly replaced release.next. All fixed. Local Darwin arm64 targeted evidence: board.test.ts 3 criterion cases + parent pass, item-card.test.ts 6 pass, shell.test.ts 8 cases + parent pass; all no skip/cancel and observed fixture teardown. Root typecheck and tier lint pass. These are targeted local checks, no suite/remote/T3/QA claim. Board screenshot A-8891; final criterion Web log artifact posted in item topic. Per launch brief, stage QA runs on dev, no per-item QA brief.

### rev-23 · 2026-10-22T04:23:13.781Z

verdict: review
result: not clear
by: rev-23 [reviewer]
run: rev-20261022-1075-source
commit: 0e191e284b7f9d1e7fa35af380636f2cf7e39cb0
scope: full
findings: [{"severity":"medium","text":"M1: Board Direct tasks reuses Tree's :direct:<scope> preference key. Opening/toggling it in Board changes the Tree fold on return, contradicting independent view folds (web/README:205–206 and vboard's board:direct namespace). Namespace Board's key and add a two-way browser fold round trip.","file":"web/src/items-board.ts","line":90}]
finding_counts: {"high":0,"medium":1,"low":0}

Source not clear on one fold-state collision. Shared scope/filter/selection, authoritative totals/next and no-rank action paths otherwise look implemented; supporting local criterion4/4 is not configured proof. No runtime execution by Reviewer. All criterion marks remain pending actual accepted verification, no failed criterion asserted from static-only test gap. Full audit A-8894. Correct and request fresh source review before verify.
