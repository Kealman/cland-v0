---
id: T-1019
kind: task
title: "T3 regressions from T-978/T-979: hub.json webPort, the status web line, the typecheck fixture"
state: open
status: in progress
size: S
labels:
  - ready-for-agent
assignee: null
parent: C-325
blocked_by: []
regression_of: T-978
found_by: cover
topic: null
branch: t/T-1019-t3-regressions-from-t-978-t-979-hub-json
created: 2026-10-20T18:14:13.158Z
updated: 2026-10-20T18:14:19.564Z
---

## Summary

The integrated cover 026b3431 at 76655c4c (A-7887) found three T3 regressions from T-978 (web edge) and T-979 (wire module), which landed through T1-only batches (D77): the hub-lifecycle scenario still expects hub.json without `webPort`; `cland hub status` prints the `web` line inside the sessions block, between `sessions: 1` and the session rows; and typecheck.test.ts copies a project fixture without `shared/wire/tsconfig.json`, so the new root typecheck step fails with TS5058.

## What to build

The status printer puts `web` in the hub block (beside pid, port, socket, uptime, version). The hub-lifecycle test expects `webPort` in hub.json and the corrected layout. The typecheck test fixture includes `shared/wire/` (or derives its copied paths from the typecheck script). Run all three as targeted local T3 runs.

## Acceptance criteria

- [ ] C1. `cland hub status` prints `web` in the hub block, and the session rows follow `sessions: N` directly (test).
- [ ] C2. hub/test/scenarios/hub-lifecycle.test.ts passes, expecting `webPort` in hub.json (targeted local T3 run named in the item topic).
- [ ] C3. hub/test/typecheck.test.ts passes with the root typecheck that includes shared/wire (targeted local T3 run named in the item topic).
