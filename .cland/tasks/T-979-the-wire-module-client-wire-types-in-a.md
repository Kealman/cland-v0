---
id: T-979
kind: task
title: "The wire module: client wire types in a leaf module"
state: open
status: review
size: M
criterion_seq: 5
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by: []
topic: topic-751
branch: t/T-979-the-wire-module-client-wire-types-in-a
created: 2026-10-20T16:49:59.811Z
updated: 2026-10-20T16:58:05.148Z
---

## Summary

The frames and shapes a client reads move into a module that imports nothing from the hub and no Node built-in, so a browser build typechecks without Node globals. The hub's own types are checked against the wire types at typecheck. This prefactor makes the snapshot, the deltas and the web's imports easy.

## What to build

Types to move:
- the hello, welcome, result and error frames;
- the client requests the workbenches send;
- the pushed events;
- `Topic`, `TopicMessage`, `AskCard`, `Presence`, the session row, `EventRow`, the account row and the verification queue;
- the item summary as the wire carries it.

The new snapshot and delta types are born in this module. Today `hub/src/protocol.ts` imports `Layer` from `hub/visibility.ts` and `ItemSummary` from `tracker/tracker.ts`. The second import reaches `node:fs`, `node:sqlite` and the suites through its type graph, so the wire shapes are restated in the leaf module rather than re-exported. Type-level conformance assertions keep the hub and the wire in step. This is the expand step only: the hub keeps its own types, and nothing on the wire changes.

## Acceptance criteria

- [x] C1. The leaf module imports nothing outside its own directory and no `node:` module, and a T0 static check fails on a fixture that adds such an import.
  - done: impl-979 · 2026-10-20T16:56:23.955Z
  - verified: rev-23 [reviewer] · run rev-20261020-979-source · 2026-10-20T16:58:05.148Z · commit 8eaa81ae384b885ca7f25ad4ee8bff8473c2487b
- [x] C2. The leaf module typechecks under a DOM-only tsconfig without `@types/node`, as part of `npm run typecheck`.
  - done: impl-979 · 2026-10-20T16:56:29.775Z
  - verified: rev-23 [reviewer] · run rev-20261020-979-source · 2026-10-20T16:58:05.148Z · commit 8eaa81ae384b885ca7f25ad4ee8bff8473c2487b
- [x] C3. Type-level conformance assertions between each hub type and its wire type run in `npm run typecheck`, so a field that diverges breaks the typecheck.
  - done: impl-979 · 2026-10-20T16:56:31.501Z
  - verified: rev-23 [reviewer] · run rev-20261020-979-source · 2026-10-20T16:58:05.148Z · commit 8eaa81ae384b885ca7f25ad4ee8bff8473c2487b
- [x] C4. No frame changes on the wire: the recorded Neovim frame fixtures and the hub's frame tests pass without edits.
  - done: impl-979 · 2026-10-20T16:56:32.433Z
- [x] C5. The Modules table of `hub/README.md` names the leaf module and its rule.
  - done: impl-979 · 2026-10-20T16:56:33.527Z
  - verified: rev-23 [reviewer] · run rev-20261020-979-source · 2026-10-20T16:58:05.148Z · commit 8eaa81ae384b885ca7f25ad4ee8bff8473c2487b

## Comments

### impl-979 · 2026-10-20T16:55:45.061Z

Implemented shared/wire/index.ts with current frames and client/session/item request families, account/item/queue payloads, exact hub-side conformance assertions and drift fixtures. Added DOM-only tsconfig to root typecheck, a T0 import guard with negative fixtures, and Modules/testing docs. Local macOS targeted evidence on working tree: nvim-fixture-boundary 7/7 (0.221s), suite-protocol 13/13 (2.588s), edges-component 1/1 (0.813s); committed Neovim catalog and all slices match current producers without edits. npm run check passed (lint budget report-only, zero refusals); final same-head queued verification follows source review.

### rev-23 · 2026-10-20T16:58:05.148Z

verdict: review
result: clear
by: rev-23 [reviewer]
run: rev-20261020-979-source
commit: 8eaa81ae384b885ca7f25ad4ee8bff8473c2487b
scope: full
findings: []
finding_counts: {"high":0,"medium":0,"low":0}

Standards and Spec: no findings. Browser leaf independently restates existing shapes with no external imports; enforced T0 AST guard has negative fixtures, DOM types:[] config is in root typecheck, and hub conformance checks all 164 exports plus optional/required/nested drift controls. Modules/testing docs match. Existing producers/consumers/protocol/fixtures untouched. A-7724 local implementation checks and final typecheck are supplemental summary evidence; C1/C2/C3/C5 established, C4 awaits same-head mode-free recorded-frame/protocol gate. QA affected/after-stage, no per-item criteria. Reviewer ran no tests.

Criteria: C1 verified, C2 verified, C3 verified, C5 verified.
