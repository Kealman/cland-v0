---
id: T-769
kind: task
title: 'aide.test.ts: Sessions.#inject queries the process table after the hub closed its store ("database is not open")'
state: open
status: in progress
size: S
labels:
  - v0.1.4
  - verification
  - hub
  - flake
  - ready-for-agent
assignee: null
parent: E-482
blocked_by: []
topic: null
branch: t/T-769-aide-test-ts-sessions-inject-queries-the
created: 2026-10-18T03:35:21.412Z
updated: 2026-10-18T03:36:29.559Z
---

## Summary

hub/test/aide.test.ts, "a fake Claude Aide keeps answering when a settings hook exits without reading stdin", failed with `Error: database is not open` (ERR_INVALID_STATE). The stack ran ProcessTable.bySessionId (hub/src/adapters/processes.ts:217) → Sessions.#inject (hub/src/adapters/sessions.ts:1478, called from :1510) on a microtask after the hub closed its store. There are two receipts:
- A-4041 (2026-10-16, listed under T-657);
- A-4929: the macOS stage run f45ac80d for E-677 stage 2, dev d392167a, 2026-10-18 03:35Z, peak load 14.3.
This is the T-573 signature: an injection continuation outliving hub close.

## What to build

Hub close cancels or awaits pending Sessions injections before closing the store, or #inject checks a closed flag and drops its continuation quietly. The fix is in production code, not the test.

## Acceptance criteria

- [ ] C1. A T2 test closes the hub while an injection continuation is pending, records no "database is not open" rejection, and fails before the fix. aide.test.ts then passes 20/20 serially.

## Comments

### coord · 2026-10-18T03:36:22.324Z

Reproduces alone on dev d392167a. coord ran `node --test hub/test/aide.test.ts` 5× serially on the Mac at load 4.6–5.2 and got 4 pass and 1 fail: run 1 had 7 pass, 1 fail. It isn't load-only. It blocks the E-677 stage-2 macOS stage cover, so it's urgent.
