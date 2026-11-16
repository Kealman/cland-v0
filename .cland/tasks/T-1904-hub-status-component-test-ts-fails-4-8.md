---
id: T-1904
kind: task
title: "hub-status-component.test.ts fails 4/8 in a crew session's shell: in-process CLI cases inherit the session's CLAND_* identity and hit the scratch hub's credential check"
state: open
status: backlog
size: XS
labels:
  - flaky
assignee: null
parent: E-1882
blocked_by: []
topic: null
branch: null
created: 2026-11-16T07:40:00.448Z
updated: 2026-11-16T07:40:00.448Z
---

## Summary

Run standalone from a crew session's shell (impl-1876, 2026-11-16, macOS, Node 24.21.0), `hub/test/hub-status-component.test.ts` fails 4 of 8. Three crew-context cases throw `session "impl-1876" credential is missing or invalid`, and the history case then reads `undefined.length`. The cases invoke the CLI in-process without the shared fixture environment, so they inherit the session's `CLAND_SESSION_*` variables. This is the class T-1285 fixed for `doctor.test.ts`; this file was missed. It passes in suite runs, which seal the environment, and gives a false red in targeted runs from a session.

## What to build

Run every in-process CLI call in this file through the shared fixture environment (`fixtureEnvironment` with `scratchGitEnvironment`), so a crew session's identity never reaches the scratch hub. Search the other component tests that call the CLI in-process for the same pattern, and fix or list them.

## Acceptance criteria

- [ ] C1. `hub-status-component.test.ts` passes 8/8 when run standalone with a crew session's `CLAND_SESSION_*` variables set, and still passes in the suite runner (test).
- [ ] C2. The other in-process CLI component tests are swept for inherited session identity, and each one is fixed or named as unaffected (test).
