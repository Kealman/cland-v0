---
id: T-979
kind: task
title: "The wire module: client wire types in a leaf module"
state: open
status: planned
size: M
labels:
  - ready-for-agent
assignee: null
parent: E-412
blocked_by: []
topic: null
branch: null
created: 2026-10-20T16:49:59.811Z
updated: 2026-10-20T16:50:14.762Z
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

- [ ] C1. The leaf module imports nothing outside its own directory and no `node:` module, and a T0 static check fails on a fixture that adds such an import.
- [ ] C2. The leaf module typechecks under a DOM-only tsconfig without `@types/node`, as part of `npm run typecheck`.
- [ ] C3. Type-level conformance assertions between each hub type and its wire type run in `npm run typecheck`, so a field that diverges breaks the typecheck.
- [ ] C4. No frame changes on the wire: the recorded Neovim frame fixtures and the hub's frame tests pass without edits.
- [ ] C5. The Modules table of `hub/README.md` names the leaf module and its rule.
